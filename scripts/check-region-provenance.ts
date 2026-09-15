/**
 * check-region-provenance.ts <region> [--max-age-min N]
 *
 * Exit 0 iff a collection_buckets row for <region> has a bucket_start within
 * the last N minutes (default 20 — two harvest cadences), any source, any
 * count. Prints the newest rows it found either way. Read-only.
 *
 * Usage: npx tsx --env-file=.env.harvester scripts/check-region-provenance.ts hormuz
 */
import { pool } from '../src/lib/db';

const region = process.argv[2];
const maxAgeArg = process.argv.indexOf('--max-age-min');
const maxAgeMin = maxAgeArg > -1 ? Number(process.argv[maxAgeArg + 1]) : 20;
if (!region) { console.error('usage: check-region-provenance.ts <region> [--max-age-min N]'); process.exit(2); }

async function main() {
  const r = await pool.query<{ bucket_start: Date; source: string; message_count: number; unique_mmsi: number; latest_fix: Date | null; run_id: string | null }>(
    `SELECT bucket_start, source, message_count, unique_mmsi, latest_fix, run_id
     FROM collection_buckets WHERE region = $1
     ORDER BY bucket_start DESC, source LIMIT 6`,
    [region],
  );
  await pool.end();
  if (r.rows.length === 0) { console.log(`no collection_buckets rows for ${region}`); process.exit(1); }
  for (const row of r.rows) {
    console.log(`${row.bucket_start.toISOString()} ${region} ${row.source.padEnd(20)} msgs=${row.message_count} mmsi=${row.unique_mmsi} latest_fix=${row.latest_fix?.toISOString() ?? '-'} run=${row.run_id ?? '-'}`);
  }
  const newestAgeMin = (Date.now() - r.rows[0].bucket_start.getTime()) / 60_000;
  if (newestAgeMin > maxAgeMin) {
    console.log(`FAIL — newest ${region} bucket is ${newestAgeMin.toFixed(1)} min old (> ${maxAgeMin})`);
    process.exit(1);
  }
  console.log(`OK — ${region} has a bucket ${newestAgeMin.toFixed(1)} min old`);
}

main().catch((e) => { console.error(e); process.exit(1); });
