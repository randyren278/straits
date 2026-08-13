/**
 * harvest-once.ts — bounded, single-shot AIS harvest for launchd.
 *
 * Unlike index.ts (a persistent daemon that streams forever + runs crons),
 * this script does ONE bounded pass and exits — the shape a laptop LaunchAgent
 * wants (StartInterval fires it every ~10 min; it must terminate quickly):
 *
 *   1. Connect to AISStream, collect messages for HARVEST_WINDOW_MS (~90s)
 *   2. Dedupe to the LATEST position per vessel this window (10-min-resolution
 *      tracks — keeps Supabase free-tier storage bounded vs. raw firehose)
 *   3. Bulk-upsert vessels + bulk-insert positions  ← the core; success is
 *      judged on this alone
 *   4. Run the anomaly detectors once
 *   5. Prune vessel_positions older than RETENTION_DAYS (default 7) + measure
 *   6. Refresh prices/news/sanctions (each freshness-gated so a 10-min cadence
 *      never hammers the APIs)
 *   7. Write status.json (for the SwiftBar menu bar), then exit 0/1
 *
 * Steps 4-6 each run under a time budget against the hard deadline and are
 * SKIPPED (recorded as a warning) rather than allowed to overrun. Housekeeping
 * comes before enrichment so the cheap, always-wanted work can't be starved by
 * a slow external API. A run that lands positions reports ok=true even if
 * enrichment was skipped — the menu bar shows amber for that, red only when
 * the AIS core itself failed.
 *
 * It reuses the SAME db pool + detector/refresh functions as the daemon, so
 * behavior stays identical — it just drives them once instead of on cron.
 *
 * Env (from .env.harvester via `tsx --env-file`):
 *   DATABASE_URL          Supabase transaction pooler (:6543) + ?sslmode=no-verify
 *   AISSTREAM_API_KEY     free AISStream key
 *   HARVEST_WINDOW_MS     collection window (default 90000)
 *   HARVEST_HARD_TIMEOUT_MS  safety kill, wall-clock (default 360000)
 *   RETENTION_DAYS        prune horizon (default 7)
 *   STRAITS_STATE_DIR     where status.json is written (default ~/.straits-harvester)
 */
import WebSocket from 'ws';
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync, readFileSync, renameSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { pool } from '../../lib/db';
import { withDbRetry } from './db-retry';
import { computeOutageAlert } from './outage-alert';

// Anomaly detectors (run once, not on cron) — same set as detection-jobs.ts
import { detectGoingDark } from '../../lib/detection/going-dark';
import { detectLoitering } from '../../lib/detection/loitering';
import { detectSpeedAnomaly, detectDeviation } from '../../lib/detection/deviation';
import { detectRepeatGoingDark } from '../../lib/detection/repeat-going-dark';
import { detectStsTransfers } from '../../lib/detection/sts-transfer';
import { detectSpoofedPositions } from '../../lib/detection/teleport';
import { computeRiskScores } from '../../lib/detection/risk-score';
import { generateAlertsForNewAnomalies } from '../../lib/db/alerts';

// Enrichment refreshers (freshness-gated below) — same set as refresh-jobs.ts.
// Prices deliberately bypass fetchOilPrices(): its last resort re-reads the DB
// and re-inserts, which re-stamps fetched_at and hides a dead source behind a
// "live" freshness gate. Here a total failure must throw so step() records it.
import { fetchFREDPrices } from '../../lib/external/fred';
import { fetchAlphaVantagePrices, type OilPriceData } from '../../lib/external/alphavantage';
import { insertPrice } from '../../lib/db/prices';
import { fetchNews } from '../../lib/news/fetcher';
import { insertNewsItem } from '../../lib/db/news';
import { fetchSanctionsList } from '../../lib/external/opensanctions';
import { batchUpsertSanctions, migrateSanctionsSchema } from '../../lib/db/sanctions';

// ── Config ──────────────────────────────────────────────────────────────────
const WINDOW_MS = Number(process.env.HARVEST_WINDOW_MS ?? 90_000);
const HARD_TIMEOUT_MS = Number(process.env.HARVEST_HARD_TIMEOUT_MS ?? 360_000);
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? 7);
const STATE_DIR = process.env.STRAITS_STATE_DIR || join(homedir(), '.straits-harvester');
const STATUS_PATH = join(STATE_DIR, 'status.json');
// Consecutive empty windows before the operator is interrupted. At the ~10-min
// launchd cadence this is ~30 min of silence — long enough to ride out a
// wake-from-sleep or a dropped socket, short enough that a real provider
// outage doesn't run unnoticed for a day and a half (as one did in Aug 2026).
const AIS_OUTAGE_THRESHOLD = Number(process.env.AIS_OUTAGE_THRESHOLD ?? 3);

// ── Types (standalone, mirrors index.ts to avoid importing the daemon) ────────
interface Pos {
  time: Date; mmsi: string; imo: string | null;
  latitude: number; longitude: number;
  speed: number | null; course: number | null; heading: number | null;
  navStatus: number | null; lowConfidence: boolean;
}
interface Meta { imo: string; mmsi: string; name: string; shipType: number | null; destination: string | null; }

// ── AISStream subscription (mirrors index.ts bounding boxes) ──────────────────
const MAX_SPEED_KNOTS = 50;
const JAMMING_ZONES = [
  { minLat: 24, maxLat: 30, minLon: 48, maxLon: 57 }, // Persian Gulf
  { minLat: 12, maxLat: 20, minLon: 38, maxLon: 45 }, // Red Sea / Bab el-Mandeb
];
const isInJammingZone = (lat: number, lon: number) =>
  JAMMING_ZONES.some((z) => lat >= z.minLat && lat <= z.maxLat && lon >= z.minLon && lon <= z.maxLon);

const subscription = {
  APIKey: process.env.AISSTREAM_API_KEY,
  BoundingBoxes: [
    [[23.0, 47.0], [30.0, 57.5]],  // Full Persian Gulf
    [[15.0, 55.0], [26.0, 66.0]],  // Gulf of Oman + Arabian Sea approaches
    [[8.0, 60.0], [25.0, 78.0]],   // Arabian Sea transit corridor
    [[12.0, 32.0], [30.0, 45.0]],  // Full Red Sea
    [[11.0, 42.0], [14.0, 52.0]],  // Gulf of Aden
    [[29.5, 31.5], [37.0, 37.0]],  // Suez + Eastern Med
  ],
  FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
};

// ── Status (progressively filled; also written by the hard-timeout killer) ────
type Status = {
  lastRun: string; ok: boolean; error: string | null; durationMs: number;
  windowMs: number; messagesReceived: number; uniqueVessels: number;
  positionsInserted: number; vesselsUpserted: number; destinationChanges: number;
  /** null when the detector pass didn't finish — "unknown", not "zero". */
  anomalies: number | null; pricesRefreshed: boolean; newsRefreshed: number;
  sanctionsRefreshed: boolean; pruned: number;
  positionsTotal: number | null; dbSizeMB: number | null; positionsSizeMB: number | null;
  /** Non-fatal step failures/skips this run — surfaced in the menu bar as amber. */
  warnings: string[];
  /** Runs since the last ok=true one; drives menu-bar escalation. */
  consecutiveFailures: number;
  /** ISO timestamp of the last run whose AIS core succeeded. */
  lastOkRun: string | null;
  /** Consecutive windows that landed zero positions; 0 once data returns. */
  consecutiveEmptyAisWindows: number;
  /** Whether the operator has been notified about the outage in progress. */
  aisOutageAlertSent: boolean;
};
const status: Status = {
  lastRun: '', ok: false, error: null, durationMs: 0,
  windowMs: WINDOW_MS, messagesReceived: 0, uniqueVessels: 0,
  positionsInserted: 0, vesselsUpserted: 0, destinationChanges: 0,
  anomalies: null, pricesRefreshed: false, newsRefreshed: 0,
  sanctionsRefreshed: false, pruned: 0,
  positionsTotal: null, dbSizeMB: null, positionsSizeMB: null,
  warnings: [], consecutiveFailures: 0, lastOkRun: null,
  consecutiveEmptyAisWindows: 0, aisOutageAlertSent: false,
};

/** Previous run's status, for the failure streak + last-ok carry-forward. */
function readPrevStatus(): Partial<Status> {
  try {
    return JSON.parse(readFileSync(STATUS_PATH, 'utf8')) as Partial<Status>;
  } catch {
    return {};
  }
}

function writeStatus(startedAt: number): void {
  status.durationMs = Date.now() - startedAt;
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    // Write-then-rename so a power cut mid-write can't leave a truncated
    // status.json — the SwiftBar plugin and the next run's readPrevStatus
    // both depend on this file parsing.
    writeFileSync(`${STATUS_PATH}.tmp`, JSON.stringify(status, null, 2));
    renameSync(`${STATUS_PATH}.tmp`, STATUS_PATH);
  } catch (err) {
    console.error('Failed to write status:', (err as Error).message);
  }
}

/** Record a non-fatal problem: logged, kept in status, never fails the run. */
function warn(message: string): void {
  console.warn(`WARN: ${message}`);
  status.warnings.push(message);
}

/**
 * Interrupt the operator once when the AIS feed has gone dark.
 *
 * Synchronous on purpose: an empty window can short-circuit the rest of the
 * harvest, and a fire-and-forget child would then die with the process before
 * macOS ever drew the banner. osascript returns in tens of milliseconds and
 * this runs at most once per outage, so blocking here costs nothing real.
 * Any failure is swallowed — a missing notification must never fail a harvest.
 */
function notifyOutage(windows: number): void {
  const message = `No AIS positions for ${windows} consecutive windows. Check provider status.`;
  console.error(`OUTAGE ALERT: ${message}`);
  try {
    execFileSync(
      '/usr/bin/osascript',
      ['-e', `display notification ${JSON.stringify(message)} with title "STRAITS · AIS feed dark"`],
      { timeout: 5_000, stdio: 'ignore' }
    );
  } catch (err) {
    warn(`outage notification failed — ${(err as Error).message}`);
  }
}

// ── Collect a bounded window of AIS messages ──────────────────────────────────
function collectWindow(): Promise<{ positions: Map<string, Pos>; statics: Map<string, Meta> }> {
  return new Promise((resolve) => {
    const positions = new Map<string, Pos>(); // latest per MMSI
    const statics = new Map<string, Meta>();   // latest per IMO
    let settled = false;

    console.log(`Connecting to AISStream (window ${WINDOW_MS}ms)...`);
    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

    const finish = () => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* already closing */ }
      resolve({ positions, statics });
    };
    const windowTimer = setTimeout(finish, WINDOW_MS);

    ws.on('open', () => {
      ws.send(JSON.stringify(subscription));
      console.log('Subscribed. Collecting...');
    });

    ws.on('message', (data: WebSocket.Data) => {
      status.messagesReceived++;
      let msg: any;
      try { msg = JSON.parse(data.toString()); } catch { return; }

      if (msg.MessageType === 'PositionReport') {
        const m = msg.Message?.PositionReport;
        if (!m || typeof m.Latitude !== 'number' || typeof m.Longitude !== 'number' ||
            !isFinite(m.Latitude) || !isFinite(m.Longitude) ||
            Math.abs(m.Latitude) > 90 || Math.abs(m.Longitude) > 180) return;
        const speed = m.Sog ?? null;
        if (speed !== null && speed > MAX_SPEED_KNOTS) return;
        const mmsi = String(msg.MetaData?.MMSI ?? '');
        if (!mmsi) return;
        const time = new Date(msg.MetaData?.time_utc ?? Date.now());
        const prev = positions.get(mmsi);
        if (prev && prev.time >= time) return; // keep the latest only
        positions.set(mmsi, {
          time, mmsi, imo: null,
          latitude: m.Latitude, longitude: m.Longitude,
          speed, course: m.Cog ?? null, heading: m.TrueHeading ?? null,
          navStatus: m.NavigationalStatus ?? null,
          lowConfidence: isInJammingZone(m.Latitude, m.Longitude),
        });
      } else if (msg.MessageType === 'ShipStaticData') {
        const m = msg.Message?.ShipStaticData;
        if (!m?.ImoNumber) return; // IMO is the identity key (DATA-03)
        statics.set(String(m.ImoNumber), {
          imo: String(m.ImoNumber),
          mmsi: String(msg.MetaData?.MMSI ?? ''),
          name: m.Name?.trim() || 'UNKNOWN',
          shipType: m.Type ?? null,
          destination: m.Destination?.trim() || null,
        });
      }
    });

    ws.on('error', (err: Error) => {
      // Offline / DNS failure / AISStream down all land here. Not fatal: the
      // window just ends empty and launchd retries in 10 minutes.
      warn(`AIS websocket error: ${err.message}`);
      // Don't reconnect (this is one-shot); just end the window early.
      clearTimeout(windowTimer);
      finish();
    });
    ws.on('close', () => { /* handled by finish() */ });
  });
}

// ── Bulk upsert vessels (+ batch destination-change logging) ──────────────────
async function upsertVessels(statics: Map<string, Meta>): Promise<void> {
  const rows = [...statics.values()];
  if (rows.length === 0) return;

  // Prior destinations in one round-trip so we can log mid-voyage changes.
  const imos = rows.map((r) => r.imo);
  const prev = new Map<string, string | null>();
  const { rows: prevRows } = await withDbRetry('vessels prior-destination select', () =>
    pool.query<{ imo: string; destination: string | null }>(
      `SELECT imo, destination FROM vessels WHERE imo = ANY($1)`, [imos]
    )
  );
  for (const r of prevRows) prev.set(r.imo, r.destination);

  // Batch upsert.
  const CHUNK = 500, cols = 5;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk.map((_, j) => {
      const b = j * cols;
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, NOW())`;
    }).join(', ');
    const params = chunk.flatMap((v) => [v.imo, v.mmsi, v.name, v.shipType, v.destination]);
    await withDbRetry(`vessels upsert chunk ${i / CHUNK + 1}`, () =>
      pool.query(
        `INSERT INTO vessels (imo, mmsi, name, ship_type, destination, last_seen)
         VALUES ${values}
         ON CONFLICT (imo) DO UPDATE SET
           mmsi = EXCLUDED.mmsi,
           name = EXCLUDED.name,
           ship_type = COALESCE(EXCLUDED.ship_type, vessels.ship_type),
           destination = COALESCE(EXCLUDED.destination, vessels.destination),
           last_seen = NOW()`,
        params
      )
    );
  }
  status.vesselsUpserted = rows.length;

  // Batch destination changes (both non-null and differing, case-insensitive).
  const changes = rows.filter((v) => {
    const p = prev.get(v.imo);
    return p != null && v.destination != null &&
      p.toUpperCase().trim() !== v.destination.toUpperCase().trim();
  });
  if (changes.length > 0) {
    const values = changes.map((_, j) => {
      const b = j * 3;
      return `($${b + 1}, $${b + 2}, $${b + 3})`;
    }).join(', ');
    const params = changes.flatMap((v) => [v.imo, prev.get(v.imo)!, v.destination!]);
    await withDbRetry('destination-change insert', () =>
      pool.query(
        `INSERT INTO vessel_destination_changes (imo, previous_destination, new_destination)
         VALUES ${values}`, params
      )
    );
    status.destinationChanges = changes.length;
  }
}

// ── Bulk insert positions ─────────────────────────────────────────────────────
async function insertPositions(positions: Map<string, Pos>): Promise<void> {
  const rows = [...positions.values()];
  if (rows.length === 0) return;
  const CHUNK = 500, cols = 10;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk.map((_, j) => {
      const b = j * cols;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10})`;
    }).join(', ');
    const params = chunk.flatMap((p) => [
      p.time, p.mmsi, p.imo, p.latitude, p.longitude,
      p.speed, p.course, p.heading, p.navStatus, p.lowConfidence,
    ]);
    await withDbRetry(`positions insert chunk ${i / CHUNK + 1}`, () =>
      pool.query(
        `INSERT INTO vessel_positions
         (time, mmsi, imo, latitude, longitude, speed, course, heading, nav_status, low_confidence)
         VALUES ${values}`, params
      )
    );
  }
  status.positionsInserted = rows.length;
}

// ── Time-budgeted steps ───────────────────────────────────────────────────────
/** Absolute wall-clock deadline (set in main from HARD_TIMEOUT_MS). */
let deadline = Number.POSITIVE_INFINITY;

/**
 * Run a non-core step under a time budget.
 *
 * Skipped (not failed) when the time left before the hard deadline can't cover
 * the budget, and abandoned if it overruns. Either way the harvest continues
 * and the problem lands in status.warnings — these steps never decide ok/not-ok.
 * This is what stops one slow external dependency from killing the whole run.
 */
async function step(name: string, budgetMs: number, fn: () => Promise<void>): Promise<void> {
  const remaining = deadline - Date.now();
  if (remaining < budgetMs) {
    warn(`${name} skipped — ${Math.round(remaining / 1000)}s left, needs ${Math.round(budgetMs / 1000)}s`);
    return;
  }
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`exceeded ${Math.round(budgetMs / 1000)}s budget`)),
          budgetMs
        );
      }),
    ]);
  } catch (err) {
    warn(`${name} failed — ${(err as Error).message}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── Run all detectors once ────────────────────────────────────────────────────
async function runDetectors(): Promise<void> {
  const going = await detectGoingDark();
  await generateAlertsForNewAnomalies('going_dark');

  const results = await Promise.allSettled([
    detectLoitering(), detectSpeedAnomaly(), detectDeviation(),
    detectRepeatGoingDark(), detectStsTransfers(), detectSpoofedPositions(),
  ]);
  const counts = results.map((r) => (r.status === 'fulfilled' ? r.value : 0));
  const routeTotal = counts.reduce((a, b) => a + b, 0);

  await computeRiskScores();
  await Promise.allSettled([
    generateAlertsForNewAnomalies('loitering'),
    generateAlertsForNewAnomalies('speed'),
    generateAlertsForNewAnomalies('deviation'),
    generateAlertsForNewAnomalies('repeat_going_dark'),
    generateAlertsForNewAnomalies('sts_transfer'),
    generateAlertsForNewAnomalies('spoofed_position'),
  ]);
  status.anomalies = going + routeTotal;
  console.log(`Detectors: ${going} going_dark + ${routeTotal} route anomalies`);
}

// ── Freshness-gated enrichment refresh ────────────────────────────────────────
async function isStale(sql: string, minutes: number): Promise<boolean> {
  try {
    const { rows } = await pool.query<{ ts: Date | null }>(sql);
    const ts = rows[0]?.ts;
    if (!ts) return true;
    return Date.now() - new Date(ts).getTime() > minutes * 60_000;
  } catch { return true; }
}

/** Prices: FRED (keyed API → keyless CSV) with Alpha Vantage fallback, every 3h.
 * Both failing throws, so the gate stays open and the warning goes amber —
 * never re-stamp stale rows as fresh. */
async function refreshPrices(): Promise<void> {
  if (!(await isStale(`SELECT MAX(fetched_at) AS ts FROM oil_prices`, 180))) return;
  let prices: OilPriceData[];
  try {
    prices = await fetchFREDPrices();
  } catch (fredErr) {
    try {
      prices = await fetchAlphaVantagePrices();
    } catch (avErr) {
      throw new Error(`FRED: ${(fredErr as Error).message}; Alpha Vantage: ${(avErr as Error).message}`);
    }
  }
  for (const p of prices) await insertPrice(p);
  status.pricesRefreshed = prices.length > 0;
  console.log(`Prices refreshed: ${prices.length}`);
}

/** News: keyless RSS, refresh at most every 25m. */
async function refreshNews(): Promise<void> {
  if (!(await isStale(`SELECT MAX(created_at) AS ts FROM news_items`, 25))) return;
  const news = await fetchNews();
  for (const n of news) await insertNewsItem(n);
  status.newsRefreshed = news.length;
  console.log(`News refreshed: ${news.length}`);
}

/** Sanctions: ~21k-row CSV, refresh at most every 20h (≈daily). */
async function refreshSanctions(): Promise<void> {
  if (!(await isStale(`SELECT MAX(updated_at) AS ts FROM vessel_sanctions`, 20 * 60))) return;
  await migrateSanctionsSchema();
  const entries = await fetchSanctionsList();
  const res = await batchUpsertSanctions(entries);
  status.sanctionsRefreshed = true;
  console.log(`Sanctions refreshed: ${res.upserted} upserted, ${res.deleted} removed`);
}

// ── Prune + size metrics ──────────────────────────────────────────────────────
async function pruneAndMeasure(): Promise<void> {
  const res = await pool.query(
    `DELETE FROM vessel_positions WHERE time < NOW() - ($1 || ' days')::interval`,
    [String(RETENTION_DAYS)]
  );
  status.pruned = res.rowCount ?? 0;
  console.log(`Pruned ${status.pruned} positions older than ${RETENTION_DAYS}d`);

  const { rows: countRows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM vessel_positions`
  );
  status.positionsTotal = parseInt(countRows[0].c, 10);

  const { rows: sizeRows } = await pool.query<{ db: string; tbl: string }>(
    `SELECT pg_database_size(current_database())::text AS db,
            pg_total_relation_size('vessel_positions')::text AS tbl`
  );
  status.dbSizeMB = Math.round(parseInt(sizeRows[0].db, 10) / 1e5) / 10;
  status.positionsSizeMB = Math.round(parseInt(sizeRows[0].tbl, 10) / 1e5) / 10;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const startedAt = Date.now();
  deadline = startedAt + HARD_TIMEOUT_MS;
  status.lastRun = new Date(startedAt).toISOString();

  const prev = readPrevStatus();
  const prevFailures = prev.consecutiveFailures ?? 0;
  status.consecutiveFailures = prevFailures + 1; // cleared below once the core lands
  status.lastOkRun = prev.lastOkRun ?? null;
  // Carried forward so the drought streak survives across runs — the whole
  // point is spotting a pattern no single run can see.
  status.consecutiveEmptyAisWindows = prev.consecutiveEmptyAisWindows ?? 0;
  status.aisOutageAlertSent = prev.aisOutageAlertSent ?? false;

  if (!process.env.DATABASE_URL || !process.env.AISSTREAM_API_KEY) {
    status.error = 'DATABASE_URL and AISSTREAM_API_KEY are required';
    console.error(status.error);
    writeStatus(startedAt);
    process.exit(1);
  }

  // Safety valve: guarantee termination even if a socket/query hangs. The
  // budgets above should make this unreachable; it stays as a backstop, and it
  // preserves whatever the core already achieved rather than reporting red.
  // Poll wall clock instead of a single setTimeout: Node timers pause while
  // the Mac sleeps, so a lid-close mid-run stretched the "360s" cap by exactly
  // the sleep duration (observed: 743s) and overlapped the next fire. With a
  // polling interval, the first tick after wake sees the expired deadline.
  const killer = setInterval(() => {
    if (Date.now() - startedAt < HARD_TIMEOUT_MS) return;
    status.error = 'hard timeout';
    console.error('Hard timeout reached — forcing exit');
    writeStatus(startedAt);
    process.exit(status.ok ? 0 : 1);
  }, 5_000);
  killer.unref();

  try {
    const { positions, statics } = await collectWindow();
    status.uniqueVessels = positions.size;
    console.log(`Window closed: ${status.messagesReceived} msgs, ${positions.size} unique positions, ${statics.size} static records`);

    // An empty window is a real condition (no network, AISStream down, a
    // darkwake half-sleep, a quiet patch of ocean), not a crash — but it must
    // not read as a clean run. Gate on positions, not raw messages: a window
    // can receive a stray static record and still land nothing on the map.
    if (positions.size === 0) {
      warn(`no AIS positions this window (${status.messagesReceived} msgs) — offline, AISStream unreachable, or Mac half-asleep`);
    }

    // Evaluated every run, not just empty ones: a window that lands positions
    // is what clears the streak and re-arms the alarm for the next outage.
    const outage = computeOutageAlert({
      emptyWindow: positions.size === 0,
      prevCount: status.consecutiveEmptyAisWindows,
      prevAlertSent: status.aisOutageAlertSent,
      threshold: AIS_OUTAGE_THRESHOLD,
    });
    status.consecutiveEmptyAisWindows = outage.count;
    status.aisOutageAlertSent = outage.alertSent;
    if (outage.shouldNotify) notifyOutage(outage.count);

    // Core: landing AIS data is what "ok" means.
    await upsertVessels(statics);   // vessels first (anomaly FK targets)
    await insertPositions(positions);
    status.ok = true;
    status.consecutiveFailures = 0;
    status.lastOkRun = status.lastRun;

    // Everything past here is best-effort and time-budgeted. Housekeeping runs
    // before enrichment so a slow external API can't starve the prune.
    // Budgets are sized from measured cost, not guessed: the detector pass is
    // the expensive one (~50-120s over the pooler); prune/prices/news/sanctions
    // are all seconds, so they get modest ceilings and the detectors get room.
    await step('detectors', 150_000, runDetectors);
    await step('prune + measure', 30_000, pruneAndMeasure);
    await step('prices refresh', 20_000, refreshPrices);
    await step('news refresh', 30_000, refreshNews);
    await step('sanctions refresh', 60_000, refreshSanctions);

    if (status.warnings.length > 0) status.error = `${status.warnings.length} step(s) degraded`;
    console.log(`Harvest OK in ${Date.now() - startedAt}ms (${status.warnings.length} warnings)`);
  } catch (err) {
    status.ok = false;
    status.error = (err as Error).message;
    console.error('Harvest failed:', err);
  } finally {
    writeStatus(startedAt);
    clearInterval(killer);
    try { await pool.end(); } catch { /* ignore */ }
  }
  process.exit(status.ok ? 0 : 1);
}

main();
