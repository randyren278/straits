/**
 * Haversine Distance Tests
 *
 * Tests for great-circle distance and bearing calculations.
 * Expected values based on well-known geographic distances.
 */
import { describe, it, expect } from 'vitest';
import { haversineDistance, calculateBearing } from './haversine';

describe('haversineDistance', () => {
  it('calculates 0.1 degree latitude at equator as ~11.1 km', () => {
    // 0.1 degree of latitude is approximately 11.1 km
    const distance = haversineDistance(0, 0, 0.1, 0);
    expect(distance).toBeCloseTo(11.1, 0);
  });

  it('calculates 1 degree longitude at equator as ~111 km', () => {
    // 1 degree of longitude at equator is approximately 111 km
    const distance = haversineDistance(0, 0, 0, 1);
    expect(distance).toBeCloseTo(111, 0);
  });

  it('calculates ~11.1 km for 0.1 deg latitude in Persian Gulf', () => {
    // Testing at 26.0, 56.0 (Persian Gulf area)
    const distance = haversineDistance(26.0, 56.0, 26.1, 56.0);
    expect(distance).toBeCloseTo(11.1, 0);
  });

  it('returns 0 for same point', () => {
    const distance = haversineDistance(26.5, 56.0, 26.5, 56.0);
    expect(distance).toBe(0);
  });

  it('calculates antipodal points correctly (~20000 km)', () => {
    // Antipodal points (opposite sides of Earth) should be ~20,000 km apart
    const distance = haversineDistance(0, 0, 0, 180);
    expect(distance).toBeCloseTo(20015, -2); // Within 100 km
  });

  it('handles negative coordinates', () => {
    // South/West coordinates
    const distance = haversineDistance(-10, -20, -10.1, -20);
    expect(distance).toBeCloseTo(11.1, 0);
  });
});

describe('calculateBearing', () => {
  it('calculates due north as ~0 degrees', () => {
    // Moving north: lat increases, lon same
    const bearing = calculateBearing(0, 0, 1, 0);
    expect(bearing).toBeCloseTo(0, 0);
  });

  it('calculates due east as ~90 degrees', () => {
    // Moving east: lat same, lon increases
    const bearing = calculateBearing(0, 0, 0, 1);
    expect(bearing).toBeCloseTo(90, 0);
  });

  it('calculates due south as ~180 degrees', () => {
    // Moving south: lat decreases, lon same
    const bearing = calculateBearing(0, 0, -1, 0);
    expect(bearing).toBeCloseTo(180, 0);
  });

  it('calculates due west as ~270 degrees', () => {
    // Moving west: lat same, lon decreases
    const bearing = calculateBearing(0, 0, 0, -1);
    expect(bearing).toBeCloseTo(270, 0);
  });

  it('calculates northeast bearing as ~45 degrees', () => {
    // Moving northeast
    const bearing = calculateBearing(0, 0, 1, 1);
    expect(bearing).toBeCloseTo(45, 0);
  });

  it('returns 0 for same point', () => {
    const bearing = calculateBearing(26.0, 56.0, 26.0, 56.0);
    expect(bearing).toBe(0);
  });

  it('handles high latitude bearing correctly', () => {
    // At high latitudes, bearing calculation is more sensitive
    const bearing = calculateBearing(60, 0, 60.1, 0);
    expect(bearing).toBeCloseTo(0, 0); // Due north
  });
});
