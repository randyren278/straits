/**
 * Chokepoint Throughput SPC Index Tests
 *
 * Verifies the rolling z-score math over a synthetic daily-count series and the
 * cold-start guard (a series with < 14 baseline days returns no band).
 */
import { describe, it, expect } from 'vitest';
import {
  computeSpcBand,
  consecutiveBelowBand,
  SPC_WINDOW_DAYS,
  type DailyCount,
} from './spc-index';

/** Build a synthetic series of `n` days with a constant count. */
function flat(n: number, count: number): DailyCount[] {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    count,
  }));
}

describe('computeSpcBand', () => {
  it('computes the correct z-score for the latest day', () => {
    // 14 baseline days at count=100, then a collapse day at 40.
    // population stddev of the baseline is 0 → zero variance, so vary it.
    const baseline = flat(SPC_WINDOW_DAYS, 100);
    // Perturb baseline to give it variance: alternate 90/110 (mean 100, std 10).
    baseline.forEach((d, i) => (d.count = i % 2 === 0 ? 90 : 110));
    const series: DailyCount[] = [...baseline, { date: '2026-02-01', count: 40 }];

    const band = computeSpcBand(series);
    expect(band).not.toBeNull();
    expect(band!.mean).toBeCloseTo(100, 6);
    expect(band!.stddev).toBeCloseTo(10, 6);
    // z = (40 - 100) / 10 = -6
    expect(band!.z).toBeCloseTo(-6, 6);
    expect(band!.lower).toBeCloseTo(80, 6); // mean + (-2)*std
    expect(band!.latest).toBe(40);
  });

  it('returns null on cold start (< 14 baseline days)', () => {
    // Only 10 days total → cannot form a 14-day baseline + current day.
    const series = flat(10, 50);
    expect(computeSpcBand(series)).toBeNull();
  });

  it('returns null when the baseline has zero variance', () => {
    // 14 identical baseline days → stddev 0 → z undefined → no band.
    const series: DailyCount[] = [...flat(SPC_WINDOW_DAYS, 100), { date: '2026-02-01', count: 40 }];
    expect(computeSpcBand(series)).toBeNull();
  });

  it('gives a positive z-score for an above-baseline surge', () => {
    const baseline = flat(SPC_WINDOW_DAYS, 100);
    baseline.forEach((d, i) => (d.count = i % 2 === 0 ? 90 : 110));
    const series: DailyCount[] = [...baseline, { date: '2026-02-01', count: 160 }];

    const band = computeSpcBand(series);
    expect(band).not.toBeNull();
    expect(band!.z).toBeCloseTo(6, 6);
  });
});

describe('consecutiveBelowBand', () => {
  it('counts sustained below-band days at the tail', () => {
    // Build variance in the earliest baseline, then two collapse days.
    const base: DailyCount[] = Array.from({ length: SPC_WINDOW_DAYS + 2 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      count: i < SPC_WINDOW_DAYS ? (i % 2 === 0 ? 90 : 110) : 20,
    }));
    // Last two days (20) sit far below the baseline band.
    expect(consecutiveBelowBand(base)).toBeGreaterThanOrEqual(2);
  });

  it('returns 0 for a stable series with no collapse', () => {
    const base: DailyCount[] = Array.from({ length: SPC_WINDOW_DAYS + 2 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      count: i % 2 === 0 ? 90 : 110,
    }));
    expect(consecutiveBelowBand(base)).toBe(0);
  });
});
