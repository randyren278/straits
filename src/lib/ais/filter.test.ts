/**
 * Tests for GPS data quality filtering.
 * Requirements: DATA-04
 */
import { describe, it, expect } from 'vitest';
import { filterPosition, isInJammingZone } from './filter';
import type { VesselPosition } from '@/types/vessel';

const basePosition: VesselPosition = {
  time: new Date(),
  mmsi: '123456789',
  imo: null,
  latitude: 26.0,
  longitude: 56.0,
  speed: 10,
  course: 90,
  heading: 90,
  navStatus: 0,
  lowConfidence: false,
};

describe('GPS filter', () => {
  describe('speed validation', () => {
    it('rejects positions with speed > 50 knots', () => {
      const result = filterPosition({ ...basePosition, speed: 55 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('speed');
    });

    it('accepts positions with speed <= 50 knots', () => {
      const result = filterPosition({ ...basePosition, speed: 15 });
      expect(result.valid).toBe(true);
    });

    it('accepts positions with exactly 50 knots', () => {
      const result = filterPosition({ ...basePosition, speed: 50 });
      expect(result.valid).toBe(true);
    });

    it('accepts positions with null speed', () => {
      const result = filterPosition({ ...basePosition, speed: null });
      expect(result.valid).toBe(true);
    });
  });

  describe('GPS jamming zone detection', () => {
    it('flags positions in GPS jamming zones as low_confidence', () => {
      // Persian Gulf position
      const result = filterPosition({ ...basePosition, latitude: 26.5, longitude: 52.0 });
      expect(result.valid).toBe(true);
      expect(result.position?.lowConfidence).toBe(true);
    });

    it('does not flag positions outside jamming zones', () => {
      // Open ocean position (Indian Ocean)
      const result = filterPosition({ ...basePosition, latitude: 0, longitude: 70.0 });
      expect(result.valid).toBe(true);
      expect(result.position?.lowConfidence).toBe(false);
    });

    it('returns position data when valid', () => {
      const result = filterPosition(basePosition);
      expect(result.position).not.toBeNull();
      expect(result.position?.mmsi).toBe('123456789');
    });

    it('returns null position when invalid', () => {
      const result = filterPosition({ ...basePosition, speed: 60 });
      expect(result.position).toBeNull();
    });
  });
});

describe('isInJammingZone', () => {
  it('returns true for Persian Gulf', () => {
    expect(isInJammingZone(26.5, 52.0)).toBe(true);
  });

  it('returns true for Red Sea', () => {
    expect(isInJammingZone(15.0, 42.0)).toBe(true);
  });

  it('returns false for open ocean', () => {
    expect(isInJammingZone(0, 70.0)).toBe(false);
  });

  it('returns true for Strait of Hormuz', () => {
    expect(isInJammingZone(26.5, 56.0)).toBe(true);
  });

  it('returns false for Mediterranean Sea', () => {
    expect(isInJammingZone(35.0, 20.0)).toBe(false);
  });

  it('returns true for boundary of Persian Gulf zone', () => {
    // At min lat boundary
    expect(isInJammingZone(24, 52.0)).toBe(true);
    // At max lat boundary
    expect(isInJammingZone(30, 52.0)).toBe(true);
  });

  it('returns false just outside Persian Gulf zone', () => {
    expect(isInJammingZone(23.9, 52.0)).toBe(false);
    expect(isInJammingZone(30.1, 52.0)).toBe(false);
  });
});
