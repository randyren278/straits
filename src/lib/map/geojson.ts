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
  sanctionRiskCategory?: string | null;
  // Anomaly fields
  anomalyType?: string | null;
  anomalyConfidence?: string | null;
  anomalyDetectedAt?: Date | null;
  position: {
    /** Observation time of this fix. Optional for position-only fallbacks. */
    time?: Date | string | null;
    latitude: number;
    longitude: number;
    speed: number | null;
    course: number | null;
    heading: number | null;
    navStatus: number | null;
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
/**
 * Hours since a fix was observed, or null when the fix carries no time.
 * Exposed as a feature property so the map can fade stale contacts.
 */
export function observationAgeHours(time: Date | string | null | undefined, now: number = Date.now()): number | null {
  if (!time) return null;
  const t = time instanceof Date ? time.getTime() : new Date(time).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, (now - t) / 3_600_000);
}

export function vesselsToGeoJSON(
  vessels: VesselForGeoJSON[],
  now: number = Date.now()
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
          navStatus: v.position!.navStatus,
          lowConfidence: v.position!.lowConfidence,
          // Observation time (ISO) and age — the marker's own freshness, not
          // the API response's. Selecting a contact must preserve this.
          time: v.position!.time
            ? (v.position!.time instanceof Date ? v.position!.time.toISOString() : String(v.position!.time))
            : null,
          ageHours: observationAgeHours(v.position!.time, now),
          // Sanctions properties
          isSanctioned: v.isSanctioned || false,
          sanctioningAuthority: v.sanctioningAuthority || null,
          sanctionRiskCategory: v.sanctionRiskCategory || null,
          // Anomaly properties
          hasAnomaly: v.anomalyType !== undefined && v.anomalyType !== null,
          anomalyType: v.anomalyType || null,
          anomalyConfidence: v.anomalyConfidence || null,
        },
      })),
  };
}
