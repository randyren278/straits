/**
 * Recompute Suez daily crossing aggregates from retained raw positions.
 *
 * Runs inside each harvest (bounded by the caller's step budget) and as a
 * CLI for inspection:
 *
 *   npx tsx --env-file=.env.harvester src/services/ais-ingester/crossings-job.ts --dry-run --days 7
 *
 * `--dry-run` prints the aggregates and `incomplete_ratio=<0..1>` (incomplete
 * journeys over all gate entries) without writing. That ratio is the honesty
 * check on the sampling: if most entries never see the far gate, the chart
 * must say so rather than imply a quiet canal.
 */
import { pool } from '../../lib/db';
import { computeCrossings, aggregateDaily } from '../../lib/analytics/crossings';
import { ensureChokepointDailySchema, loadSuezTracks, upsertChokepointDaily } from '../../lib/db/crossings';

export interface CrossingsJobResult {
  days: number;
  tracks: number;
  crossings: number;
  complete: number;
  incomplete: number;
  waiting: number;
  incompleteRatio: number;
  written: number;
}

export async function runSuezCrossingsJob(opts: { days: number; dryRun?: boolean }): Promise<CrossingsJobResult> {
  const tracks = await loadSuezTracks(opts.days);
  const crossings = computeCrossings(tracks);
  const complete = crossings.filter((c) => c.status === 'complete').length;
  const incomplete = crossings.filter((c) => c.status === 'incomplete').length;
  const waiting = crossings.filter((c) => c.status === 'waiting').length;
  const entries = complete + incomplete;
  const daily = aggregateDaily(crossings);
  let written = 0;
  if (!opts.dryRun) {
    await ensureChokepointDailySchema();
    written = await upsertChokepointDaily('suez', daily);
  }
  return {
    days: opts.days, tracks: tracks.size, crossings: crossings.length,
    complete, incomplete, waiting,
    incompleteRatio: entries === 0 ? 0 : incomplete / entries,
    written,
  };
}

const isCli = process.argv[1]?.endsWith('crossings-job.ts');
if (isCli) {
  const dryRun = process.argv.includes('--dry-run');
  const daysArg = process.argv.indexOf('--days');
  const days = daysArg > -1 ? Number(process.argv[daysArg + 1]) : 3;
  runSuezCrossingsJob({ days, dryRun })
    .then(async (r) => {
      await pool.end();
      console.log(JSON.stringify(r, null, 2));
      console.log(`incomplete_ratio=${r.incompleteRatio.toFixed(3)}`);
    })
    .catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
}
