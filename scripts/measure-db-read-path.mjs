/** Bounded read-only production diagnostic. No migrations or data writes.
 * node --env-file=.env.harvester scripts/measure-db-read-path.mjs
 * Uses one connection; each statement is limited to 8 seconds via SET LOCAL.
 * Connection credentials are never included in output.
 */
import pg from 'pg';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const out = process.env.OUT_DIR ?? 'artifacts/performance/db';
await mkdir(out, { recursive: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 8000 });
const started = performance.now();
const client = await pool.connect();
const results = { at: new Date().toISOString(), connectMs: performance.now() - started, probes: {} };
async function probe(name, sql, params = []) {
  await client.query('BEGIN READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout = '8s'");
    const start = performance.now();
    const r = await client.query(sql, params);
    results.probes[name] = { roundTripMs: performance.now() - start, rows: r.rows };
  } catch (e) {
    results.probes[name] = { error: e.message, code: e.code };
  } finally { await client.query('ROLLBACK'); }
  console.log(JSON.stringify({ name, ...results.probes[name] }));
}
try {
  await probe('ping', 'SELECT 1');
  await probe('tables', `SELECT relname, n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze,
    pg_total_relation_size(relid)::text AS bytes FROM pg_stat_user_tables
    WHERE relname IN ('vessel_positions','vessels','vessel_anomalies','collection_buckets','chokepoint_daily')`);
  await probe('indexes', `SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'
    AND tablename IN ('vessel_positions','vessels','vessel_anomalies') ORDER BY tablename,indexname`);
  const constants = await readFile('src/lib/constants/staleness.ts', 'utf8');
  const interval = constants.match(/VESSEL_STALENESS_INTERVAL = '([^']+)'/)[1];
  const cpInterval = constants.match(/CHOKEPOINT_STALENESS_INTERVAL = '([^']+)'/)[1];
  const sanctions = await readFile('src/lib/db/sanctions.ts', 'utf8');
  const vesselSql = sanctions.slice(sanctions.indexOf('export async function getVesselsWithSanctions'))
    .match(/`([\s\S]*?)`/)[1]
    .replace('${VESSEL_STALENESS_INTERVAL}', interval)
    .replace(/\$\{tankersOnly[\s\S]*?: ''\}/, '');
  if (vesselSql.includes('${')) throw new Error('Unresolved vessel SQL template');
  const chokepoints = await readFile('src/lib/geo/chokepoints.ts', 'utf8');
  const cpSql = chokepoints.slice(chokepoints.indexOf('export async function countVesselsInChokepoint'))
    .match(/`([\s\S]*?)`/)[1].replace('${CHOKEPOINT_STALENESS_INTERVAL}', cpInterval);
  const explain = 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ';
  await probe('vesselsPlan', explain + vesselSql);
  const cpConstants = await readFile('src/lib/geo/chokepoints-constants.ts', 'utf8');
  const hormuz = cpConstants.match(/hormuz: \{[\s\S]*?bounds: \{ minLat: ([\d.-]+), maxLat: ([\d.-]+), minLon: ([\d.-]+), maxLon: ([\d.-]+)/);
  if (!hormuz) throw new Error('Cannot read Hormuz bounds');
  await probe('chokepointPlan', explain + cpSql, hormuz.slice(1).map(Number));
  await probe('latestPositionPlan', explain + 'SELECT MAX(time) FROM vessel_positions');
  await probe('connections', `SELECT state, count(*)::int FROM pg_stat_activity
    WHERE datname=current_database() GROUP BY state`);
} finally {
  await writeFile(`${out}/database.json`, JSON.stringify(results, null, 2));
  client.release();
  await pool.end();
}
