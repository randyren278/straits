/**
 * diagnose-coverage.ts — measure what each AIS source actually delivers, per region.
 *
 * Answers "why does Hormuz show zero contacts?" with numbers instead of guesses:
 *   1. AISStream, all six AIS_COVERAGE boxes, 60 s  → messages binned per box + chokepoint
 *   2. AISStream, Hormuz chokepoint box only, 60 s   → rules a multi-box subscription bug in/out
 *   3. AISStream, worldwide, ≤15 s                   → proves the key is live (control)
 *   4. VesselFinder fallback, per box + per chokepoint → what the fallback could add
 *   5. DB (read-only): distinct MMSIs per chokepoint, 24 h and 7 d, plus retained time span
 *
 * Writes .diagnostics/coverage-report.json. Read-only against the DB.
 *
 * Usage: npx tsx --env-file=.env.harvester scripts/diagnose-coverage.ts
 */
import WebSocket from 'ws';
import { mkdirSync, writeFileSync } from 'fs';
import { AIS_COVERAGE } from '../src/lib/geo/coverage-constants';
import { CHOKEPOINTS } from '../src/lib/geo/chokepoints-constants';
import { fetchMiddleEastAisFallback, type FallbackBounds } from '../src/services/ais-ingester/middle-east-fallback';
import { pool } from '../src/lib/db';

const KEY = process.env.AISSTREAM_API_KEY;
if (!KEY) { console.error('AISSTREAM_API_KEY is not set'); process.exit(1); }

const WINDOW_MS = Number(process.env.DIAG_WINDOW_MS ?? 60_000);
const CONTROL_MS = 15_000;

type Box = { minLat: number; minLon: number; maxLat: number; maxLon: number };
type Bin = { messages: number; uniqueMmsi: number };

const coverageBoxes: Record<string, Box> = Object.fromEntries(
  AIS_COVERAGE.map((b, i) => [`coverage:${i}`, b]),
);
const chokepointBoxes: Record<string, Box> = Object.fromEntries(
  Object.values(CHOKEPOINTS).map((cp) => [cp.id, cp.bounds]),
);

const inBox = (lat: number, lon: number, b: Box) =>
  lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;

function binPositions(points: Array<{ mmsi: string; lat: number; lon: number }>) {
  const bin = (boxes: Record<string, Box>) => {
    const out: Record<string, Bin> = {};
    for (const [id, b] of Object.entries(boxes)) {
      const hits = points.filter((p) => inBox(p.lat, p.lon, b));
      out[id] = { messages: hits.length, uniqueMmsi: new Set(hits.map((p) => p.mmsi)).size };
    }
    return out;
  };
  return { boxes: bin(coverageBoxes), chokepoints: bin(chokepointBoxes) };
}

function streamWindow(label: string, boxes: Box[], ms: number, stopOnFirst = false) {
  return new Promise<{ messages: number; positionReports: number; firstMessageMs: number | null; points: Array<{ mmsi: string; lat: number; lon: number }>; error: string | null }>((resolve) => {
    const started = Date.now();
    const points: Array<{ mmsi: string; lat: number; lon: number }> = [];
    let messages = 0, positionReports = 0, firstMessageMs: number | null = null, error: string | null = null, settled = false;
    console.log(`[${label}] connecting, ${boxes.length} box(es), ${ms} ms`);
    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* closing */ }
      console.log(`[${label}] done: ${messages} messages, ${positionReports} position reports`);
      resolve({ messages, positionReports, firstMessageMs, points, error });
    };
    const timer = setTimeout(finish, ms);
    ws.on('open', () => ws.send(JSON.stringify({
      APIKey: KEY,
      BoundingBoxes: boxes.map((b) => [[b.minLat, b.minLon], [b.maxLat, b.maxLon]]),
      FilterMessageTypes: ['PositionReport'],
    })));
    ws.on('message', (data: WebSocket.Data) => {
      messages++;
      if (firstMessageMs === null) firstMessageMs = Date.now() - started;
      let msg: any;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.error) { error = String(msg.error); finish(); return; }
      const m = msg.Message?.PositionReport;
      if (msg.MessageType === 'PositionReport' && m && typeof m.Latitude === 'number' && typeof m.Longitude === 'number') {
        positionReports++;
        points.push({ mmsi: String(msg.MetaData?.MMSI ?? ''), lat: m.Latitude, lon: m.Longitude });
      }
      if (stopOnFirst) finish();
    });
    ws.on('error', (e: Error) => { error = e.message; finish(); });
    ws.on('close', finish);
  });
}

async function vesselFinderCounts() {
  const perBox: Record<string, Bin | { error: string }> = {};
  const probe = async (id: string, b: Box) => {
    try {
      const rows = await fetchMiddleEastAisFallback([b as FallbackBounds]);
      perBox[id] = { messages: rows.length, uniqueMmsi: new Set(rows.map((r) => r.mmsi)).size };
    } catch (e) {
      perBox[id] = { error: (e as Error).message };
    }
    console.log(`[vesselfinder] ${id}: ${JSON.stringify(perBox[id])}`);
  };
  for (const [id, b] of Object.entries(coverageBoxes)) await probe(id, b);
  const boxes = { ...perBox };
  for (const k of Object.keys(perBox)) delete perBox[k];
  for (const [id, b] of Object.entries(chokepointBoxes)) await probe(id, b);
  return { boxes, chokepoints: { ...perBox } };
}

async function dbCounts() {
  const out: Record<string, { mmsi24h: number; mmsi7d: number }> = {};
  for (const [id, b] of Object.entries(chokepointBoxes)) {
    const r = await pool.query<{ h24: string; d7: string }>(
      `SELECT
         COUNT(DISTINCT mmsi) FILTER (WHERE time > NOW() - INTERVAL '24 hours')::text AS h24,
         COUNT(DISTINCT mmsi)::text AS d7
       FROM vessel_positions
       WHERE time > NOW() - INTERVAL '7 days'
         AND latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`,
      [b.minLat, b.maxLat, b.minLon, b.maxLon],
    );
    out[id] = { mmsi24h: Number(r.rows[0].h24), mmsi7d: Number(r.rows[0].d7) };
  }
  const span = await pool.query<{ oldest: Date | null; newest: Date | null; rows: string }>(
    'SELECT MIN(time) AS oldest, MAX(time) AS newest, COUNT(*)::text AS rows FROM vessel_positions',
  );
  return { chokepoints: out, positions: { oldest: span.rows[0].oldest, newest: span.rows[0].newest, rows: Number(span.rows[0].rows) } };
}

async function main() {
  const all = await streamWindow('aisstream all boxes', Object.values(coverageBoxes), WINDOW_MS);
  const hormuzOnly = await streamWindow('aisstream hormuz only', [chokepointBoxes.hormuz], WINDOW_MS);
  const control = await streamWindow('aisstream world control', [{ minLat: -90, minLon: -180, maxLat: 90, maxLon: 180 }], CONTROL_MS, true);
  const vesselfinder = await vesselFinderCounts();
  const db = await dbCounts();
  await pool.end();

  const report = {
    generated_at: new Date().toISOString(),
    window_ms: WINDOW_MS,
    coverage_box_index: Object.fromEntries(AIS_COVERAGE.map((b, i) => [`coverage:${i}`, b])),
    aisstream_all_boxes: { messages: all.messages, positionReports: all.positionReports, firstMessageMs: all.firstMessageMs, error: all.error, ...binPositions(all.points) },
    aisstream_hormuz_only: { messages: hormuzOnly.messages, positionReports: hormuzOnly.positionReports, firstMessageMs: hormuzOnly.firstMessageMs, error: hormuzOnly.error, ...binPositions(hormuzOnly.points) },
    aisstream_world_control: { messages: control.messages, firstMessageMs: control.firstMessageMs, error: control.error },
    vesselfinder,
    db,
  };
  mkdirSync('.diagnostics', { recursive: true });
  writeFileSync('.diagnostics/coverage-report.json', JSON.stringify(report, null, 2));
  console.log('\nwrote .diagnostics/coverage-report.json');
  console.log(JSON.stringify({
    aisstream_all_boxes: report.aisstream_all_boxes.chokepoints,
    aisstream_hormuz_only: report.aisstream_hormuz_only.chokepoints,
    world_control_messages: control.messages,
    vesselfinder: vesselfinder.chokepoints,
    db: db.chokepoints,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
