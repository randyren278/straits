/** Local parity and retention check for durable traffic facts. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost');
if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
  throw new Error('Refusing daily-presence fixture on a non-local database');
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const parity = await client.query(`
    WITH regional AS (
      SELECT (vp.time AT TIME ZONE 'UTC')::date AS day, vp.mmsi, r.region
      FROM vessel_positions vp
      CROSS JOIN LATERAL (VALUES
        ('*', TRUE),
        ('hormuz', vp.latitude BETWEEN 23.5 AND 27.0 AND vp.longitude BETWEEN 55.5 AND 57.5),
        ('babel_mandeb', vp.latitude BETWEEN 11.0 AND 13.5 AND vp.longitude BETWEEN 42.5 AND 45.0),
        ('suez', vp.latitude BETWEEN 29.5 AND 32.5 AND vp.longitude BETWEEN 31.5 AND 33.0),
        ('gulf_of_aden', vp.latitude BETWEEN 11.0 AND 14.0 AND vp.longitude BETWEEN 43.0 AND 48.0)
      ) AS r(region, inside)
      WHERE r.inside AND vp.time >= NOW() - INTERVAL '120 days'
    ), raw_counts AS (
      SELECT day, region, COUNT(DISTINCT mmsi) AS contacts
      FROM regional GROUP BY day, region
    ), fact_counts AS (
      SELECT day, region, COUNT(*) AS contacts
      FROM vessel_daily_presence GROUP BY day, region
    )
    SELECT COUNT(*)::int AS mismatches FROM raw_counts a
    FULL JOIN fact_counts b USING (day, region)
    WHERE a.contacts IS DISTINCT FROM b.contacts
  `);
  assert.equal(parity.rows[0].mismatches, 0);

  await client.query('BEGIN');
  const mmsi = `${Math.floor(100000000 + Math.random() * 899999999)}`;
  const day = '2026-01-20';
  const imo = `test-${randomUUID().slice(0, 5)}`;
  for (const [hour, lat, lon] of [[1, 25, 56], [2, 25.5, 56.5], [3, 31, 32]]) {
    await client.query(`INSERT INTO vessel_positions
      (time, mmsi, imo, latitude, longitude, low_confidence)
      VALUES ($1::date + $2::int * INTERVAL '1 hour', $3, $4, $5, $6, false)`, [day, hour, mmsi, imo, lat, lon]);
  }
  const facts = await client.query(
    'SELECT region FROM vessel_daily_presence WHERE day=$1 AND mmsi=$2 ORDER BY region',
    [day, mmsi],
  );
  assert.deepEqual(facts.rows.map((r) => r.region), ['*', 'hormuz', 'suez']);
  await client.query('DELETE FROM vessel_positions WHERE mmsi=$1', [mmsi]);
  const retained = await client.query(
    'SELECT COUNT(*)::int AS contacts FROM vessel_daily_presence WHERE day=$1 AND mmsi=$2',
    [day, mmsi],
  );
  assert.equal(retained.rows[0].contacts, 3);
  console.log('PASS daily presence: raw parity, same-day dedupe, multiple regions, survives raw prune');
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}
