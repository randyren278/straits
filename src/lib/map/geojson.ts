/**
 * GeoJSON conversion utilities for vessel map rendering.
 * Requirements: MAP-01
 */
import type { VesselWithPosition } from '@/types/vessel';

/**
 * Converts an array of vessels with positions to a GeoJSON FeatureCollection.
 * Vessels without positions are skipped.
 *
 * @param vessels - Array of vessels with position data
 * @returns GeoJSON FeatureCollection for map rendering
 */
export function vesselsToGeoJSON(
  vessels: VesselWithPosition[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: vessels
      .filter((v) => v.position !== null)
      .map((v) => ({
        type: 'Feature' as const,
        id: v.imo,
        geometry: {
          type: 'Point' as const,
          coordinates: [v.position!.longitude, v.position!.latitude],
        },
        properties: {
          mmsi: v.mmsi,
          imo: v.imo,
          name: v.name,
          flag: v.flag,
          shipType: v.shipType,
          destination: v.destination,
          speed: v.position!.speed,
          course: v.position!.course,
          heading: v.position!.heading,
          lowConfidence: v.position!.lowConfidence,
        },
      })),
  };
}
