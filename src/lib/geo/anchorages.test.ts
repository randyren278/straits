/**
 * Anchorages Tests
 *
 * Tests for known anchorage area detection.
 * Loitering detection excludes vessels in anchorage zones.
 */
import { describe, it, expect } from 'vitest';
import { ANCHORAGES, isInAnchorage, getAnchorage } from './anchorages';

describe('ANCHORAGES', () => {
  it('contains 8 anchorage zones', () => {
    expect(ANCHORAGES).toHaveLength(8);
  });

  it('includes Fujairah anchorage', () => {
    const anchorage = ANCHORAGES.find(a => a.id === 'fujairah');
    expect(anchorage).toBeDefined();
    expect(anchorage?.name).toBe('Fujairah Anchorage');
  });

  it('includes Kharg Island anchorage', () => {
    const anchorage = ANCHORAGES.find(a => a.id === 'kharg_island');
    expect(anchorage).toBeDefined();
    expect(anchorage?.name).toBe('Kharg Island Anchorage');
  });
});

describe('isInAnchorage', () => {
  it('returns true for point inside Fujairah anchorage', () => {
    // 25.2, 56.4 is inside Fujairah bounds
    expect(isInAnchorage(25.2, 56.4)).toBe(true);
  });

  it('returns true for point inside Kharg Island anchorage', () => {
    // 29.2, 50.3 is inside Kharg Island bounds
    expect(isInAnchorage(29.2, 50.3)).toBe(true);
  });

  it('returns false for point not in any anchorage', () => {
    // 26.0, 56.0 is in Persian Gulf but not an anchorage
    expect(isInAnchorage(26.0, 56.0)).toBe(false);
  });

  it('returns false for open ocean point', () => {
    expect(isInAnchorage(0, 0)).toBe(false);
  });

  it('returns true for Ras Tanura anchorage', () => {
    // 26.7, 50.0 is inside Ras Tanura bounds
    expect(isInAnchorage(26.7, 50.0)).toBe(true);
  });

  it('returns true for point on boundary (inclusive)', () => {
    const fujairah = ANCHORAGES.find(a => a.id === 'fujairah')!;
    expect(isInAnchorage(fujairah.bounds.minLat, fujairah.bounds.minLon)).toBe(true);
  });
});

describe('getAnchorage', () => {
  it('returns Fujairah anchorage for point inside', () => {
    const anchorage = getAnchorage(25.2, 56.4);
    expect(anchorage).not.toBeNull();
    expect(anchorage?.id).toBe('fujairah');
    expect(anchorage?.name).toBe('Fujairah Anchorage');
  });

  it('returns Kharg Island anchorage for point inside', () => {
    const anchorage = getAnchorage(29.2, 50.3);
    expect(anchorage).not.toBeNull();
    expect(anchorage?.id).toBe('kharg_island');
    expect(anchorage?.name).toBe('Kharg Island Anchorage');
  });

  it('returns null for point not in any anchorage', () => {
    const anchorage = getAnchorage(26.0, 56.0);
    expect(anchorage).toBeNull();
  });

  it('returns Jebel Ali anchorage for Dubai port area', () => {
    // 25.0, 55.0 is inside Jebel Ali bounds
    const anchorage = getAnchorage(25.0, 55.0);
    expect(anchorage).not.toBeNull();
    expect(anchorage?.id).toBe('jebel_ali');
  });

  it('returns Suez waiting area for canal approach', () => {
    // 30.0, 32.5 is inside Suez waiting bounds
    const anchorage = getAnchorage(30.0, 32.5);
    expect(anchorage).not.toBeNull();
    expect(anchorage?.id).toBe('suez_waiting');
  });
});
