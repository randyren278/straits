/**
 * Route Deviation and Speed Anomaly Detection
 *
 * Detects vessels exhibiting suspicious route behavior:
 * - Speed anomaly: Vessel moving <3 knots outside port/anchorage (drifting/disabled)
 * - Deviation: Heading differs >45 deg from expected route for 2+ hours
 *
 * Requirements: ANOM-02, DEVI-01, DEVI-02
 */
import { pool } from '../db';
import { isInAnchorage } from '../geo/anchorages';
import { upsertAnomaly, resolveAnomaly } from '../db/anomalies';
import { calculateBearing } from '../geo/haversine';
import type { DeviationDetails } from '../../types/anomaly';

/**
 * Minimum speed in knots below which a tanker is considered drifting/disabled.
 */
const MIN_NORMAL_SPEED_KNOTS = 3;

/**
 * Heading divergence threshold in degrees beyond which a vessel is flagged as deviating.
 */
const DEVIATION_THRESHOLD_DEGREES = 45;

/**
 * In-memory cache for Nominatim geocoding results.
 * Caches both successful lookups and negative results (null) to avoid redundant API calls.
 */
const geocodeCache = new Map<string, { lat: number; lon: number } | null>();

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
 * 1. Query all vessels with recent position updates
 * 2. Check if speed < 3 knots
 * 3. Exclude vessels in known anchorages
 * 4. Create speed anomaly records
 *
 * @returns Number of speed anomalies detected
 */
export async function detectSpeedAnomaly(): Promise<number> {
  // Get recent positions with speed for all vessels
  const result = await pool.query<{
    imo: string;
    speed: number;
    latitude: number;
    longitude: number;
  }>(`
    SELECT DISTINCT ON (v.imo) v.imo, p.speed, p.latitude, p.longitude
    FROM vessels v
    JOIN vessel_positions p ON p.mmsi = v.mmsi
    WHERE p.time > NOW() - INTERVAL '1 hour'
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
 * Geocode a destination string using Nominatim (OpenStreetMap).
 * Results are cached in-memory to avoid redundant API calls.
 *
 * @param destination - Free-text destination (e.g. "FUJAIRAH", "SINGAPORE")
 * @returns Lat/lon coordinates or null if geocoding fails
 */
export async function geocodeDestination(
  destination: string
): Promise<{ lat: number; lon: number } | null> {
  const normalized = destination.toUpperCase().trim();

  if (!normalized) {
    return null;
  }

  // Return cached result (including cached nulls) if present
  if (geocodeCache.has(normalized)) {
    return geocodeCache.get(normalized) ?? null;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(normalized)}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TankerTracker/1.0' },
    });

    const data = (await response.json()) as Array<{ lat: string; lon: string }>;

    if (Array.isArray(data) && data.length > 0) {
      const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      geocodeCache.set(normalized, coords);
      return coords;
    }

    // No results — cache null to avoid repeated calls
    geocodeCache.set(normalized, null);
    return null;
  } catch {
    // Fetch error — cache null to avoid hammering the API
    geocodeCache.set(normalized, null);
    return null;
  }
}

/**
 * Check whether a vessel's actual heading deviates from the expected bearing.
 *
 * Uses shortest-arc angular difference to handle 0/360 wrap-around correctly.
 *
 * @param actualHeading - Vessel's actual heading in degrees (0-360)
 * @param expectedHeading - Expected bearing toward destination in degrees (0-360)
 * @returns True if the angular difference exceeds DEVIATION_THRESHOLD_DEGREES
 */
export function isDeviating(actualHeading: number, expectedHeading: number): boolean {
  const diff = Math.abs(actualHeading - expectedHeading);
  const shortestArc = diff > 180 ? 360 - diff : diff;
  return shortestArc > DEVIATION_THRESHOLD_DEGREES;
}

/**
 * Detect vessels with sustained route deviations.
 *
 * Process:
 * 1. Query vessels with 2+ positions in the last 2 hours that have a destination set
 * 2. Geocode each vessel's declared destination via Nominatim (cached)
 * 3. Compute expected bearing from each recorded position toward destination
 * 4. If ALL positions in the window show heading >45° off expected bearing (sustained),
 *    upsert a deviation anomaly with suspected confidence
 * 5. If heading has corrected, auto-resolve the existing deviation anomaly
 *
 * @returns Number of deviation anomalies detected/updated
 */
export async function detectDeviation(): Promise<number> {
  const result = await pool.query<{
    imo: string;
    destination: string;
    positions: Array<{
      heading: number;
      latitude: number;
      longitude: number;
      time: string;
    }>;
  }>(`
    SELECT v.imo, v.destination,
           array_agg(json_build_object(
             'heading', p.heading,
             'latitude', p.latitude,
             'longitude', p.longitude,
             'time', p.time
           ) ORDER BY p.time) as positions
    FROM vessels v
    JOIN vessel_positions p ON p.mmsi = v.mmsi
    WHERE p.time > NOW() - INTERVAL '2 hours'
      AND v.destination IS NOT NULL
      AND v.destination != ''
      AND p.heading IS NOT NULL
    GROUP BY v.imo, v.destination
    HAVING COUNT(*) >= 2
  `);

  let count = 0;

  for (const vessel of result.rows) {
    const destCoords = await geocodeDestination(vessel.destination);

    // Skip vessel if destination cannot be geocoded
    if (!destCoords) {
      continue;
    }

    const positions = vessel.positions;
    const latestPos = positions[positions.length - 1];

    // Check whether ALL positions in the 2-hour window deviate from expected bearing
    let allDeviating = true;

    for (const pos of positions) {
      const expectedBearing = calculateBearing(
        pos.latitude,
        pos.longitude,
        destCoords.lat,
        destCoords.lon
      );

      if (!isDeviating(pos.heading, expectedBearing)) {
        allDeviating = false;
        break;
      }
    }

    if (allDeviating) {
      // Compute final expected bearing from latest position for anomaly details
      const expectedBearing = calculateBearing(
        latestPos.latitude,
        latestPos.longitude,
        destCoords.lat,
        destCoords.lon
      );

      const diff = Math.abs(latestPos.heading - expectedBearing);
      const angularDiff = diff > 180 ? 360 - diff : diff;

      const details: DeviationDetails = {
        expectedHeading: Math.round(expectedBearing),
        actualHeading: Math.round(latestPos.heading),
        deviationDegrees: Math.round(angularDiff),
        destination: vessel.destination,
      };

      await upsertAnomaly({
        imo: vessel.imo,
        anomalyType: 'deviation',
        confidence: 'suspected',
        detectedAt: new Date(),
        details,
      });

      count++;
    } else {
      // Heading has corrected — auto-resolve any existing deviation anomaly
      await resolveAnomaly(vessel.imo, 'deviation');
    }
  }

  return count;
}
