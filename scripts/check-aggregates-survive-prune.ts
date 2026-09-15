/**
 * Prove chokepoint_daily outlives the raw-position prune.
 *
 * Inserts a 30-day-old aggregate row, runs the harvester's exact prune
 * statement, and asserts the row is still there. Against the LOCAL database
 * only — run with DATABASE_URL pointing at the docker container.
 */
import { pool } from '../src/lib/db';
import { ensureChokepointDailySchema } from '../src/lib/db/crossings';

const CHOKEPOINT = 'suez';
const RETENTION_DAYS = 7;

async function main() {
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? '')) {
    throw new Error('refusing to run against a non-local DATABASE_URL');
  }
  await ensureChokepointDailySchema();
  const day = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  await pool.query(
    `INSERT INTO chokepoint_daily (chokepoint, day, northbound, southbound, waiting, incomplete, distinct_mmsi)
     VALUES ($1, $2, 1, 2, 3, 4, 5)
     ON CONFLICT (chokepoint, day) DO UPDATE SET northbound = 1`,
    [CHOKEPOINT, day],
  );
  // Same statement as pruneAndMeasure() in harvest-once.ts.
  await pool.query(`DELETE FROM vessel_positions WHERE time < NOW() - ($1 || ' days')::interval`, [String(RETENTION_DAYS)]);
  const r = await pool.query<{ northbound: number }>(
    'SELECT northbound FROM chokepoint_daily WHERE chokepoint = $1 AND day = $2', [CHOKEPOINT, day],
  );
  await pool.end();
  if (r.rows.length !== 1) { console.log(`FAIL — aggregate row for ${day} missing after prune`); process.exit(1); }
  console.log(`OK — chokepoint_daily row for ${day} survived a ${RETENTION_DAYS}-day prune`);
}

main().catch((e) => { console.error(e); process.exit(1); });
