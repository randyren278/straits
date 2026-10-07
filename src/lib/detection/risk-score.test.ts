/**
 * Dark Fleet Risk Score — integration tests against a real Postgres.
 *
 * Scores are computed and upserted inside the database. These tests keep the
 * identity-first cases (a sanctioned hull is scored with zero anomalies;
 * behavioral factors still count without sanctions), pin every stored score
 * and factor to what the previous client-side version produced (the oracle
 * below re-runs its query and scoring), and check that nothing is sent back to
 * the client: downloading the per-vessel aggregates every harvest was ~0.2 MB
 * of Supabase egress. Skipped when no local Postgres is reachable.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { PG_ADMIN_URL, pgAvailable, pgUrl } from '../../../tests/postgres';

const ADMIN_URL = PG_ADMIN_URL;
// Per-process names: concurrent test runs must never drop each other's databases.
const DB = `risk_score_it_${process.pid}`;

const available = await pgAvailable();

let admin: Pool;
let pool: Pool;
let computeRiskScores: () => Promise<number>;
const DAY = 86_400_000;

// Production definitions (Supabase, Oct 2026), trimmed to the columns used.
const SCHEMA = `
  DROP TABLE IF EXISTS vessels, vessel_anomalies, vessel_sanctions, vessel_rendezvous, vessel_risk_scores;
  CREATE TABLE vessels (imo VARCHAR(10) PRIMARY KEY, mmsi VARCHAR(9) NOT NULL, name VARCHAR(255) NOT NULL, flag VARCHAR(2));
  CREATE TABLE vessel_anomalies (
    id SERIAL PRIMARY KEY, imo VARCHAR(10) NOT NULL, anomaly_type VARCHAR(40) NOT NULL,
    confidence VARCHAR(20) NOT NULL, detected_at TIMESTAMPTZ NOT NULL, resolved_at TIMESTAMPTZ, details JSONB);
  CREATE UNIQUE INDEX idx_anomalies_active ON vessel_anomalies (imo, anomaly_type) WHERE resolved_at IS NULL;
  CREATE TABLE vessel_sanctions (imo VARCHAR(10) PRIMARY KEY, sanctioning_authority VARCHAR(10) NOT NULL, risk_category VARCHAR(50));
  CREATE TABLE vessel_rendezvous (imo_a TEXT NOT NULL, imo_b TEXT NOT NULL, first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (imo_a, imo_b, first_seen_at));
  CREATE TABLE vessel_risk_scores (imo TEXT PRIMARY KEY, score INTEGER NOT NULL DEFAULT 0, factors JSONB NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`;

/** The previous implementation's query and scoring, kept as the reference. */
async function oracle(): Promise<Map<string, { score: number; factors: Record<string, number> }>> {
  const HIGH_RISK_FLAGS = ['IR', 'RU', 'VE', 'KP', 'PA', 'CM', 'KM'];
  const { rows } = await pool.query<{ imo: string; flag: string | null; dark_count: string; loiter_count: string; sts_count: string; is_sanctioned: string; rendezvous_count: string }>(`
    WITH seed AS (
      SELECT DISTINCT imo FROM vessel_anomalies WHERE resolved_at IS NULL OR detected_at > NOW() - INTERVAL '90 days'
      UNION
      SELECT imo FROM vessel_sanctions WHERE risk_category IN ('sanction', 'mare.shadow;poi'))
    SELECT s.imo, v.flag,
      COUNT(*) FILTER (WHERE va.anomaly_type = 'going_dark') AS dark_count,
      COUNT(*) FILTER (WHERE va.anomaly_type = 'loitering' AND va.detected_at > NOW() - INTERVAL '90 days') AS loiter_count,
      COUNT(*) FILTER (WHERE va.anomaly_type = 'sts_transfer') AS sts_count,
      CASE WHEN vs.imo IS NOT NULL AND vs.risk_category IN ('sanction', 'mare.shadow;poi') THEN 1 ELSE 0 END AS is_sanctioned,
      (SELECT COUNT(*) FROM vessel_rendezvous rz WHERE (rz.imo_a = s.imo OR rz.imo_b = s.imo) AND rz.last_seen_at > NOW() - INTERVAL '90 days') AS rendezvous_count
    FROM seed s
    LEFT JOIN vessel_anomalies va ON va.imo = s.imo
    LEFT JOIN vessels v ON v.imo = s.imo
    LEFT JOIN vessel_sanctions vs ON vs.imo = s.imo
    GROUP BY s.imo, v.flag, vs.imo, vs.risk_category`);
  return new Map(rows.map((row) => {
    const factors = {
      goingDark: Math.min(parseInt(row.dark_count, 10) * 8, 40),
      flagRisk: row.flag !== null && HIGH_RISK_FLAGS.includes(row.flag) ? 15 : 0,
      sanctions: parseInt(row.is_sanctioned, 10) === 1 ? 25 : 0,
      loitering: parseInt(row.loiter_count, 10) > 0 ? 10 : 0,
      sts: parseInt(row.sts_count, 10) > 0 ? 10 : 0,
      rendezvous: parseInt(row.rendezvous_count, 10) >= 2 ? 5 : 0,
    };
    const score = factors.goingDark + factors.flagRisk + factors.sanctions + factors.loitering + factors.sts + factors.rendezvous;
    return [row.imo, { score, factors }];
  }));
}

async function stored(): Promise<Map<string, { score: number; factors: Record<string, number> }>> {
  const { rows } = await pool.query<{ imo: string; score: number; factors: Record<string, number> }>('SELECT imo, score, factors FROM vessel_risk_scores');
  return new Map(rows.map((r) => [r.imo, { score: r.score, factors: r.factors }]));
}

async function vessel(imo: string, flag: string | null) {
  await pool.query("INSERT INTO vessels VALUES ($1, '123456789', 'SHIP', $2)", [imo, flag]);
}
async function anomaly(imo: string, type: string, daysAgo: number, resolved = true) {
  const at = new Date(Date.now() - daysAgo * DAY);
  await pool.query(
    "INSERT INTO vessel_anomalies (imo, anomaly_type, confidence, detected_at, resolved_at, details) VALUES ($1, $2, 'confirmed', $3, $4, '{}')",
    [imo, type, at, resolved ? new Date(at.getTime() + 3_600_000) : null]);
}
async function sanction(imo: string, category: string) {
  await pool.query("INSERT INTO vessel_sanctions VALUES ($1, 'OFAC', $2)", [imo, category]);
}
async function rendezvous(a: string, b: string, daysAgo: number) {
  const at = new Date(Date.now() - daysAgo * DAY);
  await pool.query('INSERT INTO vessel_rendezvous VALUES ($1, $2, $3, $3)', [a, b, at]);
}

describe.skipIf(!available)('computeRiskScores (integration)', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
    await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${DB}`);
    // The module's pool reads DATABASE_URL when it is first imported.
    process.env.DATABASE_URL = pgUrl(DB);
    ({ pool } = await import('../db'));
    ({ computeRiskScores } = await import('./risk-score'));
  });

  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
    await admin?.end();
  });

  beforeEach(async () => {
    await pool.query(SCHEMA);
  });

  it('scores a sanctioned, zero-anomaly vessel (sanctions=25, flagRisk=15)', async () => {
    await vessel('9111111', 'IR');
    await sanction('9111111', 'sanction');
    expect(await computeRiskScores()).toBe(1);
    expect((await stored()).get('9111111')).toEqual({
      score: 40, factors: { goingDark: 0, flagRisk: 15, sanctions: 25, loitering: 0, sts: 0, rendezvous: 0 },
    });
  });

  it('scores an anomalous, non-sanctioned vessel with 2 going_dark events (goingDark=16)', async () => {
    await vessel('9222222', 'MH');
    await anomaly('9222222', 'going_dark', 3);
    await anomaly('9222222', 'going_dark', 1, false);
    await computeRiskScores();
    expect((await stored()).get('9222222')).toEqual({
      score: 16, factors: { goingDark: 16, flagRisk: 0, sanctions: 0, loitering: 0, sts: 0, rendezvous: 0 },
    });
  });

  it('adds the rendezvous factor (+5) for a repeat partner (>=2 encounters in 90 days)', async () => {
    await vessel('9333333', 'MH');
    await anomaly('9333333', 'sts_transfer', 5);
    for (const d of [10, 20, 30]) await rendezvous('9333333', '9444444', d);
    await computeRiskScores();
    expect((await stored()).get('9333333')?.factors.rendezvous).toBe(5);
  });

  it('matches the client-side version exactly across caps, windows and categories', async () => {
    await vessel('9100001', 'RU');
    for (const d of [1, 2, 3, 4, 5, 6]) await anomaly('9100001', 'going_dark', d);   // 6 events: capped at 40
    await anomaly('9100001', 'loitering', 120);                                        // loitering too old to count
    await vessel('9100002', 'PA');
    await anomaly('9100002', 'loitering', 10);
    await anomaly('9100002', 'sts_transfer', 200);                                     // STS counts at any age once seeded
    await sanction('9100002', 'mare.detained');                                        // informational only
    await anomaly('9100003', 'going_dark', 2, false);                                  // no vessels row: flag NULL
    await vessel('9100004', 'IR');
    await anomaly('9100004', 'going_dark', 150);                                       // only resolved and > 90 days: not seeded
    await sanction('9100005', 'mare.shadow;poi');                                      // sanctioned, no vessels row
    await rendezvous('9100002', '9100003', 5);
    await rendezvous('9100003', '9100002', 6);
    await rendezvous('9100002', '9100009', 100);                                       // outside 90 days
    const expected = await oracle();

    const count = await computeRiskScores();

    expect(count).toBe(expected.size);
    expect(await stored()).toEqual(expected);
    expect(expected.has('9100004')).toBe(false);
  });

  it('updates existing scores in place', async () => {
    await vessel('9222222', 'MH');
    await anomaly('9222222', 'going_dark', 3, false);
    await computeRiskScores();
    await anomaly('9222222', 'going_dark', 2);
    await computeRiskScores();
    const { rows } = await pool.query("SELECT score FROM vessel_risk_scores WHERE imo = '9222222'");
    expect(rows).toEqual([{ score: 16 }]);
  });

  it('sends no rows back to the client', async () => {
    for (let i = 0; i < 20; i++) {
      await vessel(`95000${String(i).padStart(2, '0')}`, 'PA');
      await anomaly(`95000${String(i).padStart(2, '0')}`, 'going_dark', 1, false);
    }
    const original = pool.query.bind(pool);
    const returned: number[] = [];
    pool.query = (async (...args: Parameters<Pool['query']>) => {
      const r = await (original as (...a: unknown[]) => Promise<{ rows: unknown[] }>)(...args);
      returned.push(r.rows.length);
      return r;
    }) as Pool['query'];
    try {
      expect(await computeRiskScores()).toBe(20);
    } finally {
      pool.query = original;
    }
    expect(returned.length).toBeGreaterThan(0);
    expect(returned.every((n) => n === 0)).toBe(true);
  });
});
