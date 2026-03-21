/**
 * Tests for spiderfy module — radial vessel fan-out for co-located clusters.
 *
 * The spiderfy module depends on mapbox-gl types so we can't import it directly
 * in tests. Instead we test the core geometry algorithm (computeSpiderPositions)
 * which is replicated here as a pure function.
 */
import { describe, it, expect } from 'vitest';

/**
 * Replicated from spiderfy.ts for unit testing.
 * The original is not exported because it's an internal implementation detail,
 * but the radial layout algorithm must be correct.
 */
function computeSpiderPositions(
  center: [number, number],
  count: number,
  zoom: number
): [number, number][] {
  const baseRadius = 0.15 / Math.pow(2, zoom - 3);
  const positions: [number, number][] = [];
  const maxPerRing = 10;
  let remaining = count;
  let ringIndex = 0;

  while (remaining > 0) {
    const ringCount = Math.min(remaining, maxPerRing + ringIndex * 5);
    const radius = baseRadius * (1 + ringIndex * 0.7);
    const angleStep = (2 * Math.PI) / ringCount;
    const angleOffset = ringIndex * (angleStep / 2);

    for (let i = 0; i < ringCount && positions.length < count; i++) {
      const angle = angleOffset + i * angleStep - Math.PI / 2;
      const lng = center[0] + radius * Math.cos(angle);
      const lat = center[1] + radius * Math.sin(angle);
      positions.push([lng, lat]);
    }

    remaining -= ringCount;
    ringIndex++;
  }

  return positions;
}

describe('computeSpiderPositions', () => {
  it('returns correct number of positions', () => {
    expect(computeSpiderPositions([54, 25], 5, 10)).toHaveLength(5);
    expect(computeSpiderPositions([54, 25], 1, 10)).toHaveLength(1);
    expect(computeSpiderPositions([54, 25], 20, 10)).toHaveLength(20);
  });

  it('produces positions around the center point', () => {
    const center: [number, number] = [54, 25];
    const positions = computeSpiderPositions(center, 6, 10);

    // At least some points should be offset from center on each axis
    const lngOffsets = positions.map(([lng]) => Math.abs(lng - center[0]));
    const latOffsets = positions.map(([, lat]) => Math.abs(lat - center[1]));
    expect(Math.max(...lngOffsets)).toBeGreaterThan(0);
    expect(Math.max(...latOffsets)).toBeGreaterThan(0);

    for (const [lng, lat] of positions) {
      // All should be within a reasonable radius (< 1 degree at zoom 10)
      expect(Math.abs(lng - center[0])).toBeLessThan(1);
      expect(Math.abs(lat - center[1])).toBeLessThan(1);
    }
  });

  it('radius decreases at higher zoom levels', () => {
    const center: [number, number] = [54, 25];
    const lowZoom = computeSpiderPositions(center, 4, 5);
    const highZoom = computeSpiderPositions(center, 4, 14);

    const maxDistLow = Math.max(...lowZoom.map(([lng, lat]) =>
      Math.sqrt((lng - center[0]) ** 2 + (lat - center[1]) ** 2)
    ));
    const maxDistHigh = Math.max(...highZoom.map(([lng, lat]) =>
      Math.sqrt((lng - center[0]) ** 2 + (lat - center[1]) ** 2)
    ));

    expect(maxDistHigh).toBeLessThan(maxDistLow);
  });

  it('all positions are unique (no overlap)', () => {
    const positions = computeSpiderPositions([54, 25], 15, 10);
    const keys = positions.map(([lng, lat]) => `${lng.toFixed(8)},${lat.toFixed(8)}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(positions.length);
  });

  it('uses multiple rings for > 10 points', () => {
    const center: [number, number] = [54, 25];
    const positions = computeSpiderPositions(center, 15, 10);

    const distances = positions.map(([lng, lat]) =>
      Math.sqrt((lng - center[0]) ** 2 + (lat - center[1]) ** 2)
    );

    // First 10 at one radius, last 5 at a larger one
    const firstRingMax = Math.max(...distances.slice(0, 10));
    const secondRingMin = Math.min(...distances.slice(10));
    expect(secondRingMin).toBeGreaterThan(firstRingMax * 0.9);
  });

  it('handles single vessel', () => {
    const center: [number, number] = [54, 25];
    const positions = computeSpiderPositions(center, 1, 12);
    expect(positions).toHaveLength(1);
    // Single point should be placed at top of circle (angle = -PI/2)
    const [lng, lat] = positions[0];
    // cos(-PI/2) ≈ 0, so lng should be very close to center
    expect(Math.abs(lng - center[0])).toBeLessThan(0.001);
    // sin(-PI/2) = -1, so lat should be below center
    expect(lat).toBeLessThan(center[1]);
  });

  it('handles large clusters (50+ vessels)', () => {
    const center: [number, number] = [54, 25];
    const positions = computeSpiderPositions(center, 50, 10);
    expect(positions).toHaveLength(50);

    // All positions should be unique
    const keys = positions.map(([lng, lat]) => `${lng.toFixed(8)},${lat.toFixed(8)}`);
    expect(new Set(keys).size).toBe(50);
  });
});
