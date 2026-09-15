import { describe, it, expect } from 'vitest';
import { binPositionsByRegion, bucketStartFor, REGION_IDS } from './buckets';

const now = new Date('2026-09-15T02:47:31Z');
const pos = (mmsi: string, lat: number, lon: number, source = 'aisstream', time = now) =>
  ({ mmsi, latitude: lat, longitude: lon, time, source });

describe('bucketStartFor', () => {
  it('floors to the 10-minute bucket', () => {
    expect(bucketStartFor(now).toISOString()).toBe('2026-09-15T02:40:00.000Z');
  });
});

describe('binPositionsByRegion', () => {
  it('emits a zero row for every region × attempted source when nothing arrived', () => {
    const rows = binPositionsByRegion([], { now, attemptedSources: ['aisstream', 'middle-east-fallback'] });
    expect(rows).toHaveLength(REGION_IDS.length * 2);
    expect(rows.every((r) => r.messageCount === 0 && r.uniqueMmsi === 0 && r.latestFix === null)).toBe(true);
    expect(rows.find((r) => r.region === 'hormuz' && r.source === 'middle-east-fallback')).toBeDefined();
  });

  it('counts a Hormuz fix in the hormuz chokepoint and in every coverage box it falls in, once each', () => {
    // 25.9N 56.4E — inside hormuz, inside Persian Gulf (coverage:0) and Gulf of Oman (coverage:1).
    const rows = binPositionsByRegion([pos('1', 25.9, 56.4)], { now, attemptedSources: ['aisstream'] });
    const hit = (region: string) => rows.find((r) => r.region === region && r.source === 'aisstream')!;
    expect(hit('hormuz').messageCount).toBe(1);
    expect(hit('coverage:0').messageCount).toBe(1);
    expect(hit('coverage:1').messageCount).toBe(1);
    expect(hit('suez').messageCount).toBe(0);
  });

  it('a position exactly on a box edge is counted', () => {
    const rows = binPositionsByRegion([pos('1', 23.5, 55.5)], { now, attemptedSources: ['aisstream'] });
    expect(rows.find((r) => r.region === 'hormuz')!.messageCount).toBe(1);
  });

  it('tracks unique MMSIs and the latest fix separately from message count', () => {
    const earlier = new Date('2026-09-15T02:41:00Z');
    const rows = binPositionsByRegion(
      [pos('a', 30.5, 32.3, 'aisstream', earlier), pos('a', 30.6, 32.3, 'aisstream', now), pos('b', 30.7, 32.3)],
      { now, attemptedSources: ['aisstream'] },
    );
    const suez = rows.find((r) => r.region === 'suez')!;
    expect(suez.messageCount).toBe(3);
    expect(suez.uniqueMmsi).toBe(2);
    expect(suez.latestFix).toEqual(now);
  });

  it('keeps sources apart and carries the run id', () => {
    const rows = binPositionsByRegion(
      [pos('a', 26.2, 56.4, 'middle-east-fallback'), pos('b', 30.5, 32.3, 'aisstream')],
      { now, attemptedSources: ['aisstream', 'middle-east-fallback'], runId: 'run-1' },
    );
    expect(rows.find((r) => r.region === 'hormuz' && r.source === 'aisstream')!.messageCount).toBe(0);
    expect(rows.find((r) => r.region === 'hormuz' && r.source === 'middle-east-fallback')!.messageCount).toBe(1);
    expect(rows.every((r) => r.runId === 'run-1')).toBe(true);
  });
});

describe('binPositionsByRegion — per-region attempts', () => {
  it('emits a zero fallback row only for the regions where the fallback was tried', () => {
    const rows = binPositionsByRegion([], {
      now, attemptedSources: ['aisstream'], attemptedByRegion: { hormuz: ['middle-east-fallback'] },
    });
    expect(rows.find((r) => r.region === 'hormuz' && r.source === 'middle-east-fallback')).toBeDefined();
    expect(rows.find((r) => r.region === 'suez' && r.source === 'middle-east-fallback')).toBeUndefined();
    expect(rows.filter((r) => r.source === 'aisstream')).toHaveLength(REGION_IDS.length);
  });
});
