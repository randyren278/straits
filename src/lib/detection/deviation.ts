/**
 * Route Deviation and Speed Anomaly Detection
 *
 * Detects vessels exhibiting suspicious route behavior:
 * - Speed anomaly: Tanker moving <3 knots outside port/anchorage (drifting/disabled)
 * - Deviation: Heading differs >45 deg from expected route (stub for v1)
 *
 * Requirements: ANOM-02
 */
import { pool } from '../db';
import { isInAnchorage } from '../geo/anchorages';
import { upsertAnomaly } from '../db/anomalies';

/**
 * Minimum speed in knots below which a tanker is considered drifting/disabled.
 */
const MIN_NORMAL_SPEED_KNOTS = 3;

/**
 * Check if a tanker's speed indicates an anomaly.
 * Slow speed outside anchorage suggests drifting or disabled vessel.
 *
 * @param speedKnots - Current speed in knots
 * @param lat - Current latitude
 * @param lon - Current longitude
 * @returns True if speed is anomalously slow outside anchorage
 */
export function isSpeedAnomaly(speedKnots: number, lat: number, lon: number): boolean {
  // Not an anomaly if in anchorage (slow speed is normal there)
  if (isInAnchorage(lat, lon)) {
    return false;
  }

  // Flag if moving slower than threshold outside anchorage
  return speedKnots < MIN_NORMAL_SPEED_KNOTS;
}

/**
 * Detect tankers with anomalously slow speed outside anchorages.
 *
 * Process:
 * 1. Query tankers with recent position updates
 * 2. Check if speed < 3 knots
 * 3. Exclude vessels in known anchorages
 * 4. Create speed anomaly records
 *
 * @returns Number of speed anomalies detected
 */
export async function detectSpeedAnomaly(): Promise<number> {
  // Get recent positions with speed for tankers
  const result = await pool.query<{
    imo: string;
    speed: number;
    latitude: number;
    longitude: number;
  }>(`
    SELECT DISTINCT ON (v.imo) v.imo, p.speed, p.latitude, p.longitude
    FROM vessels v
    JOIN vessel_positions p ON p.mmsi = v.mmsi
    WHERE v.ship_type BETWEEN 80 AND 89
      AND p.time > NOW() - INTERVAL '1 hour'
      AND p.speed IS NOT NULL
    ORDER BY v.imo, p.time DESC
  `);

  let count = 0;

  for (const vessel of result.rows) {
    // Check if this is a speed anomaly
    if (!isSpeedAnomaly(vessel.speed, vessel.latitude, vessel.longitude)) {
      continue;
    }

    await upsertAnomaly({
      imo: vessel.imo,
      anomalyType: 'speed',
      confidence: 'suspected',
      detectedAt: new Date(),
      details: {
        speedKnots: vessel.speed,
        lastPosition: { lat: vessel.latitude, lon: vessel.longitude },
      },
    });

    count++;
  }

  return count;
}

/**
 * Detect route deviations.
 *
 * STUB FOR V1: Full implementation requires destination geocoding which is
 * complex (destination field is free-text like "FUJAIRAH" not coordinates).
 *
 * Future implementation would:
 * 1. Parse destination field to get target coordinates
 * 2. Calculate expected bearing from current position
 * 3. Compare to actual vessel heading
 * 4. Flag if difference > 45 degrees for > 2 hours
 *
 * @returns Number of deviation anomalies detected (always 0 in v1)
 */
export async function detectDeviation(): Promise<number> {
  // Stub - requires destination geocoding infrastructure
  // TODO: Implement in v2 with port database for destination lookup
  return 0;
}
