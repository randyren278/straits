/**
 * Local mirror — integration tests against a real Postgres.
 *
 * Two scratch databases on the local mirror server stand in for Supabase
 * ("remote", configured with Supabase's extra_float_digits = 0 so float text is
 * rounded exactly as the pooler rounds it) and the Mac's mirror ("local").
 * Skipped when no server is reachable (CI without Postgres).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import { PG_ADMIN_URL, pgAvailable, pgUrl } from '../../../tests/postgres';
import {
  createMirrorPool, ensureMirrorSchema, syncMirror, mirrorReader, diffBuckets, chunkHours,
  loadLaneRowsMirrored, loadLearnMirrored, recordTrackStateSaved, MIRROR_SCHEMA_VERSION,
  type MirrorSyncOptions,
} from './mirror';

const ADMIN_URL = PG_ADMIN_URL;
// Per-process names: concurrent test runs must never drop each other's databases.
const REMOTE_DB = `mirror_it_remote_${process.pid}`;
const LOCAL_DB = `mirror_it_local_${process.pid}`;

const available = await pgAvailable();
// Real database work (CREATE/DROP DATABASE, bulk copies) can be slow on a busy
// machine or CI runner; the 5s/10s defaults turned load into false failures.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

// Production column types (information_schema, Oct 2026), including the
// unmirrored raw_message column the mirror must not depend on.
const REMOTE_SCHEMA = `
  CREATE TABLE vessel_positions (
    time TIMESTAMPTZ NOT NULL, mmsi VARCHAR(9) NOT NULL, imo VARCHAR(10),
    latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL,
    speed REAL, course REAL, heading REAL, nav_status INTEGER,
    low_confidence BOOLEAN DEFAULT FALSE, raw_message JSONB, source TEXT);
  CREATE TABLE vessels (
    imo VARCHAR(10) PRIMARY KEY, mmsi VARCHAR(9) NOT NULL, name VARCHAR(255) NOT NULL,
    flag VARCHAR(2), ship_type INTEGER, destination VARCHAR(255),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE vessel_fallback_metadata (
    mmsi VARCHAR(9) PRIMARY KEY, name VARCHAR(255) NOT NULL, ship_type INTEGER,
    last_seen TIMESTAMPTZ NOT NULL, source VARCHAR(40) NOT NULL);
  CREATE TABLE lane_density (cell INTEGER PRIMARY KEY, w REAL NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE track_engine_state (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
`;

let admin: Pool;
let remote: Pool;
let local: Pool;
const NOW = new Date('2026-10-07T12:30:00Z');
const HOUR = 3600_000;

function opts(overrides: Partial<MirrorSyncOptions> = {}): MirrorSyncOptions {
  return { now: NOW, deadline: Date.now() + 60_000, repairBudgetBytes: 50_000_000, ...overrides };
}

/**
 * A stand-in for Supabase's pooled sessions: UTC (unless overridden) and floats
 * rounded to 15 digits. afterAll's DROP DATABASE … WITH (FORCE) can terminate a
 * connection pool.end() is still closing, which pg-pool re-emits as an error.
 */
function remotePool(timeZone = 'UTC'): Pool {
  const p = new Pool({ connectionString: pgUrl(REMOTE_DB), options: `-c extra_float_digits=0 -c TimeZone=${timeZone}` });
  p.on('error', () => {});
  return p;
}

/** Every mirrored column as exact text, ordered — what "identical" means. */
async function exactRows(p: Pool, sql: string): Promise<string[][]> {
  const c = await p.connect();
  try {
    await c.query("BEGIN; SET LOCAL extra_float_digits = 3; SET LOCAL TimeZone = 'UTC'");
    const r = await c.query({ text: sql, rowMode: 'array', types: { getTypeParser: () => (v: string) => v } });
    await c.query('COMMIT');
    return r.rows as string[][];
  } finally { c.release(); }
}
const POSITIONS_ORDERED = `SELECT time, mmsi, imo, latitude, longitude, speed, course, heading, nav_status, low_confidence, source
  FROM vessel_positions ORDER BY time, mmsi`;
const VESSELS_ORDERED = 'SELECT imo, mmsi, name, flag, ship_type, destination, last_seen, created_at FROM vessels ORDER BY imo';
const FALLBACK_ORDERED = 'SELECT mmsi, name, ship_type, last_seen, source FROM vessel_fallback_metadata ORDER BY mmsi';

async function insertPosition(p: Pool, at: Date, mmsi: string, lat = 26.123456789012345, lon = 56.98765432109876) {
  await p.query(
    `INSERT INTO vessel_positions (time, mmsi, imo, latitude, longitude, speed, course, heading, nav_status, low_confidence, source)
     VALUES ($1, $2, NULL, $3, $4, 12.3456789, NULL, 271.5, 0, false, 'aisstream')`,
    [at.toISOString().replace('Z', '123+00'), mmsi, lat, lon],
  );
}

async function seedRemote(hours: number, perHour: number) {
  for (let h = 0; h < hours; h++) {
    for (let i = 0; i < perHour; i++) {
      await insertPosition(remote, new Date(NOW.getTime() - h * HOUR - i * 60_000), String(100000000 + i), 26 + i / 7, 56 + h / 3);
    }
  }
}

describe.skipIf(!available)('local mirror (integration)', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
    for (const db of [REMOTE_DB, LOCAL_DB]) {
      await admin.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${db}`);
    }
    remote = remotePool();
    local = createMirrorPool(pgUrl(LOCAL_DB));
  });

  afterAll(async () => {
    await remote?.end();
    await local?.end();
    for (const db of [REMOTE_DB, LOCAL_DB]) await admin?.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
    await admin?.end();
  });

  beforeEach(async () => {
    await remote.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await remote.query(REMOTE_SCHEMA);
    await local.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await ensureMirrorSchema(local);
  });

  it('bootstraps an empty mirror into an exact copy and reports ready', async () => {
    await seedRemote(6, 4);
    await remote.query(`INSERT INTO vessels (imo, mmsi, name, flag, ship_type, destination, last_seen)
      VALUES ('9000001', '100000001', 'ALPHA', 'PA', 80, 'FUJAIRAH', $1), ('9000002', '100000002', 'BRAVO', NULL, NULL, NULL, $1)`, [NOW]);
    await remote.query(`INSERT INTO vessel_fallback_metadata VALUES ('200000001', 'CHARLIE', 70, $1, 'vesselfinder')`, [NOW]);

    const r = await syncMirror(remote, local, opts());

    expect(r.ready).toBe(true);
    expect(r.reason).toBeNull();
    expect(r.bucketsRepaired).toBe(6);
    expect(await exactRows(local, POSITIONS_ORDERED)).toEqual(await exactRows(remote, POSITIONS_ORDERED));
    expect(await exactRows(local, VESSELS_ORDERED)).toEqual(await exactRows(remote, VESSELS_ORDERED));
    expect(await exactRows(local, FALLBACK_ORDERED)).toEqual(await exactRows(remote, FALLBACK_ORDERED));
  });

  it('copies floats exactly even though the remote session rounds them to 15 digits', async () => {
    await insertPosition(remote, new Date(NOW.getTime() - HOUR), '100000009', 0.1 + 0.2, 56.98765432109876);
    await syncMirror(remote, local, opts());
    // Read at full precision: the mirror pool itself rounds like Supabase does.
    const rows = await exactRows(local, "SELECT latitude FROM vessel_positions WHERE mmsi = '100000009'");
    // Under extra_float_digits = 0 the remote would have sent "0.3".
    expect(rows[0][0]).toBe('0.30000000000000004');
  });

  it('pulls nothing on a second sync when nothing changed', async () => {
    await seedRemote(3, 3);
    await syncMirror(remote, local, opts());
    const r = await syncMirror(remote, local, opts());
    expect(r.ready).toBe(true);
    expect(r.bucketsRepaired).toBe(0);
    expect(r.rowsPulled).toBe(0);
  });

  it('downloads only the rows newer than the mirror in steady state', async () => {
    await seedRemote(5, 3);
    await syncMirror(remote, local, opts());
    await insertPosition(remote, new Date(NOW.getTime() + 60_000), '100000077');
    await insertPosition(remote, new Date(NOW.getTime() + 90_000), '100000078');
    const r = await syncMirror(remote, local, opts({ now: new Date(NOW.getTime() + 120_000) }));
    expect(r.ready).toBe(true);
    expect(r.rowsPulled).toBe(2);
    expect(r.bucketsRepaired).toBe(0);
    expect(await exactRows(local, POSITIONS_ORDERED)).toEqual(await exactRows(remote, POSITIONS_ORDERED));
  });

  it('re-copies the hour of a row that arrived with an older timestamp', async () => {
    await seedRemote(5, 3);
    await syncMirror(remote, local, opts());
    await insertPosition(remote, new Date(NOW.getTime() - 3 * HOUR - 5 * 60_000), '100000077');
    const r = await syncMirror(remote, local, opts());
    expect(r.ready).toBe(true);
    expect(r.bucketsRepaired).toBe(1);
    expect(r.rowsPulled).toBe(4); // that hour's 3 rows + the late one
    expect(await exactRows(local, POSITIONS_ORDERED)).toEqual(await exactRows(remote, POSITIONS_ORDERED));
  });

  it('copies Supabase\'s prune without downloading anything', async () => {
    await seedRemote(6, 3);
    await syncMirror(remote, local, opts());
    // The harvester's prune, cutting through the middle of an hour.
    await remote.query('DELETE FROM vessel_positions WHERE time < $1', [new Date(NOW.getTime() - 4 * HOUR - 60_000)]);
    const r = await syncMirror(remote, local, opts());
    expect(r.ready).toBe(true);
    expect(r.rowsPulled).toBe(0);
    expect(await exactRows(local, POSITIONS_ORDERED)).toEqual(await exactRows(remote, POSITIONS_ORDERED));
  });

  it('empties the mirror when Supabase has no positions', async () => {
    await insertPosition(local, NOW, '100000001');
    const r = await syncMirror(remote, local, opts());
    expect(r.ready).toBe(true);
    const { rows } = await local.query('SELECT count(*)::int AS n FROM vessel_positions');
    expect(rows[0].n).toBe(0);
  });

  it('keeps the steady-state tail small when a row is dated in the future', async () => {
    await seedRemote(3, 2);
    await insertPosition(remote, new Date(NOW.getTime() + 24 * HOUR), '100000099');
    await syncMirror(remote, local, opts());
    await insertPosition(remote, new Date(NOW.getTime() + 60_000), '100000077');
    const r = await syncMirror(remote, local, opts({ now: new Date(NOW.getTime() + 120_000) }));
    expect(r.ready).toBe(true);
    expect(r.bucketsRepaired).toBe(0);
    expect(r.rowsPulled).toBe(2); // the new row, plus the future-dated row re-read with the tail
    expect(await exactRows(local, POSITIONS_ORDERED)).toEqual(await exactRows(remote, POSITIONS_ORDERED));
  });

  it('detects and repairs local corruption: a missing row, an altered value, a stray row', async () => {
    await seedRemote(4, 3);
    await syncMirror(remote, local, opts());
    await local.query("DELETE FROM vessel_positions WHERE ctid = (SELECT ctid FROM vessel_positions WHERE time < $1 LIMIT 1)", [new Date(NOW.getTime() - 3 * HOUR)]);
    await local.query('UPDATE vessel_positions SET latitude = latitude + 1e-9 WHERE ctid = (SELECT ctid FROM vessel_positions ORDER BY time DESC LIMIT 1)');
    await insertPosition(local, new Date(NOW.getTime() - 90 * 60_000), '999999999');
    const r = await syncMirror(remote, local, opts());
    expect(r.ready).toBe(true);
    expect(r.bucketsRepaired).toBe(3);
    expect(await exactRows(local, POSITIONS_ORDERED)).toEqual(await exactRows(remote, POSITIONS_ORDERED));
  });

  it('buckets by UTC epoch hour regardless of the remote session time zone', async () => {
    await remote.end();
    remote = remotePool('Asia/Kolkata');
    await seedRemote(3, 2);
    const first = await syncMirror(remote, local, opts());
    const second = await syncMirror(remote, local, opts());
    expect(first.ready).toBe(true);
    expect(second.bucketsRepaired).toBe(0);
    await remote.end();
    remote = remotePool();
  });

  it('stops at the deadline, reports not ready with hours pending, and finishes on the next sync', async () => {
    await seedRemote(10, 2);
    const partial = await syncMirror(remote, local, opts({ deadline: Date.now() - 1 }));
    expect(partial.ready).toBe(false);
    expect(partial.bucketsPending).toBe(10);
    expect(partial.reason).toMatch(/10 hour\(s\) still to copy/);
    const done = await syncMirror(remote, local, opts());
    expect(done.ready).toBe(true);
    expect(done.bucketsPending).toBe(0);
  });

  it('respects the 24h repair budget instead of re-downloading without limit', async () => {
    await seedRemote(6, 3);
    // The budget is checked before each chunk: the first one-hour chunk runs,
    // then the 24h total is over and repairs stop.
    const r = await syncMirror(remote, local, opts({ repairBudgetBytes: 1, maxChunkHours: 1 }));
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/repair budget/);
    expect(r.bucketsRepaired).toBe(1);
  });

  it('trips the breaker when a repaired hour still disagrees, and stops pulling while it is open', async () => {
    await seedRemote(2, 2);
    // A copy that cannot stick — the failure mode that would otherwise
    // re-download the whole horizon every run.
    await local.query(`CREATE FUNCTION skew() RETURNS trigger AS $$ BEGIN NEW.latitude := NEW.latitude + 1; RETURN NEW; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER skew BEFORE INSERT ON vessel_positions FOR EACH ROW EXECUTE FUNCTION skew();`);
    const tripped = await syncMirror(remote, local, opts());
    expect(tripped.ready).toBe(false);
    expect(tripped.reason).toMatch(/integrity/i);
    const paused = await syncMirror(remote, local, opts());
    expect(paused.ready).toBe(false);
    expect(paused.rowsPulled).toBe(0);
    expect(paused.reason).toMatch(/paused until/);
  });

  it('keeps vessels in sync: incremental changes, changes that skip last_seen, and deletions', async () => {
    await remote.query(`INSERT INTO vessels (imo, mmsi, name, last_seen) VALUES
      ('9000001', '100000001', 'ALPHA', $1), ('9000002', '100000002', 'BRAVO', $1), ('9000003', '100000003', 'CHARLIE', $1)`, [NOW]);
    await syncMirror(remote, local, opts());
    await remote.query("UPDATE vessels SET destination = 'JEDDAH', last_seen = $1 WHERE imo = '9000001'", [new Date(NOW.getTime() + 60_000)]);
    await remote.query("UPDATE vessels SET flag = 'LR' WHERE imo = '9000002'"); // no last_seen bump
    await remote.query("DELETE FROM vessels WHERE imo = '9000003'");
    const r = await syncMirror(remote, local, opts());
    expect(r.ready).toBe(true);
    expect(await exactRows(local, VESSELS_ORDERED)).toEqual(await exactRows(remote, VESSELS_ORDERED));
  });

  it('keeps fallback metadata in sync with only the changed rows pulled', async () => {
    for (let i = 0; i < 50; i++) {
      await remote.query("INSERT INTO vessel_fallback_metadata VALUES ($1, $2, 70, $3, 'vesselfinder')", [String(200000000 + i), `SHIP ${i}`, NOW]);
    }
    await syncMirror(remote, local, opts());
    await remote.query("UPDATE vessel_fallback_metadata SET name = 'RENAMED', last_seen = $1 WHERE mmsi = '200000007'", [new Date(NOW.getTime() + 600_000)]);
    const r = await syncMirror(remote, local, opts());
    expect(r.ready).toBe(true);
    expect(r.rowsPulled).toBeLessThan(50);
    expect(await exactRows(local, FALLBACK_ORDERED)).toEqual(await exactRows(remote, FALLBACK_ORDERED));
  });

  it('rebuilds the mirror tables when the schema version changes', async () => {
    await local.query("INSERT INTO mirror_meta (key, value) VALUES ('schema_version', '0') ON CONFLICT (key) DO UPDATE SET value = '0'");
    await local.query('ALTER TABLE vessels DROP COLUMN flag');
    await ensureMirrorSchema(local);
    const { rows } = await local.query("SELECT value FROM mirror_meta WHERE key = 'schema_version'");
    expect(rows[0].value).toBe(MIRROR_SCHEMA_VERSION);
    const cols = await local.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'vessels' AND column_name = 'flag'");
    expect(cols.rowCount).toBe(1);
  });

  describe('track engine state', () => {
    it('serves lane density and learn state from the mirror only while they match Supabase', async () => {
      await remote.query("INSERT INTO lane_density VALUES (1, 0.123456789, $1), (2, 3.5, $1)", [NOW]);
      await remote.query("INSERT INTO track_engine_state VALUES ('learn', '{\"a\": 1.25}', $1)", [NOW]);

      const firstLane = await loadLaneRowsMirrored(remote, local);
      const firstLearn = await loadLearnMirrored(remote, local);
      expect(firstLane.source).toBe('supabase');
      expect(firstLearn).toEqual({ value: { a: 1.25 }, source: 'supabase' });

      const again = await loadLaneRowsMirrored(remote, local);
      expect(again.source).toBe('mirror');
      expect(again.rows).toEqual(firstLane.rows);
      expect(await loadLearnMirrored(remote, local)).toEqual({ value: { a: 1.25 }, source: 'mirror' });

      await remote.query('UPDATE lane_density SET w = 9 WHERE cell = 2');
      const changed = await loadLaneRowsMirrored(remote, local);
      expect(changed.source).toBe('supabase');
      expect(changed.rows.find((r) => r.cell === 2)?.w).toBe(9);
    });

    it('copies what the harvester just saved so the next run reads it locally', async () => {
      await remote.query("INSERT INTO lane_density VALUES (1, 1, $1)", [NOW]);
      await remote.query("INSERT INTO track_engine_state VALUES ('learn', '{\"v\": 1}', $1)", [NOW]);
      await loadLaneRowsMirrored(remote, local);
      await loadLearnMirrored(remote, local);

      // What saveEngineRun / saveLaneDensity do on Supabase:
      const learnJson = JSON.stringify({ v: 2, nested: { x: 0.1 + 0.2 } });
      await remote.query("UPDATE track_engine_state SET value = $1::jsonb, updated_at = NOW() WHERE key = 'learn'", [learnJson]);
      await remote.query('INSERT INTO lane_density VALUES (1, 0.7777777, NOW()), (5, 2.25, NOW()) ON CONFLICT (cell) DO UPDATE SET w = EXCLUDED.w, updated_at = EXCLUDED.updated_at');
      await recordTrackStateSaved(remote, local, { learnJson, touchedCells: [1, 5] });

      expect((await loadLaneRowsMirrored(remote, local)).source).toBe('mirror');
      expect(await loadLearnMirrored(remote, local)).toEqual({ value: { v: 2, nested: { x: 0.30000000000000004 } }, source: 'mirror' });
    });

    it('returns null learn state when Supabase has none', async () => {
      expect(await loadLearnMirrored(remote, local)).toEqual({ value: null, source: 'supabase' });
    });
  });

  it('reports not ready instead of crashing when a connection dies mid-transaction', async () => {
    await seedRemote(2, 2);
    // A checked-out pg client emits 'error' when its connection drops (Supavisor
    // reset, mirror restart, sleep/wake); unhandled, that event kills the process.
    const dying = Object.create(remote) as Pool;
    dying.connect = (async () => {
      const c = await remote.connect();
      setImmediate(() => c.emit('error', new Error('Connection terminated unexpectedly')));
      return c;
    }) as Pool['connect'];
    const r = await syncMirror(dying, local, opts());
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/Connection terminated unexpectedly/);
  });

  it('keeps keyed sync incremental after a row is stamped in the future', async () => {
    for (let i = 0; i < 50; i++) {
      await remote.query("INSERT INTO vessel_fallback_metadata VALUES ($1, $2, 70, $3, 'vesselfinder')", [String(200000000 + i), `SHIP ${i}`, NOW]);
    }
    await syncMirror(remote, local, opts());
    await remote.query("UPDATE vessel_fallback_metadata SET last_seen = $1 WHERE mmsi = '200000001'", [new Date(NOW.getTime() + 24 * HOUR)]);
    await syncMirror(remote, local, opts());
    // Later writes are stamped before the future row; they must still be pulled incrementally.
    await remote.query("UPDATE vessel_fallback_metadata SET name = 'MOVED', last_seen = $1 WHERE mmsi = '200000009'", [new Date(NOW.getTime() + 600_000)]);
    const r = await syncMirror(remote, local, opts({ now: new Date(NOW.getTime() + 660_000) }));
    expect(r.ready).toBe(true);
    expect(r.rowsPulled).toBeLessThanOrEqual(2); // the changed row, plus the future-stamped one re-read
    expect(await exactRows(local, FALLBACK_ORDERED)).toEqual(await exactRows(remote, FALLBACK_ORDERED));
  });

  it('detects a NULL that moved between adjacent columns', async () => {
    await seedRemote(2, 2);  // course NULL, heading 271.5
    await remote.query(`INSERT INTO vessels (imo, mmsi, name, flag, destination, last_seen) VALUES ('9000001', '100000001', 'ALPHA', NULL, 'PA', $1)`, [NOW]);
    await syncMirror(remote, local, opts());
    await local.query('UPDATE vessel_positions SET course = heading, heading = NULL WHERE ctid = (SELECT ctid FROM vessel_positions ORDER BY time LIMIT 1)');
    await local.query("UPDATE vessels SET flag = destination, destination = NULL WHERE imo = '9000001'");
    const r = await syncMirror(remote, local, opts());
    expect(r.ready).toBe(true);
    expect(r.bucketsRepaired).toBe(1);
    expect(await exactRows(local, POSITIONS_ORDERED)).toEqual(await exactRows(remote, POSITIONS_ORDERED));
    expect(await exactRows(local, VESSELS_ORDERED)).toEqual(await exactRows(remote, VESSELS_ORDERED));
  });

  it('detects a timestamp that differs by one microsecond', async () => {
    await seedRemote(3, 2);
    await syncMirror(remote, local, opts());
    await local.query("UPDATE vessel_positions SET time = time + interval '1 microsecond' WHERE ctid = (SELECT ctid FROM vessel_positions ORDER BY time LIMIT 1)");
    const r = await syncMirror(remote, local, opts());
    expect(r.bucketsRepaired).toBe(1);
    expect(await exactRows(local, POSITIONS_ORDERED)).toEqual(await exactRows(remote, POSITIONS_ORDERED));
  });

  it('leaves a mirror more than 2h behind to budgeted hour repair instead of an unbounded tail pull', async () => {
    await seedRemote(2, 2);
    await syncMirror(remote, local, opts());
    const later = new Date(NOW.getTime() + 3 * HOUR);
    await insertPosition(remote, later, '100000077');
    const r = await syncMirror(remote, local, opts({ now: new Date(later.getTime() + 60_000), deadline: Date.now() - 1 }));
    expect(r.rowsPulled).toBe(0);
    expect(r.ready).toBe(false);
    expect(r.bucketsPending).toBe(1);
  });

  it('trips the breaker when a repaired vessels bucket still disagrees', async () => {
    await remote.query(`INSERT INTO vessels (imo, mmsi, name, last_seen) VALUES ('9000001', '100000001', 'ALPHA', $1)`, [NOW]);
    await local.query(`CREATE FUNCTION skew() RETURNS trigger AS $$ BEGIN NEW.name := NEW.name || '!'; RETURN NEW; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER skew BEFORE INSERT ON vessels FOR EACH ROW EXECUTE FUNCTION skew();`);
    const r = await syncMirror(remote, local, opts());
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/integrity check failed.*vessels/);
  });

  it('reports the repair budget, not ready, when even the keyed bootstrap would exceed it', async () => {
    await remote.query(`INSERT INTO vessels (imo, mmsi, name, last_seen) VALUES ('9000001', '100000001', 'ALPHA', $1)`, [NOW]);
    const r = await syncMirror(remote, local, opts({ repairBudgetBytes: 0 }));
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/repair budget/);
  });

  it('opens mirror sessions with the settings of Supabase\'s pooled sessions', async () => {
    const { rows } = await local.query("SELECT current_setting('TimeZone') AS tz, current_setting('DateStyle') AS ds, current_setting('extra_float_digits') AS efd");
    expect(rows[0]).toEqual({ tz: 'UTC', ds: 'ISO, MDY', efd: '0' });
    // So a mirrored read parses exactly as the Supabase read did.
    await insertPosition(remote, new Date(NOW.getTime() - HOUR), '100000009', 0.1 + 0.2, 56.98765432109876);
    await syncMirror(remote, local, opts());
    const sql = "SELECT latitude, longitude, speed, time FROM vessel_positions WHERE mmsi = '100000009'";
    expect((await local.query(sql)).rows).toEqual((await remote.query(sql)).rows);
  });

  it('mirrorReader falls back to Supabase on a local error and stays there', async () => {
    const errors: string[] = [];
    let localCalls = 0;
    const broken = { query: async () => { localCalls++; throw new Error('connection refused'); } };
    const reader = mirrorReader(broken as never, remote, (e) => errors.push(e.message));
    await insertPosition(remote, NOW, '100000001');
    const first = await reader.query('SELECT count(*)::int AS n FROM vessel_positions');
    const second = await reader.query('SELECT count(*)::int AS n FROM vessel_positions');
    expect(first.rows[0].n).toBe(1);
    expect(second.rows[0].n).toBe(1);
    expect(localCalls).toBe(1);
    expect(errors).toEqual(['connection refused']);
  });
});

describe('createMirrorPool', () => {
  it('times out queries on the client, so a hung mirror cannot stall a harvest', async () => {
    // statement_timeout is enforced by the server, which a hung server never does.
    const p = createMirrorPool('postgres://postgres@127.0.0.1:1/none');
    expect((p as unknown as { options: { query_timeout?: number } }).options.query_timeout).toBeGreaterThan(0);
    await p.end();
  });
});

describe('diffBuckets', () => {
  it('returns hours whose count or hash differ, or that exist on one side only, newest first', () => {
    const remoteB = [{ h: '10', n: '3', hash: '7' }, { h: '11', n: '2', hash: '5' }, { h: '12', n: '1', hash: '1' }];
    const localB = [{ h: '10', n: '3', hash: '7' }, { h: '11', n: '2', hash: '6' }, { h: '9', n: '1', hash: '1' }];
    expect(diffBuckets(remoteB, localB)).toEqual([12, 11, 9]);
  });
});

describe('chunkHours', () => {
  it('groups contiguous hours into ranges no longer than the limit, keeping the given order', () => {
    expect(chunkHours([20, 19, 18, 17, 10, 9], 3)).toEqual([[18, 21], [17, 18], [9, 11]]);
  });
});
