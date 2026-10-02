import { describe, expect, it } from 'vitest';
import { interpretCollectionInterval, interpretHourlyCoverage, interpretVesselGaps } from './diagnostics';

describe('coverage diagnostics interpretation', () => {
  it('distinguishes zero-fix recorded windows from no collection records', () => {
    const now = new Date('2026-10-01T12:40:00.000Z');
    const cells = interpretHourlyCoverage([
      { bucketStart: '2026-10-01T11:10:00.000Z', source: 'primary', messageCount: 0, latestFix: null },
      { bucketStart: '2026-10-01T11:20:00.000Z', source: 'fallback', messageCount: 3, latestFix: null },
    ], now);
    expect(cells).toHaveLength(48);
    expect(cells.find((cell) => cell.hour === '2026-10-01T11:00:00.000Z')).toEqual({
      hour: '2026-10-01T11:00:00.000Z', recordedWindows: 2, activeWindows: 1, sourceReportedFixes: 3, sources: ['primary', 'fallback'],
    });
    expect(cells.find((cell) => cell.hour === '2026-10-01T10:00:00.000Z')?.sourceReportedFixes).toBeNull();
  });

  it('compares regional collection with the exact vessel-gap interval', () => {
    const evidence = interpretCollectionInterval([
      { bucketStart: '2026-10-01T11:00:00.000Z', source: 'primary', messageCount: 1, latestFix: null },
      { bucketStart: '2026-10-01T11:10:00.000Z', source: 'primary', messageCount: 0, latestFix: null },
      { bucketStart: '2026-10-01T11:10:00.000Z', source: 'fallback', messageCount: 4, latestFix: null },
      { bucketStart: '2026-10-01T11:20:00.000Z', source: 'primary', messageCount: 0, latestFix: null },
    ], '2026-10-01T11:09:00.000Z', '2026-10-01T11:21:00.000Z');
    expect(evidence).toEqual({ recordedWindows: 3, activeWindows: 2, sourceReportedFixes: 5, sources: ['primary', 'fallback'] });
  });

  it('uses insufficient-history language until there are two fixes', () => {
    expect(interpretVesselGaps({ count: 1, firstFix: null, lastFix: null, longestGapSeconds: null, longestGapStart: null, longestGapEnd: null }))
      .toEqual({ status: 'insufficient_history', count: 1, longestGapSeconds: null });
    expect(interpretVesselGaps({ count: 3, firstFix: null, lastFix: null, longestGapSeconds: 600, longestGapStart: 'a', longestGapEnd: 'b' }))
      .toMatchObject({ status: 'observed_gaps', longestGapSeconds: 600, longestGapStart: 'a', longestGapEnd: 'b' });
  });
});
