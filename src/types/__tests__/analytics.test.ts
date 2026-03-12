import { describe, it, expect } from 'vitest';
import type { TimeRange, DailyTrafficPoint, TrafficWithPrices, RouteRegion, RouteTrafficPoint } from '../analytics';
import { timeRangeToDays } from '../analytics';

describe('TimeRange type', () => {
  it('accepts valid time ranges', () => {
    const ranges: TimeRange[] = ['7d', '30d', '90d'];
    expect(ranges).toHaveLength(3);
  });
});

describe('timeRangeToDays', () => {
  it('converts 7d to 7 days', () => {
    expect(timeRangeToDays('7d')).toBe(7);
  });

  it('converts 30d to 30 days', () => {
    expect(timeRangeToDays('30d')).toBe(30);
  });

  it('converts 90d to 90 days', () => {
    expect(timeRangeToDays('90d')).toBe(90);
  });
});

describe('DailyTrafficPoint interface', () => {
  it('has required properties', () => {
    const point: DailyTrafficPoint = {
      date: '2026-03-01',
      vesselCount: 10,
      tankerCount: 5,
    };
    expect(point.date).toBe('2026-03-01');
    expect(point.vesselCount).toBe(10);
    expect(point.tankerCount).toBe(5);
  });
});

describe('TrafficWithPrices interface', () => {
  it('extends DailyTrafficPoint with optional oilPrice', () => {
    const withPrice: TrafficWithPrices = {
      date: '2026-03-01',
      vesselCount: 10,
      tankerCount: 5,
      oilPrice: 75.50,
    };
    expect(withPrice.oilPrice).toBe(75.50);

    const withoutPrice: TrafficWithPrices = {
      date: '2026-03-01',
      vesselCount: 10,
      tankerCount: 5,
    };
    expect(withoutPrice.oilPrice).toBeUndefined();
  });
});

describe('RouteRegion type', () => {
  it('accepts valid route regions', () => {
    const regions: RouteRegion[] = ['east_asia', 'europe', 'americas', 'unknown'];
    expect(regions).toHaveLength(4);
  });
});

describe('RouteTrafficPoint interface', () => {
  it('extends DailyTrafficPoint with route', () => {
    const point: RouteTrafficPoint = {
      date: '2026-03-01',
      vesselCount: 10,
      tankerCount: 5,
      route: 'east_asia',
    };
    expect(point.route).toBe('east_asia');
  });
});
