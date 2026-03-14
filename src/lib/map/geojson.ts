/**
 * GeoJSON conversion utilities for vessel map rendering.
 * Requirements: MAP-01, INTL-01, ANOM-01
 */

// Minimal vessel shape needed for GeoJSON conversion.
// Intentionally loose to work with both VesselWithPosition (non-null fields)
// and VesselWithSanctions (nullable vessel metadata, always-present position).
interface VesselForGeoJSON {
  imo: string | null;
  mmsi: string;
  name: string | null;
  flag: string | null;
  shipType: number | null;
  destination: string | null;
  isSanctioned?: boolean;
  sanctioningAuthority?: string | null;
  // Anomaly fields
  anomalyType?: string | null;
  anomalyConfidence?: string | null;
  anomalyDetectedAt?: Date | null;
  position: {
    latitude: number;
    longitude: number;
    speed: number | null;
    course: number | null;
    heading: number | null;
    lowConfidence: boolean;
  } | null;
}

/**
 * Converts an array of vessels with positions to a GeoJSON FeatureCollection.
 * Vessels without positions are skipped.
 *
 * @param vessels - Array of vessels with position data
 * @returns GeoJSON FeatureCollection for map rendering
 */
export function vesselsToGeoJSON(
  vessels: VesselForGeoJSON[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: vessels
      .filter((v) => v.position !== null)
      .map((v) => ({
        type: 'Feature' as const,
        id: v.imo ?? v.mmsi,
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
          // Sanctions properties
          isSanctioned: v.isSanctioned || false,
          sanctioningAuthority: v.sanctioningAuthority || null,
          // Anomaly properties
          hasAnomaly: v.anomalyType !== undefined && v.anomalyType !== null,
          anomalyType: v.anomalyType || null,
          anomalyConfidence: v.anomalyConfidence || null,
        },
      })),
  };
}
