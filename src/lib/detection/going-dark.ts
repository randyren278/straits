/**
 * Going Dark Detection
 *
 * Detects vessels that have stopped transmitting AIS within coverage zones.
 * Going dark = vessel has no AIS update for >2 hours in a terrestrial coverage zone.
 *
 * Coverage zones are areas with reliable AIS receiver coverage where signal
 * gaps indicate intentional transponder disabling, not satellite gaps.
 *
 * Requirements: ANOM-01
 */
import { pool } from '../db';
import { isInCoverageZone, getCoverageZone } from './coverage-zones';
import { upsertAnomaly } from '../db/anomalies';
import type { Confidence } from '../../types/anomaly';

/**
 * Candidate vessel returned from gap query
 */
export interface GapCandidate {
  imo: string;
  lastSeen: Date;
  lastLat: number;
  lastLon: number;
  gapMinutes: number;
}

/**
 * Minimum gap duration (in minutes) to flag as going dark.
 * 2 hours = 120 minutes
 */
const MIN_GAP_MINUTES = 120;

/**
 * Gap duration (in minutes) to upgrade confidence from suspected to confirmed.
 * 4 hours = 240 minutes
 */
const CONFIRMED_GAP_MINUTES = 240;

/**
 * Determine confidence level based on gap duration.
 *
 * @param gapMinutes - Duration of AIS gap in minutes
 * @returns 'suspected' for 2-4h gaps, 'confirmed' for >4h gaps
 */
export function determineConfidence(gapMinutes: number): Confidence {
  return gapMinutes >= CONFIRMED_GAP_MINUTES ? 'confirmed' : 'suspected';
}

/**
 * Check if a vessel should be flagged as going dark.
 * Only flags vessels in coverage zones with gaps >= 2 hours.
 *
 * @param lat - Last known latitude
 * @param lon - Last known longitude
 * @param gapMinutes - Duration of AIS gap in minutes
 * @returns True if vessel should be flagged
 */
export function shouldFlagAsGoingDark(lat: number, lon: number, gapMinutes: number): boolean {
  // Only flag if in a coverage zone where gaps are suspicious
  if (!isInCoverageZone(lat, lon)) {
    return false;
  }

  // Only flag if gap is long enough
  return gapMinutes >= MIN_GAP_MINUTES;
}

/**
 * Detect vessels that have gone dark (stopped AIS transmission in coverage zones).
 *
 * Process:
 * 1. Query all vessels with no AIS update for >2 hours
 * 2. Filter to those in terrestrial coverage zones
 * 3. Create/update anomaly records with appropriate confidence
 * 4. Resolve anomalies for vessels that have reported back
 *
 * @returns Number of anomalies detected/updated
 */
export async function detectGoingDark(): Promise<number> {
  // Query all vessels with no update in >2 hours
  const result = await pool.query<GapCandidate>(`
    SELECT v.imo, v.last_seen as "lastSeen",
           p.latitude as "lastLat", p.longitude as "lastLon",
           EXTRACT(EPOCH FROM (NOW() - v.last_seen)) / 60 as "gapMinutes"
    FROM vessels v
    LEFT JOIN LATERAL (
      SELECT latitude, longitude FROM vessel_positions
      WHERE mmsi = v.mmsi ORDER BY time DESC LIMIT 1
    ) p ON true
    WHERE v.last_seen < NOW() - INTERVAL '2 hours'
  `);

  let count = 0;

  for (const vessel of result.rows) {
    // Skip if not in a coverage zone (open ocean gaps are normal)
    if (!shouldFlagAsGoingDark(vessel.lastLat, vessel.lastLon, vessel.gapMinutes)) {
      continue;
    }

    const zone = getCoverageZone(vessel.lastLat, vessel.lastLon);
    const confidence = determineConfidence(vessel.gapMinutes);

    await upsertAnomaly({
      imo: vessel.imo,
      anomalyType: 'going_dark',
      confidence,
      detectedAt: new Date(),
      details: {
        lastPosition: { lat: vessel.lastLat, lon: vessel.lastLon },
        gapMinutes: Math.round(vessel.gapMinutes),
        coverageZone: zone?.id || 'unknown',
      },
    });

    count++;
  }

  // Resolve anomalies for vessels that have reported back recently (within 30 min)
  await pool.query(`
    UPDATE vessel_anomalies SET resolved_at = NOW()
    WHERE anomaly_type = 'going_dark' AND resolved_at IS NULL
      AND imo IN (SELECT imo FROM vessels WHERE last_seen > NOW() - INTERVAL '30 minutes')
  `);

  return count;
}
