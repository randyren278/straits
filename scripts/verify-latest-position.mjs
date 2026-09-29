/** Transactional integration check against a disposable/local Postgres only.
 * DATABASE_URL=postgresql://...@localhost:5432/tanker_tracker node scripts/verify-latest-position.mjs
 */
import pg from 'pg';
import assert from 'node:assert/strict';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost');
if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
  throw new Error('Refusing latest-position fixture on a non-local database');
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  const mmsi = `9${String(process.pid).padStart(8, '0').slice(-8)}`;
  const insert = async (time, lat, lon, source, speed = null) => client.query(
    `INSERT INTO vessel_positions (time,mmsi,latitude,longitude,source,speed)
     VALUES ($1,$2,$3,$4,$5,$6)`, [time, mmsi, lat, lon, source, speed],
  );
  const now = Date.now();
  const earlier = new Date(now - 120_000);
  const latest = new Date(now - 60_000);
  await insert(earlier, 25, 56, 'aisstream');
  await insert(latest, 31, 32, 'middle-east-fallback');
  await insert(earlier, 26, 56, 'aisstream'); // late arrival must not rewind
  await insert(latest, 31.1, 32.1, 'aisstream'); // same time, stronger source
  await insert(latest, 31.1, 32.1, 'aisstream', 12); // same fix, deterministic data tie
  await insert(latest, 31.1, 32.1, 'aisstream', 4);
  const { rows } = await client.query(
    'SELECT time, latitude, longitude, source, speed FROM vessel_latest_positions WHERE mmsi=$1', [mmsi],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].time.getTime(), latest.getTime());
  assert.equal(rows[0].latitude, 31.1);
  assert.equal(rows[0].source, 'aisstream');
  assert.equal(rows[0].speed, 12);
  const { rows: inOldZone } = await client.query(
    `SELECT count(*)::int AS n FROM vessel_latest_positions
     WHERE mmsi=$1 AND latitude BETWEEN 23.5 AND 27 AND longitude BETWEEN 55.5 AND 57.5`, [mmsi],
  );
  assert.equal(inOldZone[0].n, 0, 'moved vessel cannot remain in former chokepoint');
  console.log('PASS latest-position trigger: newer, out-of-order, source tie, departed zone');
} finally {
  await client.query('ROLLBACK');
  await client.end();
}
