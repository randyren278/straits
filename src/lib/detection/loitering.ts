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
import { isDeclaredStationary } from '../ais/nav-status';
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
 * Maximum age (minutes) of a nav_status report for it to be trusted for
 * suppression. Stale declared statuses are ignored — a vessel that declared
 * itself moored hours ago may since have moved.
 */
const NAV_STATUS_FRESHNESS_MINUTES = 15;

/**
 * Decide whether an anomaly should be suppressed based on a declared
 * navigational status. Suppress only when the vessel declares itself at anchor
 * (1) or moored (5) AND the status report is fresh (within the freshness
 * window). Null status or stale status never suppresses.
 *
 * @param navStatus - AIS nav_status code, or null if not reported
 * @param positionAgeMinutes - Age of the position report in minutes
 * @returns True if the anomaly should be suppressed as a false positive
 */
export function shouldSuppressForNavStatus(
  navStatus: number | null,
  positionAgeMinutes: number
): boolean {
  return isDeclaredStationary(navStatus) && positionAgeMinutes <= NAV_STATUS_FRESHNESS_MINUTES;
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
  // Get positions from last 6 hours for all vessels, grouped by vessel.
  // Also surface the most recent nav_status and its timestamp so a fresh
  // declared "at anchor"/"moored" status can suppress false positives.
  const result = await pool.query<{
    imo: string;
    mmsi: string;
    positions: Position[];
    latestNavStatus: number | null;
    latestTime: string;
  }>(`
    SELECT v.imo, v.mmsi,
           array_agg(json_build_object(
             'lat', p.latitude,
             'lon', p.longitude,
             'time', p.time
           ) ORDER BY p.time) as positions,
           (array_agg(p.nav_status ORDER BY p.time DESC))[1] as "latestNavStatus",
           max(p.time) as "latestTime"
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

    // Suppress false positives: a vessel with a FRESH declared "at anchor" or
    // "moored" status is legitimately stationary, not loitering.
    const positionAgeMinutes = (Date.now() - new Date(vessel.latestTime).getTime()) / 60000;
    if (shouldSuppressForNavStatus(vessel.latestNavStatus, positionAgeMinutes)) {
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
