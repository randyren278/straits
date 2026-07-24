/**
 * Chokepoint constants tests.
 * Validates the Gulf of Aden chokepoint entry and overall registry size.
 */
import { describe, it, expect } from 'vitest';
import { CHOKEPOINTS } from './chokepoints-constants';

describe('CHOKEPOINTS', () => {
  it('includes a gulf_of_aden entry', () => {
    expect(CHOKEPOINTS.gulf_of_aden).toBeDefined();
    expect(CHOKEPOINTS.gulf_of_aden.id).toBe('gulf_of_aden');
  });

  it('gulf_of_aden bounds are numbers within the expected ranges', () => {
    const { bounds } = CHOKEPOINTS.gulf_of_aden;

    for (const value of [bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon]) {
      expect(typeof value).toBe('number');
    }

    expect(bounds.minLat).toBeGreaterThanOrEqual(11.0);
    expect(bounds.maxLat).toBeLessThanOrEqual(14.0);
    expect(bounds.minLon).toBeGreaterThanOrEqual(43.0);
    expect(bounds.maxLon).toBeLessThanOrEqual(48.0);
    expect(bounds.minLat).toBeLessThan(bounds.maxLat);
    expect(bounds.minLon).toBeLessThan(bounds.maxLon);
  });

  it('defines at least four chokepoints', () => {
    expect(Object.keys(CHOKEPOINTS).length).toBeGreaterThanOrEqual(4);
  });
});
