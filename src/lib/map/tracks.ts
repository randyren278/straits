/**
 * Track building utilities for vessel history visualization.
 * Requirements: MAP-04
 */
import type { VesselPosition } from '@/types/vessel';

/**
 * Build a GeoJSON LineString from vessel position history.
 * Positions are sorted chronologically for proper track direction.
 *
 * @param positions - Array of position reports for a vessel
 * @returns GeoJSON LineString feature, or null if insufficient positions
 */
export function buildTrackLine(
  positions: VesselPosition[]
): GeoJSON.Feature<GeoJSON.LineString> | null {
  if (positions.length < 2) {
    return null;
  }

  // Sort by time ascending for proper line direction
  const sorted = [...positions].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: sorted.map((p) => [p.longitude, p.latitude]),
    },
    properties: {
      mmsi: sorted[0].mmsi,
      startTime: sorted[0].time,
      endTime: sorted[sorted.length - 1].time,
      pointCount: sorted.length,
    },
  };
}
