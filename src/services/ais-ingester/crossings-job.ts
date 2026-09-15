/**
 * Recompute Suez daily crossing aggregates from retained raw positions.
 *
 * Window discipline: tracks are loaded from a UTC day boundary with
 * `bufferDays` whole days before the first day written, and only the last
 * `writeDays` days are upserted. A window that starts mid-day truncates
 * gate-in fixes and would freeze a day at a partial count; the buffer keeps
 * every written day's transits (≤ ~16 h) and 48 h incomplete horizon inside
 * the loaded tracks. Days with nothing observed are written as zeros.
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
import { computeCrossings, aggregateDailyRange, dayRange, utcDay } from '../../lib/analytics/crossings';
import { ensureChokepointDailySchema, loadSuezTracks, upsertChokepointDaily } from '../../lib/db/crossings';

export interface CrossingsJobResult {
  writeDays: string[];
  loadedSince: string;
  tracks: number;
  crossings: number;
  complete: number;
  incomplete: number;
  waiting: number;
  incompleteRatio: number;
  written: number;
}

export async function runSuezCrossingsJob(opts: { days: number; bufferDays?: number; dryRun?: boolean; now?: Date }): Promise<CrossingsJobResult> {
  const now = opts.now ?? new Date();
  const bufferDays = opts.bufferDays ?? 2;
  const writeDays = dayRange(utcDay(now), opts.days);
  const since = new Date(Date.parse(`${writeDays[0]}T00:00:00Z`) - bufferDays * 86_400_000);

  const tracks = await loadSuezTracks(since, now);
  const crossings = computeCrossings(tracks);
  const daily = aggregateDailyRange(crossings, writeDays);
  const complete = daily.reduce((s, d) => s + d.northbound + d.southbound, 0);
  const incomplete = daily.reduce((s, d) => s + d.incomplete, 0);
  const waiting = daily.reduce((s, d) => s + d.waiting, 0);
  const entries = complete + incomplete;
  let written = 0;
  if (!opts.dryRun) {
    await ensureChokepointDailySchema();
    written = await upsertChokepointDaily('suez', daily);
  }
  return {
    writeDays, loadedSince: since.toISOString(), tracks: tracks.size, crossings: crossings.length,
    complete, incomplete, waiting,
    incompleteRatio: entries === 0 ? 0 : incomplete / entries,
    written,
  };
}

const isCli = process.argv[1]?.endsWith('crossings-job.ts');
if (isCli) {
  const dryRun = process.argv.includes('--dry-run');
  const daysArg = process.argv.indexOf('--days');
  const days = daysArg > -1 ? Number(process.argv[daysArg + 1]) : 2;
  runSuezCrossingsJob({ days, dryRun })
    .then(async (r) => {
      await pool.end();
      console.log(JSON.stringify(r, null, 2));
      console.log(`incomplete_ratio=${r.incompleteRatio.toFixed(3)}`);
    })
    .catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
}
