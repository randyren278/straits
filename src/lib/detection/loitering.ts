/**
 * Loitering Detection
 *
 * Detects vessels that stay within a small radius for extended time outside anchorages.
 * Loitering = vessel stays within 5nm (~9.26km) radius for >6 hours outside known anchorage.
 *
 * This behavior is suspicious as it may indicate ship-to-ship transfer,
 * waiting for instructions, or other irregular activity.
 *
 * Requirements: ANOM-02
 */
import { pool } from '../db';
import { haversineDistance } from '../geo/haversine';
import { isInAnchorage } from '../geo/anchorages';
import { upsertAnomaly } from '../db/anomalies';

/**
 * Position record with timestamp
 */
export interface Position {
  lat: number;
  lon: number;
  time: Date;
}

/**
 * Loitering radius threshold in kilometers.
 * 5 nautical miles = 9.26 km
 */
const LOITERING_RADIUS_KM = 9.26;

/**
 * Calculate the centroid (average position) of a set of positions.
 *
 * @param positions - Array of positions
 * @returns Center point as {lat, lon}
 */
export function calculateCentroid(positions: Position[]): { lat: number; lon: number } {
  const sumLat = positions.reduce((s, p) => s + p.lat, 0);
  const sumLon = positions.reduce((s, p) => s + p.lon, 0);
  return {
    lat: sumLat / positions.length,
    lon: sumLon / positions.length,
  };
}

/**
 * Check if positions indicate loitering behavior.
 * Loitering = all positions within 5nm radius of centroid.
 *
 * @param positions - Array of positions to analyze
 * @returns True if vessel is loitering (all points within radius)
 */
export function isLoiteringBehavior(positions: Position[]): boolean {
  // Need at least 3 positions to determine loitering
  if (positions.length < 3) {
    return false;
  }

  const centroid = calculateCentroid(positions);

  // Check if all positions are within the loitering radius
  const maxDistance = Math.max(
    ...positions.map(p => haversineDistance(centroid.lat, centroid.lon, p.lat, p.lon))
  );

  return maxDistance < LOITERING_RADIUS_KM;
}

/**
 * Detect vessels exhibiting loitering behavior.
 *
 * Process:
 * 1. Query position history from last 6 hours for all vessels
 * 2. Calculate centroid and max radius for each vessel
 * 3. Flag as loitering if radius < 5nm and NOT in anchorage
 *
 * @returns Number of loitering anomalies detected
 */
export async function detectLoitering(): Promise<number> {
  // Get positions from last 6 hours for all vessels, grouped by vessel
  const result = await pool.query<{
    imo: string;
    mmsi: string;
    positions: Position[];
  }>(`
    SELECT v.imo, v.mmsi,
           array_agg(json_build_object(
             'lat', p.latitude,
             'lon', p.longitude,
             'time', p.time
           ) ORDER BY p.time) as positions
    FROM vessels v
    JOIN vessel_positions p ON p.mmsi = v.mmsi
    WHERE p.time > NOW() - INTERVAL '6 hours'
    GROUP BY v.imo, v.mmsi
    HAVING COUNT(*) >= 3
  `);

  let count = 0;

  for (const vessel of result.rows) {
    const positions = vessel.positions;

    // Skip if not enough positions
    if (positions.length < 3) {
      continue;
    }

    // Check if positions indicate loitering
    if (!isLoiteringBehavior(positions)) {
      continue;
    }

    const centroid = calculateCentroid(positions);

    // Skip if in known anchorage (waiting at anchor is normal)
    if (isInAnchorage(centroid.lat, centroid.lon)) {
      continue;
    }

    // Calculate max distance for details
    const maxDistance = Math.max(
      ...positions.map(p => haversineDistance(centroid.lat, centroid.lon, p.lat, p.lon))
    );

    await upsertAnomaly({
      imo: vessel.imo,
      anomalyType: 'loitering',
      confidence: 'confirmed',
      detectedAt: new Date(),
      details: {
        centroid,
        radiusKm: maxDistance,
        durationHours: 6,
      },
    });

    count++;
  }

  return count;
}
