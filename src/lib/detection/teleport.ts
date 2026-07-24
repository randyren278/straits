/**
 * Teleport (Spoofed Position) Detection
 *
 * Detects AIS position spoofing by computing the implied speed between
 * consecutive position reports. A ship cannot move faster than ~50 knots;
 * an implied speed above that threshold indicates a "teleport" — the vessel
 * appears to jump across the map, a hallmark of GPS/AIS position spoofing.
 *
 * Requirements: ANOM-02
 */
import { pool } from '../db';
import { haversineDistance } from '../geo/haversine';
import { upsertAnomaly } from '../db/anomalies';
import type { SpoofedPositionDetails } from '../../types/anomaly';

/**
 * Implied-speed threshold in knots above which movement is physically
 * impossible for a ship (fastest vessels top out well under 50 kn).
 */
export const TELEPORT_SPEED_KNOTS = 50;

/** 1 kilometre expressed in nautical miles (for km → knots conversion). */
const KM_TO_NM = 1 / 1.852;

/**
 * A timestamped position used for kinematic teleport analysis.
 */
export interface TimedPosition {
  lat: number;
  lon: number;
  time: Date;
}

/**
 * Compute the implied speed (knots) between two consecutive positions.
 * Returns 0 when the time delta is non-positive (avoids divide-by-zero and
 * out-of-order reports producing spurious speeds).
 *
 * @param a - Earlier position
 * @param b - Later position
 * @returns Implied speed in knots
 */
export function impliedSpeedKnots(a: TimedPosition, b: TimedPosition): number {
  const elapsedHours = (b.time.getTime() - a.time.getTime()) / 3_600_000;
  if (elapsedHours <= 0) return 0;
  const distanceKm = haversineDistance(a.lat, a.lon, b.lat, b.lon);
  return (distanceKm * KM_TO_NM) / elapsedHours;
}

/**
 * Detect a teleport (spoofed position) across a series of consecutive
 * positions for a single vessel. Scans adjacent pairs and returns details of
 * the worst offending jump whose implied speed exceeds TELEPORT_SPEED_KNOTS.
 *
 * @param positions - Positions for one vessel, ordered oldest → newest
 * @returns Spoofed-position details if a teleport is found, else null
 */
export function detectTeleport(positions: TimedPosition[]): SpoofedPositionDetails | null {
  if (positions.length < 2) return null;

  let worst: SpoofedPositionDetails | null = null;

  for (let i = 1; i < positions.length; i++) {
    const a = positions[i - 1];
    const b = positions[i];
    const speed = impliedSpeedKnots(a, b);

    if (speed > TELEPORT_SPEED_KNOTS && (!worst || speed > worst.impliedSpeedKnots)) {
      worst = {
        from: { lat: a.lat, lon: a.lon },
        to: { lat: b.lat, lon: b.lon },
        distanceKm: haversineDistance(a.lat, a.lon, b.lat, b.lon),
        elapsedMinutes: (b.time.getTime() - a.time.getTime()) / 60_000,
        impliedSpeedKnots: speed,
      };
    }
  }

  return worst;
}

/**
 * Detect spoofed positions across all vessels with recent position history.
 *
 * Process:
 * 1. Query the last 2 hours of positions per vessel (ordered by time)
 * 2. Compute implied speed between consecutive reports
 * 3. Flag a spoofed_position anomaly when a jump exceeds ~50 knots
 *
 * @returns Number of spoofed-position anomalies detected
 */
export async function detectSpoofedPositions(): Promise<number> {
  const result = await pool.query<{
    imo: string;
    positions: Array<{ lat: number; lon: number; time: string }>;
  }>(`
    SELECT v.imo,
           array_agg(json_build_object(
             'lat', p.latitude,
             'lon', p.longitude,
             'time', p.time
           ) ORDER BY p.time) as positions
    FROM vessels v
    JOIN vessel_positions p ON p.mmsi = v.mmsi
    WHERE p.time > NOW() - INTERVAL '2 hours'
    GROUP BY v.imo
    HAVING COUNT(*) >= 2
  `);

  let count = 0;

  for (const vessel of result.rows) {
    const positions: TimedPosition[] = vessel.positions.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      time: new Date(p.time),
    }));

    const teleport = detectTeleport(positions);
    if (!teleport) continue;

    await upsertAnomaly({
      imo: vessel.imo,
      anomalyType: 'spoofed_position',
      confidence: 'suspected',
      detectedAt: new Date(),
      details: teleport,
    });

    count++;
  }

  return count;
}
