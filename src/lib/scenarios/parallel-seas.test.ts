import { describe, expect, it } from 'vitest';
import {
  calculateParallelSeasScenario,
  DEFAULT_SCENARIO,
  haversineDistanceNm,
  parseScenarioValue,
  PARALLEL_SEAS_ROUTES,
  routeDistanceNm,
} from './parallel-seas';

describe('Parallel Seas route calculation', () => {
  it('converts one degree at the equator to about sixty nautical miles', () => {
    expect(haversineDistanceNm([0, 0], [1, 0])).toBeCloseTo(60.04, 1);
  });

  it('uses longer Cape waypoint mileage and keeps distance independent of speed', () => {
    const slow = calculateParallelSeasScenario({ speedKnots: 10, closureDelayDays: 0 });
    const fast = calculateParallelSeasScenario({ speedKnots: 20, closureDelayDays: 0 });
    expect(slow.capeDistanceNm).toBeGreaterThan(slow.suezDistanceNm);
    expect(fast.capeDistanceNm).toBe(slow.capeDistanceNm);
    expect(fast.capeSailingDays).toBeCloseTo(slow.capeSailingDays / 2, 10);
  });

  it('adds the assumed closure delay to the Suez option only', () => {
    const noDelay = calculateParallelSeasScenario({ speedKnots: 12, closureDelayDays: 0 });
    const delayed = calculateParallelSeasScenario({ speedKnots: 12, closureDelayDays: 4.5 });
    expect(delayed.waitTotalDays - noDelay.waitTotalDays).toBeCloseTo(4.5, 10);
    expect(delayed.capeSailingDays).toBe(noDelay.capeSailingDays);
    expect(delayed.capeTimeSavedVsWaitDays - noDelay.capeTimeSavedVsWaitDays).toBeCloseTo(4.5, 10);
  });

  it('calculates extra sailing time from extra nautical miles and speed', () => {
    const result = calculateParallelSeasScenario(DEFAULT_SCENARIO);
    expect(result.capeExtraSailingDays).toBeCloseTo(result.capeExtraNm / (12 * 24), 10);
    expect(routeDistanceNm(PARALLEL_SEAS_ROUTES[1])).toBe(result.capeDistanceNm);
  });

  it('uses safe defaults for malformed or out-of-range shared inputs', () => {
    expect(parseScenarioValue('99', 12, 1, 30)).toBe(12);
    expect(parseScenarioValue('fast', 5, 0, 90)).toBe(5);
    expect(parseScenarioValue(['10', '20'], 12, 1, 30)).toBe(12);
    expect(parseScenarioValue('15.5', 12, 1, 30)).toBe(15.5);
  });

  it('rejects invalid speed and closure assumptions', () => {
    expect(() => calculateParallelSeasScenario({ speedKnots: 0, closureDelayDays: 1 })).toThrow(RangeError);
    expect(() => calculateParallelSeasScenario({ speedKnots: 12, closureDelayDays: 91 })).toThrow(RangeError);
  });
});
