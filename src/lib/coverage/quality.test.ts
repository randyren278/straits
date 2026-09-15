import { describe, it, expect } from 'vitest';
import { classifyQuality, type QualityBucket } from './quality';

const now = new Date('2026-09-15T03:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

/** One bucket per 10 min for `hours` hours, each with `messages`. */
function steady(hours: number, messages: number, unique = messages): QualityBucket[] {
  const out: QualityBucket[] = [];
  for (let m = 10; m <= hours * 60; m += 10) {
    out.push({ bucketStart: minutesAgo(m), messageCount: messages, uniqueMmsi: unique, latestFix: messages ? minutesAgo(m) : null });
  }
  return out;
}

describe('classifyQuality', () => {
  it('no history → insufficient with an empty basis', () => {
    const r = classifyQuality([], now);
    expect(r.quality).toBe('insufficient');
    expect(r.basis).toEqual({ bucketsLast6h: 0, nonEmptyLast6h: 0, latestFix: null, latestFixAgeMinutes: null, unique24h: 0 });
  });

  it('steady sampling with a fresh fix → recent', () => {
    const r = classifyQuality(steady(6, 30), now);
    expect(r.quality).toBe('recent');
    expect(r.basis.nonEmptyLast6h).toBe(6);
    expect(r.basis.latestFixAgeMinutes).toBe(10);
  });

  it('a well-observed but empty region is recent with unique24h = 0 — observation, not traffic', () => {
    // Messages arrived (say, static reports) but no distinct vessels.
    const r = classifyQuality(steady(6, 5, 0), now);
    expect(r.quality).toBe('recent');
    expect(r.basis.unique24h).toBe(0);
  });

  it('fresh fix but only 3 of 6 hours non-empty → intermittent', () => {
    // Non-empty for the most recent 3 h (strictly < 180 min old), zero rows for the 3 h before that.
    const buckets = steady(6, 0).map((b) =>
      now.getTime() - b.bucketStart.getTime() < 3 * 3_600_000
        ? { ...b, messageCount: 20, uniqueMmsi: 20, latestFix: b.bucketStart }
        : b,
    );
    const r = classifyQuality(buckets, now);
    expect(r.quality).toBe('intermittent');
    expect(r.basis.nonEmptyLast6h).toBe(3);
  });

  it('boundary: latest fix exactly 60 min old still counts as recent', () => {
    const buckets = steady(6, 10).map((b) => ({ ...b, latestFix: b.latestFix && b.latestFix > minutesAgo(60) ? minutesAgo(60) : b.latestFix }));
    expect(classifyQuality(buckets, now).quality).toBe('recent');
  });

  it('latest fix 61 min old → intermittent even with dense history', () => {
    const buckets = steady(6, 10).map((b) => ({ ...b, latestFix: b.latestFix && b.latestFix > minutesAgo(61) ? minutesAgo(61) : b.latestFix }));
    const r = classifyQuality(buckets, now);
    expect(r.quality).toBe('intermittent');
    expect(r.basis.latestFixAgeMinutes).toBe(61);
  });

  it('a single fix 23 h ago and zero rows since → intermittent (fix within 24 h, ≥1 non-empty hour)… only if inside the 6 h lookback; otherwise insufficient', () => {
    const old = [{ bucketStart: minutesAgo(23 * 60), messageCount: 3, uniqueMmsi: 3, latestFix: minutesAgo(23 * 60) }];
    // Non-empty hour is outside the 6 h lookback → no non-empty windows → insufficient.
    expect(classifyQuality([...old, ...steady(6, 0)], now).quality).toBe('insufficient');
    // Bring one non-empty bucket inside the lookback → intermittent.
    const recentButSparse = [...old, ...steady(6, 0), { bucketStart: minutesAgo(200), messageCount: 1, uniqueMmsi: 1, latestFix: minutesAgo(200) }];
    expect(classifyQuality(recentButSparse, now).quality).toBe('intermittent');
  });

  it('zero rows only (attempted, nothing arrived) → insufficient, and the attempts are visible in the basis', () => {
    const r = classifyQuality(steady(6, 0), now);
    expect(r.quality).toBe('insufficient');
    expect(r.basis.bucketsLast6h).toBe(35); // the bucket exactly 6 h old is outside the window
    expect(r.basis.nonEmptyLast6h).toBe(0);
  });

  it('latest fix older than 24 h → insufficient regardless of rows', () => {
    const buckets = steady(6, 0).concat([{ bucketStart: minutesAgo(25 * 60), messageCount: 9, uniqueMmsi: 9, latestFix: minutesAgo(25 * 60) }]);
    expect(classifyQuality(buckets, now).quality).toBe('insufficient');
  });

  it('merges sources: two half-empty sources in the same bucket still count as one non-empty hour', () => {
    const buckets: QualityBucket[] = [];
    for (let m = 10; m <= 360; m += 10) {
      buckets.push({ bucketStart: minutesAgo(m), messageCount: 0, uniqueMmsi: 0, latestFix: null });          // aisstream
      buckets.push({ bucketStart: minutesAgo(m), messageCount: 4, uniqueMmsi: 4, latestFix: minutesAgo(m) }); // fallback
    }
    expect(classifyQuality(buckets, now).quality).toBe('recent');
  });
});
