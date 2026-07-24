/**
 * Chokepoint Throughput SPC Index
 *
 * Statistical process control (SPC) over a chokepoint's daily vessel counts.
 * Computes a rolling mean + standard deviation from the trailing window
 * (excluding the current day) and reports the latest day's z-score. A large
 * negative z-score means throughput has collapsed relative to its recent
 * baseline — a fleet-level signal (e.g. a strait closure or diversion event).
 *
 * Query-time only: no continuous aggregate, no laden/ballast split (deferred).
 */
import { pool } from '../db';
import { CHOKEPOINTS } from '../geo/chokepoints';
import { getTrafficByChokepoint } from '../db/analytics';
import { createSystemAlert } from '../db/alerts';
import type { TimeRange } from '@/types/analytics';

/** Trailing window length (days) used to build the baseline mean/stddev. */
export const SPC_WINDOW_DAYS = 14;

/** z-score at or below which the latest throughput is "below the lower band". */
export const SPC_LOWER_Z = -2;

/** Consecutive below-band days required before firing a fleet-level alert. */
export const SPC_CONSECUTIVE_DAYS = 2;

/** A single daily throughput observation. */
export interface DailyCount {
  date: string;
  count: number;
}

/**
 * SPC band result for the latest day in a series.
 * `band` is null during cold start (insufficient history) so callers never
 * emit garbage / infinite z-scores.
 */
export interface SpcBand {
  mean: number;
  stddev: number;
  /** Lower control limit: mean + SPC_LOWER_Z * stddev */
  lower: number;
  /** Upper control limit: mean - SPC_LOWER_Z * stddev */
  upper: number;
  latest: number;
  z: number;
}

/**
 * Compute the SPC band + latest z-score for a daily count series.
 *
 * Uses the trailing `windowDays` observations *before* the latest day as the
 * baseline (population stddev). Returns null when there is not enough history
 * to form a stable baseline, or when the baseline has zero variance.
 *
 * @param series - Daily counts, ordered oldest → newest
 * @param windowDays - Trailing baseline window (default SPC_WINDOW_DAYS)
 * @returns SPC band for the latest day, or null on cold start / zero variance
 */
export function computeSpcBand(
  series: DailyCount[],
  windowDays: number = SPC_WINDOW_DAYS
): SpcBand | null {
  // Need windowDays baseline observations + 1 current day.
  if (series.length < windowDays + 1) return null;

  const latest = series[series.length - 1];
  const baseline = series.slice(series.length - 1 - windowDays, series.length - 1);

  const n = baseline.length;
  const mean = baseline.reduce((sum, d) => sum + d.count, 0) / n;
  const variance = baseline.reduce((sum, d) => sum + (d.count - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  // Zero variance → z-score is undefined/infinite; treat as no band.
  if (stddev === 0) return null;

  const z = (latest.count - mean) / stddev;

  return {
    mean,
    stddev,
    lower: mean + SPC_LOWER_Z * stddev,
    upper: mean - SPC_LOWER_Z * stddev,
    latest: latest.count,
    z,
  };
}

/**
 * Count how many trailing days (ending at the latest) are at or below the
 * lower control band. Used to require a sustained collapse before alerting.
 *
 * @param series - Daily counts, ordered oldest → newest
 * @param windowDays - Trailing baseline window
 * @returns Number of consecutive below-band days at the tail (0 during cold start)
 */
export function consecutiveBelowBand(
  series: DailyCount[],
  windowDays: number = SPC_WINDOW_DAYS
): number {
  let consecutive = 0;
  // Walk backwards from the latest day, recomputing the band as if each day
  // were the "current" one, so the baseline always excludes the day under test.
  for (let end = series.length; end > windowDays; end--) {
    const window = series.slice(0, end);
    const band = computeSpcBand(window, windowDays);
    if (band && band.z <= SPC_LOWER_Z) {
      consecutive++;
    } else {
      break;
    }
  }
  return consecutive;
}

/**
 * Compute the latest SPC band for one chokepoint from daily vessel counts.
 * Thin DB wrapper around computeSpcBand for use by the analytics layer.
 *
 * @param chokepointId - Chokepoint id from CHOKEPOINTS
 * @param range - Time range to pull daily counts over (default '30d')
 * @returns SPC band for the latest day, or null on cold start
 */
export async function getChokepointSpcBand(
  chokepointId: string,
  range: TimeRange = '30d'
): Promise<SpcBand | null> {
  const daily = await getTrafficByChokepoint(chokepointId, range);
  const series: DailyCount[] = daily.map((d) => ({ date: d.date, count: d.vesselCount }));
  return computeSpcBand(series);
}

/**
 * Scan all chokepoints and fire a fleet-level alert when throughput has been
 * below the lower control band for SPC_CONSECUTIVE_DAYS consecutive days.
 *
 * @returns Number of chokepoints that fired a throughput-collapse alert
 */
export async function detectChokepointThroughputAnomalies(): Promise<number> {
  let fired = 0;

  for (const chokepoint of Object.values(CHOKEPOINTS)) {
    const daily = await getTrafficByChokepoint(chokepoint.id, '90d');
    const series: DailyCount[] = daily.map((d) => ({ date: d.date, count: d.vesselCount }));

    const band = computeSpcBand(series);
    if (!band || band.z > SPC_LOWER_Z) continue;
    if (consecutiveBelowBand(series) < SPC_CONSECUTIVE_DAYS) continue;

    await createSystemAlert('chokepoint', chokepoint.id, 'throughput_collapse', {
      chokepoint: chokepoint.id,
      chokepointName: chokepoint.name,
      latest: band.latest,
      mean: band.mean,
      stddev: band.stddev,
      z: band.z,
      lower: band.lower,
    });
    fired++;
  }

  return fired;
}

/**
 * SQL-backed variant computing the latest z-score directly in Postgres using
 * a trailing window (AVG/STDDEV_POP OVER … ROWS BETWEEN N PRECEDING AND 1
 * PRECEDING). Kept for parity; the JS path above is the primary one used by
 * the analytics response. Returns null on cold start (< windowDays baseline).
 *
 * @param chokepointId - Chokepoint id from CHOKEPOINTS
 * @param days - Lookback horizon for daily counts
 * @returns Latest SPC band, or null when insufficient history
 */
export async function getChokepointSpcBandSql(
  chokepointId: string,
  days: number = 90
): Promise<SpcBand | null> {
  const chokepoint = CHOKEPOINTS[chokepointId];
  if (!chokepoint) return null;

  const { minLat, maxLat, minLon, maxLon } = chokepoint.bounds;

  const result = await pool.query<{
    day: Date;
    cnt: string;
    roll_mean: string | null;
    roll_std: string | null;
  }>(`
    WITH daily AS (
      SELECT date_trunc('day', vp.time) AS day,
             COUNT(DISTINCT vp.mmsi) AS cnt
      FROM vessel_positions vp
      WHERE vp.time > NOW() - $1::interval
        AND vp.latitude BETWEEN $2 AND $3
        AND vp.longitude BETWEEN $4 AND $5
      GROUP BY day
    )
    SELECT day, cnt,
           AVG(cnt) OVER w AS roll_mean,
           STDDEV_POP(cnt) OVER w AS roll_std
    FROM daily
    WINDOW w AS (ORDER BY day ROWS BETWEEN ${SPC_WINDOW_DAYS} PRECEDING AND 1 PRECEDING)
    ORDER BY day ASC
  `, [`${days} days`, minLat, maxLat, minLon, maxLon]);

  if (result.rows.length < SPC_WINDOW_DAYS + 1) return null;

  const latestRow = result.rows[result.rows.length - 1];
  const mean = latestRow.roll_mean === null ? null : parseFloat(latestRow.roll_mean);
  const stddev = latestRow.roll_std === null ? null : parseFloat(latestRow.roll_std);
  const latest = parseInt(latestRow.cnt, 10);

  if (mean === null || stddev === null || stddev === 0) return null;

  const z = (latest - mean) / stddev;

  return {
    mean,
    stddev,
    lower: mean + SPC_LOWER_Z * stddev,
    upper: mean - SPC_LOWER_Z * stddev,
    latest,
    z,
  };
}
