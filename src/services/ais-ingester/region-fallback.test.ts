import { describe, it, expect, vi } from 'vitest';
import {
  collectRegionFallback, mergePositions, summarizeRegionCoverage, FALLBACK_REGIONS,
} from './region-fallback';
import type { MiddleEastFallbackPosition } from './middle-east-fallback';

const now = new Date('2026-09-15T03:00:00Z');
const fb = (mmsi: string, lat: number, lon: number, time = now): MiddleEastFallbackPosition => ({
  time, mmsi, latitude: lat, longitude: lon, speed: null, course: null, heading: null, navStatus: null, name: mmsi, shipType: 80,
});
const suezFix = { latitude: 30.5, longitude: 32.3 };
const hormuzFix = { latitude: 26.0, longitude: 56.4 };

describe('FALLBACK_REGIONS', () => {
  it('is exactly the four chokepoint boxes — never the wide coverage boxes', () => {
    expect(FALLBACK_REGIONS.map((r) => r.id).sort()).toEqual(['babel_mandeb', 'gulf_of_aden', 'hormuz', 'suez']);
  });
});

describe('collectRegionFallback', () => {
  const hormuz = FALLBACK_REGIONS.find((r) => r.id === 'hormuz')!;
  const bab = FALLBACK_REGIONS.find((r) => r.id === 'babel_mandeb')!;

  it('merges positions from every region and records each attempt', async () => {
    const fetch = vi.fn(async (box: { minLat: number }) => box.minLat > 20 ? [fb('h1', 26, 56.4)] : [fb('b1', 12.5, 43.5)]);
    const r = await collectRegionFallback([hormuz, bab], fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect([...r.positions.keys()].sort()).toEqual(['b1', 'h1']);
    expect(r.attempted.sort()).toEqual(['babel_mandeb', 'hormuz']);
    expect(r.errors).toEqual({});
  });

  it('one failing box leaves the others intact and is reported by region', async () => {
    const fetch = vi.fn(async (box: { minLat: number }) => {
      if (box.minLat > 20) throw new Error('HTTP 503');
      return [fb('b1', 12.5, 43.5)];
    });
    const r = await collectRegionFallback([hormuz, bab], fetch);
    expect([...r.positions.keys()]).toEqual(['b1']);
    expect(r.errors).toEqual({ hormuz: 'HTTP 503' });
    expect(r.attempted.sort()).toEqual(['babel_mandeb', 'hormuz']);
  });

  it('keeps the latest fix when overlapping boxes report the same MMSI', async () => {
    const older = new Date(now.getTime() - 60_000);
    const fetch = vi.fn()
      .mockResolvedValueOnce([fb('x', 12.5, 43.5, older)])
      .mockResolvedValueOnce([fb('x', 12.6, 43.6, now)]);
    const r = await collectRegionFallback([bab, FALLBACK_REGIONS.find((q) => q.id === 'gulf_of_aden')!], fetch);
    expect(r.positions.get('x')!.latitude).toBe(12.6);
  });
});

describe('mergePositions', () => {
  it('primary wins on a shared MMSI, fallback fills the gaps', () => {
    const primary = new Map([['a', { mmsi: 'a', v: 'primary' }]]);
    const fallback = new Map([['a', { mmsi: 'a', v: 'fallback' }], ['b', { mmsi: 'b', v: 'fallback' }]]);
    const m = mergePositions(primary, fallback);
    expect(m.get('a')!.v).toBe('primary');
    expect(m.get('b')!.v).toBe('fallback');
    expect(primary.size).toBe(1);
  });
});

describe('summarizeRegionCoverage', () => {
  it('reports per-source counts, null for a fallback that was not attempted, and errors', () => {
    const positions = [
      { ...suezFix, source: 'aisstream' as const },
      { ...hormuzFix, source: 'middle-east-fallback' as const },
      { ...hormuzFix, source: 'middle-east-fallback' as const },
    ];
    const s = summarizeRegionCoverage(positions, ['hormuz', 'babel_mandeb', 'gulf_of_aden'], { babel_mandeb: 'HTTP 503' });
    expect(s.suez).toEqual({ aisstream: 1, 'middle-east-fallback': null });
    expect(s.hormuz).toEqual({ aisstream: 0, 'middle-east-fallback': 2 });
    expect(s.babel_mandeb).toEqual({ aisstream: 0, 'middle-east-fallback': 0, error: 'HTTP 503' });
    expect(s.gulf_of_aden).toEqual({ aisstream: 0, 'middle-east-fallback': 0 });
  });
});
