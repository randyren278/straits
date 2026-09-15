/**
 * Turn a region's recent collection_buckets rows into an observation-quality
 * label with the numbers it was derived from. Pure.
 *
 * "recent"       — latest fix ≤ 60 min old AND ≥ 4 of the last 6 hourly windows
 *                  received at least one message.
 * "intermittent" — latest fix ≤ 24 h old AND ≥ 1 of the last 6 hourly windows
 *                  non-empty.
 * "insufficient" — anything else, including no history at all.
 *
 * Buckets from every source are merged: a fix is a fix regardless of who
 * relayed it. The label is about observation, not traffic — a region that is
 * well observed and empty is "recent" with unique24h = 0.
 */
import {
  INTERMITTENT_MAX_FIX_AGE_HOURS,
  QUALITY_LOOKBACK_HOURS,
  RECENT_MAX_FIX_AGE_MINUTES,
  RECENT_MIN_NONEMPTY_HOURS,
  type ObservationQuality,
} from '../constants/coverage';

export interface QualityBucket {
  bucketStart: Date;
  messageCount: number;
  uniqueMmsi: number;
  latestFix: Date | null;
}

export interface QualityBasis {
  /** Bucket rows seen inside the lookback window (all sources). */
  bucketsLast6h: number;
  /** Hourly windows (of QUALITY_LOOKBACK_HOURS) with ≥ 1 message. */
  nonEmptyLast6h: number;
  latestFix: string | null;
  latestFixAgeMinutes: number | null;
  /** Largest per-bucket unique-MMSI count in the last 24 h (a peak, not a sum). */
  unique24h: number;
}

export interface QualityAssessment {
  quality: ObservationQuality;
  basis: QualityBasis;
}

export function classifyQuality(buckets: readonly QualityBucket[], now: Date): QualityAssessment {
  const nowMs = now.getTime();
  const hourMs = 3_600_000;
  const lookbackMs = QUALITY_LOOKBACK_HOURS * hourMs;

  let latestFix: Date | null = null;
  let unique24h = 0;
  let bucketsLast6h = 0;
  const nonEmptyHours = new Set<number>();

  for (const b of buckets) {
    const age = nowMs - b.bucketStart.getTime();
    if (age < 0) continue;
    if (age <= 24 * hourMs && b.uniqueMmsi > unique24h) unique24h = b.uniqueMmsi;
    if (b.latestFix && (!latestFix || b.latestFix > latestFix)) latestFix = b.latestFix;
    if (age < lookbackMs) {
      bucketsLast6h++;
      if (b.messageCount > 0) nonEmptyHours.add(Math.floor(age / hourMs));
    }
  }

  const latestFixAgeMinutes = latestFix ? Math.round((nowMs - latestFix.getTime()) / 60_000) : null;
  const nonEmptyLast6h = nonEmptyHours.size;

  let quality: ObservationQuality = 'insufficient';
  if (latestFixAgeMinutes !== null) {
    if (latestFixAgeMinutes <= RECENT_MAX_FIX_AGE_MINUTES && nonEmptyLast6h >= RECENT_MIN_NONEMPTY_HOURS) {
      quality = 'recent';
    } else if (latestFixAgeMinutes <= INTERMITTENT_MAX_FIX_AGE_HOURS * 60 && nonEmptyLast6h >= 1) {
      quality = 'intermittent';
    }
  }

  return {
    quality,
    basis: {
      bucketsLast6h,
      nonEmptyLast6h,
      latestFix: latestFix ? latestFix.toISOString() : null,
      latestFixAgeMinutes,
      unique24h,
    },
  };
}
