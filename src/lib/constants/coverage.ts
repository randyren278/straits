/**
 * Observation-quality thresholds — single source of truth.
 *
 * These decide whether a region is labelled "recent", "intermittent" or
 * "insufficient" from its collection_buckets history. They say nothing about
 * traffic; a region can be perfectly observed and empty.
 */

/** Width of one collection bucket. Matches the harvester's launchd cadence. */
export const BUCKET_MINUTES = 10;

/** Trailing window inspected for the sampling-consistency test. */
export const QUALITY_LOOKBACK_HOURS = 6;

/** Non-empty hourly windows (of QUALITY_LOOKBACK_HOURS) required for "recent". */
export const RECENT_MIN_NONEMPTY_HOURS = 4;

/** Latest fix must be at most this old for "recent". */
export const RECENT_MAX_FIX_AGE_MINUTES = 60;

/** Latest fix must be at most this old for "intermittent". */
export const INTERMITTENT_MAX_FIX_AGE_HOURS = 24;

export type ObservationQuality = 'recent' | 'intermittent' | 'insufficient';

export const QUALITY_LABEL: Record<ObservationQuality, string> = {
  recent: 'Recent observations',
  intermittent: 'Intermittent observations',
  insufficient: 'Insufficient observations',
};
