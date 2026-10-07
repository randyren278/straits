/**
 * Repeat Going Dark Detection — integration tests against a real Postgres.
 *
 * The detector aggregates and upserts inside the database. These tests pin its
 * behavior to what the previous client-side version produced (the oracle
 * below re-runs that version's query and mapping), and check that nothing is
 * sent back to the client: downloading the event history every harvest was
 * ~0.5 MB of Supabase egress. Skipped when no local Postgres is reachable.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';

const ADMIN_URL = process.env.MIRROR_TEST_ADMIN_URL ?? 'postgres://postgres@127.0.0.1:5433/postgres';
// Per-process names: concurrent test runs must never drop each other's databases.
const DB = `repeat_going_dark_it_${process.pid}`;

async function serverAvailable(): Promise<boolean> {
  const p = new Pool({ connectionString: ADMIN_URL, connectionTimeoutMillis: 1000, max: 1 });
  try { await p.query('SELECT 1'); return true; } catch { return false; } finally { await p.end().catch(() => {}); }
}
const available = await serverAvailable();

let admin: Pool;
let pool: Pool;
let detectRepeatGoingDark: () => Promise<number>;
const DAY = 86_400_000;

/** The previous implementation's read + mapping, kept as the reference. */
async function oracle(): Promise<Map<string, unknown>> {
  const { rows } = await pool.query<{ imo: string; dark_count: string; recent_events: unknown[] }>(`
    SELECT imo, COUNT(*) as dark_count,
           json_agg(json_build_object('detectedAt', detected_at, 'resolvedAt', resolved_at) ORDER BY detected_at DESC) as recent_events
    FROM vessel_anomalies
    WHERE anomaly_type = 'going_dark' AND detected_at > NOW() - INTERVAL '30 days'
    GROUP BY imo HAVING COUNT(*) >= 3`);
  return new Map(rows.map((r) => [r.imo, { goingDarkCount: parseInt(r.dark_count, 10), windowDays: 30, recentEvents: r.recent_events }]));
}

async function goingDark(imo: string, daysAgo: number, resolved: boolean): Promise<void> {
  const at = new Date(Date.now() - daysAgo * DAY);
  await pool.query(
    `INSERT INTO vessel_anomalies (imo, anomaly_type, confidence, detected_at, resolved_at, details)
     VALUES ($1, 'going_dark', 'confirmed', $2, $3, '{}')`,
    [imo, at, resolved ? new Date(at.getTime() + 3_600_000) : null],
  );
}

async function activeRepeat(): Promise<Map<string, { details: unknown; confidence: string }>> {
  const { rows } = await pool.query<{ imo: string; details: unknown; confidence: string }>(
    "SELECT imo, details, confidence FROM vessel_anomalies WHERE anomaly_type = 'repeat_going_dark' AND resolved_at IS NULL");
  return new Map(rows.map((r) => [r.imo, { details: r.details, confidence: r.confidence }]));
}

describe.skipIf(!available)('detectRepeatGoingDark (integration)', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
    await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${DB}`);
    // The module's pool reads DATABASE_URL when it is first imported.
    process.env.DATABASE_URL = ADMIN_URL.replace(/\/postgres$/, `/${DB}`);
    ({ pool } = await import('../db'));
    ({ detectRepeatGoingDark } = await import('./repeat-going-dark'));
  });

  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
    await admin?.end();
  });

  beforeEach(async () => {
    await pool.query('DROP TABLE IF EXISTS vessel_anomalies');
    // Production definition (Supabase, Oct 2026).
    await pool.query(`
      CREATE TABLE vessel_anomalies (
        id SERIAL PRIMARY KEY, imo VARCHAR(10) NOT NULL, anomaly_type VARCHAR(40) NOT NULL,
        confidence VARCHAR(20) NOT NULL, detected_at TIMESTAMPTZ NOT NULL, resolved_at TIMESTAMPTZ,
        details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE UNIQUE INDEX idx_anomalies_active ON vessel_anomalies (imo, anomaly_type) WHERE resolved_at IS NULL;
      CREATE INDEX idx_anomalies_type ON vessel_anomalies (anomaly_type, detected_at DESC);`);
    await pool.query("SET TIME ZONE 'UTC'");
  });

  it('flags 3+ going-dark events in 30 days with exactly the details the client-side version stored', async () => {
    for (const d of [1, 5, 9]) await goingDark('1111111', d, true);
    await goingDark('1111111', 0.2, false);   // 4 events, one still active
    await goingDark('2222222', 2, true);
    await goingDark('2222222', 3, true);      // 2 events: below threshold
    await goingDark('3333333', 40, true);
    await goingDark('3333333', 2, true);
    await goingDark('3333333', 4, true);      // 3 events, but one is outside the window
    for (const d of [10, 11, 29]) await goingDark('4444444', d, true);
    const expected = await oracle();

    const count = await detectRepeatGoingDark();

    expect(count).toBe(2);
    const stored = await activeRepeat();
    expect([...stored.keys()].sort()).toEqual(['1111111', '4444444']);
    for (const [imo, details] of expected) {
      expect(stored.get(imo)).toEqual({ details, confidence: 'confirmed' });
    }
  });

  it('updates the active anomaly in place as events accumulate', async () => {
    for (const d of [1, 2, 3]) await goingDark('1111111', d, true);
    await detectRepeatGoingDark();
    await goingDark('1111111', 0.5, true);
    await detectRepeatGoingDark();

    const { rows } = await pool.query(
      "SELECT details FROM vessel_anomalies WHERE imo = '1111111' AND anomaly_type = 'repeat_going_dark'");
    expect(rows).toHaveLength(1);
    expect(rows[0].details).toEqual((await oracle()).get('1111111'));
  });

  it('resolves the anomaly once a vessel falls below the threshold', async () => {
    for (const d of [1, 2, 3]) await goingDark('1111111', d, true);
    await detectRepeatGoingDark();
    await pool.query("DELETE FROM vessel_anomalies WHERE imo = '1111111' AND anomaly_type = 'going_dark' AND detected_at < NOW() - INTERVAL '2 days'");
    await detectRepeatGoingDark();
    expect((await activeRepeat()).size).toBe(0);
  });

  it('sends no rows back to the client', async () => {
    for (const d of [1, 2, 3, 4, 5, 6]) await goingDark('1111111', d, true);
    for (const d of [1, 2, 3]) await goingDark('4444444', d, true);
    const original = pool.query.bind(pool);
    const returned: number[] = [];
    pool.query = (async (...args: Parameters<Pool['query']>) => {
      const r = await (original as (...a: unknown[]) => Promise<{ rows: unknown[] }>)(...args);
      returned.push(r.rows.length);
      return r;
    }) as Pool['query'];
    try {
      expect(await detectRepeatGoingDark()).toBe(2);
    } finally {
      pool.query = original;
    }
    expect(returned.length).toBeGreaterThan(0);
    expect(returned.every((n) => n === 0)).toBe(true);
  });
});
