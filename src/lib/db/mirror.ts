/**
 * Local mirror of the harvester's own Supabase tables.
 *
 * Each harvest used to re-read ~8 MB from Supabase — rows it had written
 * minutes earlier — and that blew the org's 5 GB/month egress quota (Oct
 * 2026). The harvester now keeps exact copies of vessel_positions (recent
 * days), vessels, vessel_fallback_metadata and its track-engine state in a
 * Postgres on this Mac, and sends its heavy reads there (src/lib/db/reader.ts).
 *
 * Supabase stays the source of truth; the mirror is a verified, exact copy:
 *  - Positions: drop what Supabase has pruned, download only rows newer than
 *    the newest mirrored row (normally just this run's), then compare per-hour
 *    checksums of the whole table (one ~7 KB query per side) and re-copy any
 *    hour that still differs. A copy is read inside one REPEATABLE READ
 *    snapshot together with that snapshot's checksums, then re-checked
 *    locally.
 *  - vessels / fallback metadata: pull rows whose last_seen moved, then verify
 *    whole-table checksums and repair any key bucket that still differs.
 *  - A repaired range that still disagrees trips a breaker that pauses repairs
 *    for 6h; without it, a checksum disagreement would re-download everything
 *    every run. A rolling 24h repair budget bounds bootstrap and rebuild cost.
 * Anything not verified in a run leaves `ready` false, and the harvester reads
 * Supabase for that run exactly as it did before the mirror existed.
 *
 * Checksums use only setting-independent forms (epoch microseconds, raw float
 * bits) because Supabase's pooled sessions round float text to 15 digits.
 * Copies are read under SET LOCAL extra_float_digits = 3 so they are exact.
 */
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { Reader } from './reader';

/** Bump when the mirror tables change; the mirror is rebuilt, not migrated. */
export const MIRROR_SCHEMA_VERSION = 1;

const HOUR_MS = 3_600_000;
const BREAKER_MS = 6 * HOUR_MS;

type Kind = 'text' | 'int' | 'bool' | 'ts' | 'f8' | 'f4';
interface Col { name: string; kind: Kind; type: string }
interface TableSpec { table: string; cols: Col[]; key?: string }

const col = (name: string, kind: Kind, type: string): Col => ({ name, kind, type });

const POSITIONS: TableSpec = {
  table: 'vessel_positions',
  cols: [
    col('time', 'ts', 'timestamptz'), col('mmsi', 'text', 'varchar'), col('imo', 'text', 'varchar'),
    col('latitude', 'f8', 'float8'), col('longitude', 'f8', 'float8'),
    col('speed', 'f4', 'real'), col('course', 'f4', 'real'), col('heading', 'f4', 'real'),
    col('nav_status', 'int', 'int4'), col('low_confidence', 'bool', 'bool'), col('source', 'text', 'text'),
  ],
};
const VESSELS: TableSpec = {
  table: 'vessels', key: 'imo',
  cols: [
    col('imo', 'text', 'varchar'), col('mmsi', 'text', 'varchar'), col('name', 'text', 'varchar'),
    col('flag', 'text', 'varchar'), col('ship_type', 'int', 'int4'), col('destination', 'text', 'varchar'),
    col('last_seen', 'ts', 'timestamptz'), col('created_at', 'ts', 'timestamptz'),
  ],
};
const FALLBACK: TableSpec = {
  table: 'vessel_fallback_metadata', key: 'mmsi',
  cols: [
    col('mmsi', 'text', 'varchar'), col('name', 'text', 'varchar'), col('ship_type', 'int', 'int4'),
    col('last_seen', 'ts', 'timestamptz'), col('source', 'text', 'varchar'),
  ],
};
const LANE: TableSpec = {
  table: 'lane_density', key: 'cell',
  cols: [col('cell', 'int', 'int4'), col('w', 'f4', 'real'), col('updated_at', 'ts', 'timestamptz')],
};

// Production column types and nullability (Supabase, Oct 2026), minus
// vessel_positions.raw_message, which nothing on the read side uses.
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS vessel_positions (
    time TIMESTAMPTZ NOT NULL, mmsi VARCHAR(9) NOT NULL, imo VARCHAR(10),
    latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL,
    speed REAL, course REAL, heading REAL, nav_status INTEGER,
    low_confidence BOOLEAN DEFAULT FALSE, source TEXT);
  CREATE INDEX IF NOT EXISTS idx_positions_mmsi_time ON vessel_positions (mmsi, time DESC);
  CREATE INDEX IF NOT EXISTS idx_positions_time ON vessel_positions (time DESC);
  CREATE TABLE IF NOT EXISTS vessels (
    imo VARCHAR(10) PRIMARY KEY, mmsi VARCHAR(9) NOT NULL, name VARCHAR(255) NOT NULL,
    flag VARCHAR(2), ship_type INTEGER, destination VARCHAR(255),
    last_seen TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_vessels_mmsi ON vessels (mmsi);
  CREATE TABLE IF NOT EXISTS vessel_fallback_metadata (
    mmsi VARCHAR(9) PRIMARY KEY, name VARCHAR(255) NOT NULL, ship_type INTEGER,
    last_seen TIMESTAMPTZ NOT NULL, source VARCHAR(40) NOT NULL);
  CREATE TABLE IF NOT EXISTS lane_density (cell INTEGER PRIMARY KEY, w REAL NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
  CREATE TABLE IF NOT EXISTS track_engine_state (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
`;

/**
 * Pool for the local mirror. Its sessions match Supabase's pooled sessions —
 * UTC, ISO dates, floats rounded to 15 digits — so a mirrored read returns
 * exactly what the Supabase read it replaces would have.
 */
export function createMirrorPool(url: string): Pool {
  const local = new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 3_000,
    // Client-side: a hung (not dead) mirror never answers, so the server-side
    // statement_timeout below would never fire. A timed-out query rejects and
    // its connection is discarded; mirrorReader then falls back to Supabase.
    query_timeout: 30_000,
    options: '-c TimeZone=UTC -c DateStyle=ISO,MDY -c extra_float_digits=0 -c statement_timeout=60000',
  });
  // An idle client dying (mirror restarted, Mac slept) is emitted on the pool;
  // unhandled, that event would crash the harvest. The next query reconnects.
  local.on('error', () => {});
  return local;
}

export async function ensureMirrorSchema(local: Pool): Promise<void> {
  await local.query('CREATE TABLE IF NOT EXISTS mirror_meta (key TEXT PRIMARY KEY, value JSONB NOT NULL)');
  const { rows } = await local.query<{ value: unknown }>("SELECT value FROM mirror_meta WHERE key = 'schema_version'");
  if (rows[0]?.value !== MIRROR_SCHEMA_VERSION) {
    await local.query('DROP TABLE IF EXISTS vessel_positions, vessels, vessel_fallback_metadata, lane_density, track_engine_state');
    await local.query('DELETE FROM mirror_meta');
  }
  await local.query(SCHEMA_SQL);
  await writeMeta(local, 'schema_version', MIRROR_SCHEMA_VERSION);
}

// ── Checksums ────────────────────────────────────────────────────────────────
function canon(c: Col): string {
  switch (c.kind) {
    case 'ts': return `coalesce(((extract(epoch FROM ${c.name}) * 1000000)::bigint)::text, '\\N')`;
    case 'f8': return `coalesce(encode(float8send(${c.name}), 'hex'), '\\N')`;
    case 'f4': return `coalesce(encode(float4send(${c.name}), 'hex'), '\\N')`;
    default: return `coalesce(${c.name}::text, '\\N')`;
  }
}
function rowHash(spec: TableSpec): string {
  return `('x' || substr(md5(concat_ws('|', ${spec.cols.map(canon).join(', ')})), 1, 8))::bit(32)::int`;
}

export interface BucketRow { h: string; n: string; hash: string }

const HOUR_OF = 'floor(extract(epoch FROM time) / 3600)::bigint';
const POSITION_BUCKETS = `SELECT ${HOUR_OF} AS h, count(*) AS n, coalesce(sum(${rowHash(POSITIONS)}), 0) AS hash
  FROM vessel_positions`;
const positionBucketsSql = (bounded: boolean) =>
  `${POSITION_BUCKETS}${bounded ? ' WHERE time >= to_timestamp($1) AND time < to_timestamp($2)' : ''} GROUP BY 1`;

const keyBucketsSql = (spec: TableSpec) =>
  `SELECT substr(md5(${spec.key}::text), 1, 1) AS h, count(*) AS n, coalesce(sum(${rowHash(spec)}), 0) AS hash
   FROM ${spec.table} GROUP BY 1`;
const totalsSql = (spec: TableSpec) =>
  `SELECT '*' AS h, count(*) AS n, coalesce(sum(${rowHash(spec)}), 0) AS hash FROM ${spec.table}`;

function differingKeys(remote: BucketRow[], local: BucketRow[]): string[] {
  const sig = (b: BucketRow) => `${b.n}:${b.hash}`;
  const r = new Map(remote.map((b) => [String(b.h), sig(b)]));
  const l = new Map(local.map((b) => [String(b.h), sig(b)]));
  return [...new Set([...r.keys(), ...l.keys()])].filter((k) => r.get(k) !== l.get(k));
}

/** Hours (epoch hour numbers) whose checksum differs or exist on one side only, newest first. */
export function diffBuckets(remote: BucketRow[], local: BucketRow[]): number[] {
  return differingKeys(remote, local).map(Number).sort((a, b) => b - a);
}

/** Contiguous hours → [start, endExclusive) ranges of at most `maxChunk` hours, in the given order. */
export function chunkHours(hours: number[], maxChunk: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const h of hours) {
    const last = out[out.length - 1];
    if (last && last[0] === h + 1 && last[1] - last[0] < maxChunk) last[0] = h;
    else out.push([h, h + 1]);
  }
  return out;
}

// ── Exact copies ─────────────────────────────────────────────────────────────
type RawRow = (string | null)[];
/** Every column as the server's own text, so copies round-trip bit-exactly. */
const RAW_TEXT = { getTypeParser: () => (value: string) => value };

class MirrorIntegrityError extends Error {}

async function withClient<T>(p: Pool, begin: string, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await p.connect();
  let failure: Error | undefined;
  try {
    await c.query(begin);
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (err) {
    failure = err as Error;
    await c.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    // A client that failed may have a dead connection; never pool it again.
    c.release(failure);
  }
}

/**
 * One consistent remote snapshot. SET LOCAL is scoped to the transaction; a
 * bare SET would leak into other Supavisor-pooled sessions (src/lib/db/index.ts).
 */
const inRemoteSnapshot = <T>(remote: Pool, fn: (c: PoolClient) => Promise<T>) => withClient(remote,
  "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL extra_float_digits = 3; SET LOCAL TimeZone = 'UTC'; SET LOCAL DateStyle = 'ISO, MDY'",
  fn);
const inLocalTxn = <T>(local: Pool, fn: (c: PoolClient) => Promise<T>) => withClient(local, 'BEGIN', fn);

async function rawRows(c: PoolClient, text: string, values: unknown[] = []): Promise<RawRow[]> {
  const r = await c.query({ text, values, rowMode: 'array', types: RAW_TEXT });
  return r.rows as RawRow[];
}

const colNames = (spec: TableSpec) => spec.cols.map((c) => c.name).join(', ');
const rawBytes = (rows: RawRow[]) => rows.reduce((sum, r) => sum + r.reduce((s, v) => s + (v?.length ?? 0) + 1, 0), 0);

async function insertRaw(c: PoolClient, spec: TableSpec, rows: RawRow[], upsert = false): Promise<void> {
  const conflict = upsert && spec.key
    ? ` ON CONFLICT (${spec.key}) DO UPDATE SET ${spec.cols.filter((x) => x.name !== spec.key).map((x) => `${x.name} = EXCLUDED.${x.name}`).join(', ')}`
    : '';
  const casts = spec.cols.map((x, i) => `$${i + 1}::${x.type}[]`).join(', ');
  for (let i = 0; i < rows.length; i += 5000) {
    const chunk = rows.slice(i, i + 5000);
    await c.query(
      `INSERT INTO ${spec.table} (${colNames(spec)}) SELECT * FROM unnest(${casts})${conflict}`,
      spec.cols.map((_, j) => chunk.map((r) => r[j])),
    );
  }
}

// ── Bookkeeping (mirror_meta) ────────────────────────────────────────────────
async function readMeta<T>(local: Pool, key: string): Promise<T | null> {
  const { rows } = await local.query<{ value: T }>('SELECT value FROM mirror_meta WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}
async function writeMeta(local: Pool, key: string, value: unknown): Promise<void> {
  await local.query(
    'INSERT INTO mirror_meta (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    [key, JSON.stringify(value)],
  );
}

interface RepairEntry { at: number; bytes: number }
async function repairBytes24h(local: Pool): Promise<number> {
  const log = (await readMeta<RepairEntry[]>(local, 'repairs')) ?? [];
  return log.filter((e) => e.at > Date.now() - 24 * HOUR_MS).reduce((s, e) => s + e.bytes, 0);
}
async function logRepair(local: Pool, bytes: number): Promise<void> {
  if (bytes === 0) return;
  const log = ((await readMeta<RepairEntry[]>(local, 'repairs')) ?? []).filter((e) => e.at > Date.now() - 24 * HOUR_MS);
  await writeMeta(local, 'repairs', [...log, { at: Date.now(), bytes }]);
}

// ── Sync ─────────────────────────────────────────────────────────────────────
export interface MirrorSyncOptions {
  now: Date;
  /** Wall-clock ms after which no new repair is started. */
  deadline: number;
  /** Rolling-24h cap on bytes pulled for repairs and bootstrap. */
  repairBudgetBytes: number;
  /** Hours copied per remote round trip (default 12). */
  maxChunkHours?: number;
}

/** Only a mirror this current is topped up by the tail; older gaps go through budgeted repair. */
const TAIL_MAX_AGE_MS = 2 * HOUR_MS;
/** Rows dated further ahead than this are ignored when finding the tail's start. */
const TAIL_FUTURE_SLACK_MS = 5 * 60_000;

export interface MirrorSyncResult {
  ready: boolean;
  /** Why the mirror is not ready; null when it is. */
  reason: string | null;
  bucketsChecked: number;
  bucketsRepaired: number;
  bucketsPending: number;
  rowsPulled: number;
  bytesPulled: number;
}

class BudgetExhausted extends Error {}

async function syncKeyed(remote: Pool, local: Pool, spec: TableSpec, budgetBytes: number, result: MirrorSyncResult): Promise<void> {
  const pulled = async (rows: RawRow[]) => {
    const bytes = rawBytes(rows);
    result.rowsPulled += rows.length;
    result.bytesPulled += bytes;
    await logRepair(local, bytes);
  };

  // 1. Rows whose last_seen moved past the newest one mirrored (every harvester
  //    write bumps it). An empty mirror copies the whole table.
  const { rows: [mark] } = await local.query({ text: `SELECT max(last_seen) AS ts FROM ${spec.table}`, types: RAW_TEXT });
  const since = (mark as { ts: string | null }).ts;
  if (since === null && (await repairBytes24h(local)) >= budgetBytes) throw new BudgetExhausted();
  const fresh = await inRemoteSnapshot(remote, (c) => since === null
    ? rawRows(c, `SELECT ${colNames(spec)} FROM ${spec.table}`)
    : rawRows(c, `SELECT ${colNames(spec)} FROM ${spec.table} WHERE last_seen > $1::timestamptz`, [since]));
  if (fresh.length) {
    await inLocalTxn(local, (c) => insertRaw(c, spec, fresh, true));
    await pulled(fresh);
  }

  // 2. Verify the whole table; repair only the key buckets that still differ
  //    (deletions, or changes that did not touch last_seen).
  const [r, l] = await Promise.all([remote.query<BucketRow>(totalsSql(spec)), local.query<BucketRow>(totalsSql(spec))]);
  if (differingKeys(r.rows, l.rows).length === 0) return;

  const [rb, lb] = await Promise.all([remote.query<BucketRow>(keyBucketsSql(spec)), local.query<BucketRow>(keyBucketsSql(spec))]);
  for (const bucket of differingKeys(rb.rows, lb.rows)) {
    if ((await repairBytes24h(local)) >= budgetBytes) throw new BudgetExhausted();
    const where = `substr(md5(${spec.key}::text), 1, 1) = $1`;
    const snap = await inRemoteSnapshot(remote, async (c) => ({
      rows: await rawRows(c, `SELECT ${colNames(spec)} FROM ${spec.table} WHERE ${where}`, [bucket]),
      sums: (await c.query<BucketRow>(keyBucketsSql(spec))).rows.filter((b) => b.h === bucket),
    }));
    await inLocalTxn(local, async (c) => {
      await c.query(`DELETE FROM ${spec.table} WHERE ${where}`, [bucket]);
      await insertRaw(c, spec, snap.rows);
    });
    await pulled(snap.rows);
    const after = (await local.query<BucketRow>(keyBucketsSql(spec))).rows.filter((b) => b.h === bucket);
    if (differingKeys(snap.sums, after).length) throw new MirrorIntegrityError(`${spec.table} bucket ${bucket} still differs after copy`);
  }
}

/**
 * Steady state: download only rows newer than the newest mirrored one (this
 * run's inserts), replacing that tail range locally. A row that arrives with
 * an older timestamp is left to the hourly checksums, which catch it.
 */
async function pullPositionsTail(remote: Pool, local: Pool, now: Date, result: MirrorSyncResult): Promise<void> {
  const { rows: [mark] } = await local.query({
    text: 'SELECT max(time) AS ts, max(time) > $1 AS fresh FROM vessel_positions WHERE time <= $2',
    values: [new Date(now.getTime() - TAIL_MAX_AGE_MS), new Date(now.getTime() + TAIL_FUTURE_SLACK_MS)],
    types: RAW_TEXT,
  });
  const { ts, fresh } = mark as { ts: string | null; fresh: string | null };
  if (ts === null || fresh !== 't') return;
  const rows = await inRemoteSnapshot(remote, (c) =>
    rawRows(c, `SELECT ${colNames(POSITIONS)} FROM vessel_positions WHERE time > $1::timestamptz`, [ts]));
  await inLocalTxn(local, async (c) => {
    await c.query('DELETE FROM vessel_positions WHERE time > $1::timestamptz', [ts]);
    await insertRaw(c, POSITIONS, rows);
  });
  const bytes = rawBytes(rows);
  result.rowsPulled += rows.length;
  result.bytesPulled += bytes;
  await logRepair(local, bytes);
}

async function repairPositions(remote: Pool, local: Pool, hours: [number, number], result: MirrorSyncResult): Promise<void> {
  const [from, to] = [hours[0] * 3600, hours[1] * 3600];
  const snap = await inRemoteSnapshot(remote, async (c) => ({
    rows: await rawRows(c, `SELECT ${colNames(POSITIONS)} FROM vessel_positions WHERE time >= to_timestamp($1) AND time < to_timestamp($2)`, [from, to]),
    sums: (await c.query<BucketRow>(positionBucketsSql(true), [from, to])).rows,
  }));
  await inLocalTxn(local, async (c) => {
    await c.query('DELETE FROM vessel_positions WHERE time >= to_timestamp($1) AND time < to_timestamp($2)', [from, to]);
    await insertRaw(c, POSITIONS, snap.rows);
  });
  const bytes = rawBytes(snap.rows);
  result.rowsPulled += snap.rows.length;
  result.bytesPulled += bytes;
  await logRepair(local, bytes);
  const after = (await local.query<BucketRow>(positionBucketsSql(true), [from, to])).rows;
  if (diffBuckets(snap.sums, after).length) throw new MirrorIntegrityError(`positions ${new Date(from * 1000).toISOString()}+${hours[1] - hours[0]}h still differ after copy`);
  result.bucketsRepaired += hours[1] - hours[0];
}

/**
 * Bring the mirror up to date with Supabase and report whether every mirrored
 * table was verified identical. Never throws: any failure is a not-ready
 * result with a reason the harvester surfaces as a warning.
 */
export async function syncMirror(remote: Pool, local: Pool, o: MirrorSyncOptions): Promise<MirrorSyncResult> {
  const result: MirrorSyncResult = { ready: false, reason: null, bucketsChecked: 0, bucketsRepaired: 0, bucketsPending: 0, rowsPulled: 0, bytesPulled: 0 };
  try {
    await ensureMirrorSchema(local);
    const breaker = await readMeta<{ until: number; reason: string }>(local, 'breaker');
    if (breaker && breaker.until > Date.now()) {
      result.reason = `repairs paused until ${new Date(breaker.until).toISOString()} after: ${breaker.reason}`;
      return result;
    }

    await syncKeyed(remote, local, VESSELS, o.repairBudgetBytes, result);
    await syncKeyed(remote, local, FALLBACK, o.repairBudgetBytes, result);

    // Mirror Supabase's prune: nothing older than its oldest row survives here.
    const { rows: [oldest] } = await remote.query({ text: 'SELECT min(time) AS ts FROM vessel_positions', types: RAW_TEXT });
    const remoteMin = (oldest as { ts: string | null }).ts;
    if (remoteMin === null) await local.query('DELETE FROM vessel_positions');
    else await local.query('DELETE FROM vessel_positions WHERE time < $1::timestamptz', [remoteMin]);

    await pullPositionsTail(remote, local, o.now, result);
    const [rb, lb] = await Promise.all([
      remote.query<BucketRow>(positionBucketsSql(false)),
      local.query<BucketRow>(positionBucketsSql(false)),
    ]);
    result.bucketsChecked = new Set([...rb.rows, ...lb.rows].map((b) => String(b.h))).size;
    const differing = diffBuckets(rb.rows, lb.rows);
    let budgetHit = false;
    for (const hours of chunkHours(differing, o.maxChunkHours ?? 12)) {
      if (Date.now() > o.deadline) break;
      if ((await repairBytes24h(local)) >= o.repairBudgetBytes) { budgetHit = true; break; }
      await repairPositions(remote, local, hours, result);
    }
    result.bucketsPending = differing.length - result.bucketsRepaired;
    if (result.bucketsPending > 0) {
      result.reason = `${budgetHit ? `repair budget (${(o.repairBudgetBytes / 1e6).toFixed(0)} MB/24h) reached; ` : ''}${result.bucketsPending} hour(s) still to copy`;
    }
  } catch (err) {
    if (err instanceof MirrorIntegrityError) {
      const until = Date.now() + BREAKER_MS;
      await writeMeta(local, 'breaker', { until, reason: err.message }).catch(() => {});
      result.reason = `integrity check failed (${err.message}); repairs paused until ${new Date(until).toISOString()}`;
    } else if (err instanceof BudgetExhausted) {
      result.reason = `repair budget (${(o.repairBudgetBytes / 1e6).toFixed(0)} MB/24h) reached before the mirror was complete`;
    } else {
      result.reason = `mirror unavailable: ${(err as Error).message}`;
    }
  }
  result.ready = result.reason === null;
  return result;
}

/**
 * Reads go to the mirror until the first local failure, then to Supabase for
 * the rest of the run — a mirror dying mid-run costs egress, never a result.
 */
export function mirrorReader(local: Reader, remote: Reader, onFallback: (err: Error) => void): Reader {
  let useRemote = false;
  return {
    async query<R extends QueryResultRow>(text: string, values?: unknown[]) {
      if (!useRemote) {
        try {
          return await local.query<R>(text, values);
        } catch (err) {
          if (!useRemote) {
            useRemote = true;
            onFallback(err as Error);
          }
        }
      }
      return remote.query<R>(text, values);
    },
  };
}

// ── Track-engine state ───────────────────────────────────────────────────────
export interface LaneRow { cell: number; w: number; updated_at: Date }

const LANE_TOTALS = totalsSql(LANE);
const LEARN_VERSION = `SELECT ((extract(epoch FROM updated_at) * 1000000)::bigint)::text AS v FROM track_engine_state WHERE key = 'learn'`;

/**
 * lane_density, served from the mirror when its checksum matches Supabase's
 * (one tiny query) and re-copied otherwise. Always returned from the mirror so
 * both paths parse identically to a direct Supabase read.
 */
export async function loadLaneRowsMirrored(remote: Pool, local: Pool): Promise<{ rows: LaneRow[]; source: 'mirror' | 'supabase' }> {
  const [r, l] = await Promise.all([remote.query<BucketRow>(LANE_TOTALS), local.query<BucketRow>(LANE_TOTALS)]);
  let source: 'mirror' | 'supabase' = 'mirror';
  if (differingKeys(r.rows, l.rows).length) {
    const snap = await inRemoteSnapshot(remote, async (c) => ({
      rows: await rawRows(c, `SELECT ${colNames(LANE)} FROM lane_density`),
      sums: (await c.query<BucketRow>(LANE_TOTALS)).rows,
    }));
    await inLocalTxn(local, async (c) => {
      await c.query('DELETE FROM lane_density');
      await insertRaw(c, LANE, snap.rows);
    });
    const after = (await local.query<BucketRow>(LANE_TOTALS)).rows;
    if (differingKeys(snap.sums, after).length) throw new Error('lane_density still differs after copy');
    source = 'supabase';
  }
  const { rows } = await local.query<LaneRow>(`SELECT ${colNames(LANE)} FROM lane_density`);
  return { rows, source };
}

/** The track engine's learn state, by the same rule, versioned by updated_at. */
export async function loadLearnMirrored(remote: Pool, local: Pool): Promise<{ value: unknown; source: 'mirror' | 'supabase' }> {
  const [r, l] = await Promise.all([remote.query<{ v: string }>(LEARN_VERSION), local.query<{ v: string }>(LEARN_VERSION)]);
  const version = r.rows[0]?.v;
  if (version === undefined) return { value: null, source: 'supabase' };
  let source: 'mirror' | 'supabase' = 'mirror';
  if (l.rows[0]?.v !== version) {
    const [row] = await inRemoteSnapshot(remote, (c) =>
      rawRows(c, "SELECT key, value::text, updated_at FROM track_engine_state WHERE key = 'learn'"));
    await local.query(
      `INSERT INTO track_engine_state (key, value, updated_at) VALUES ($1, $2::jsonb, $3::timestamptz)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`, row);
    source = 'supabase';
  }
  const { rows } = await local.query<{ value: unknown }>("SELECT value FROM track_engine_state WHERE key = 'learn'");
  return { value: rows[0]?.value ?? null, source };
}

/**
 * After saveEngineRun + saveLaneDensity succeeded on Supabase: copy what they
 * wrote, so the next run reads it locally. Learn state is stored from the JSON
 * the harvester just sent (with Supabase's updated_at as its version); lane
 * cells are re-read exactly — only the few touched this run.
 */
export async function recordTrackStateSaved(
  remote: Pool, local: Pool, saved: { learnJson: string; touchedCells: number[] },
): Promise<void> {
  const snap = await inRemoteSnapshot(remote, async (c) => ({
    learnAt: (await rawRows(c, "SELECT updated_at FROM track_engine_state WHERE key = 'learn'"))[0]?.[0] ?? null,
    lane: saved.touchedCells.length
      ? await rawRows(c, `SELECT ${colNames(LANE)} FROM lane_density WHERE cell = ANY($1::int[])`, [saved.touchedCells])
      : [],
  }));
  await inLocalTxn(local, async (c) => {
    if (snap.learnAt !== null) {
      await c.query(
        `INSERT INTO track_engine_state (key, value, updated_at) VALUES ('learn', $1::jsonb, $2::timestamptz)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [saved.learnJson, snap.learnAt]);
    }
    await insertRaw(c, LANE, snap.lane, true);
  });
}
