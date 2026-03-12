/**
 * Coverage Zones Tests
 *
 * Tests for AIS terrestrial coverage zone detection.
 * Going dark detection only applies within these zones.
 */
import { describe, it, expect } from 'vitest';
import { COVERAGE_ZONES, isInCoverageZone, getCoverageZone } from './coverage-zones';

describe('COVERAGE_ZONES', () => {
  it('contains 5 zones', () => {
    expect(COVERAGE_ZONES).toHaveLength(5);
  });

  it('includes persian_gulf zone', () => {
    const zone = COVERAGE_ZONES.find(z => z.id === 'persian_gulf');
    expect(zone).toBeDefined();
    expect(zone?.name).toBe('Persian Gulf');
  });

  it('includes red_sea_south zone', () => {
    const zone = COVERAGE_ZONES.find(z => z.id === 'red_sea_south');
    expect(zone).toBeDefined();
    expect(zone?.name).toBe('Red Sea (South) / Bab el-Mandeb');
  });
});

describe('isInCoverageZone', () => {
  it('returns true for point in Persian Gulf', () => {
    // 26.5, 56.0 is clearly inside Persian Gulf bounds
    expect(isInCoverageZone(26.5, 56.0)).toBe(true);
  });

  it('returns true for point in Red Sea South', () => {
    // 15.0, 42.0 is inside Red Sea South / Bab el-Mandeb
    expect(isInCoverageZone(15.0, 42.0)).toBe(true);
  });

  it('returns false for point in open ocean', () => {
    // 0, 0 is in the Atlantic - not in any coverage zone
    expect(isInCoverageZone(0, 0)).toBe(false);
  });

  it('returns false for Arabian Sea (satellite only)', () => {
    // 18.0, 65.0 is in the Arabian Sea - outside terrestrial coverage
    expect(isInCoverageZone(18.0, 65.0)).toBe(false);
  });

  it('returns true for point on zone boundary (inclusive)', () => {
    // Test exact boundary of Persian Gulf
    const persianGulf = COVERAGE_ZONES.find(z => z.id === 'persian_gulf')!;
    expect(isInCoverageZone(persianGulf.bounds.minLat, persianGulf.bounds.minLon)).toBe(true);
  });

  it('returns true for Suez approaches', () => {
    // 30.5, 33.0 is in Suez approaches
    expect(isInCoverageZone(30.5, 33.0)).toBe(true);
  });
});

describe('getCoverageZone', () => {
  it('returns persian_gulf zone for point in Persian Gulf', () => {
    const zone = getCoverageZone(26.5, 56.0);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe('persian_gulf');
    expect(zone?.name).toBe('Persian Gulf');
  });

  it('returns red_sea_north zone for northern Red Sea point', () => {
    const zone = getCoverageZone(25.0, 36.0);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe('red_sea_north');
  });

  it('returns null for point in open ocean', () => {
    const zone = getCoverageZone(0, 0);
    expect(zone).toBeNull();
  });

  it('returns suez_approaches for Suez Canal area', () => {
    // 31.0, 32.5 is uniquely in Suez approaches (above red_sea_north's maxLat)
    const zone = getCoverageZone(31.0, 32.5);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe('suez_approaches');
  });

  it('returns oman_coast for Gulf of Oman', () => {
    const zone = getCoverageZone(24.0, 58.0);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe('oman_coast');
  });
});
