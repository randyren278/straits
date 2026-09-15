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
  const attemptedBuckets = new Set<number>();
  const nonEmptyHours = new Set<number>();

  // Rows may arrive one per source; merge them per bucket first so a two-source
  // harvest is one attempt and its unique counts add (sources are disjoint).
  const merged = new Map<number, { messages: number; unique: number; latest: Date | null }>();
  for (const b of buckets) {
    const key = b.bucketStart.getTime();
    const m = merged.get(key) ?? { messages: 0, unique: 0, latest: null };
    m.messages += b.messageCount;
    m.unique += b.uniqueMmsi;
    if (b.latestFix && (!m.latest || b.latestFix > m.latest)) m.latest = b.latestFix;
    merged.set(key, m);
  }

  for (const [start, b] of merged) {
    const age = nowMs - start;
    if (age < 0) continue;
    if (age <= 24 * hourMs && b.unique > unique24h) unique24h = b.unique;
    if (b.latest && (!latestFix || b.latest > latestFix)) latestFix = b.latest;
    if (age < lookbackMs) {
      attemptedBuckets.add(start);
      if (b.messages > 0) nonEmptyHours.add(Math.floor(age / hourMs));
    }
  }
  const bucketsLast6h = attemptedBuckets.size;

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
