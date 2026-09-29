/** Read-only seven-day field report from sampled first-party observations.
 * node --env-file=.env.harvester scripts/report-performance.mjs
 * The output is aggregated; no sample IDs or connection credentials appear.
 */
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 8000 });
const client = await pool.connect();
try {
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '8s'");
  const result = await client.query(`
    SELECT route, device, connection, metric, build_sha AS "buildSha",
           COUNT(*)::int AS samples,
           ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY value))::numeric, 2) AS p50,
           ROUND((percentile_cont(0.75) WITHIN GROUP (ORDER BY value))::numeric, 2) AS p75,
           ROUND((percentile_cont(0.95) WITHIN GROUP (ORDER BY value))::numeric, 2) AS p95,
           MAX(updated_at) AS "lastSampleAt"
    FROM performance_samples
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY route, device, connection, metric, build_sha
    ORDER BY route, device, connection, metric, build_sha
  `);
  console.log(JSON.stringify({
    at: new Date().toISOString(), windowDays: 7, minimumSamplesForAssessment: 100,
    rows: result.rows.map((row) => ({ ...row, assessmentReady: row.samples >= 100 })),
  }, null, 2));
  await client.query('ROLLBACK');
} finally {
  client.release();
  await pool.end();
}
