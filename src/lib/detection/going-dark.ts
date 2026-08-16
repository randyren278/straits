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
import { upsertAnomaliesBatch } from '../db/anomalies';
import type { Confidence, UpsertAnomalyInput } from '../../types/anomaly';

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
 * Upper bound (in days) on how long a vessel keeps being re-considered as a
 * going-dark candidate after it last reported.
 *
 * Without this bound, the candidate query is gated only on staleness
 * (`last_seen < NOW() - 2h`), so during a prolonged AIS feed outage every
 * vessel the ingester has EVER seen ages past 2h and stays a candidate
 * forever — the candidate set only grows, never shrinks. "Going dark" is
 * meant to be an event (a vessel that recently stopped transmitting), not a
 * permanent state, so a vessel silent for weeks is no longer usefully
 * "detected" each run — it has most likely left the fleet or the tracking
 * window entirely. 30 days matches the WINDOW_DAYS horizon already used by
 * repeat-going-dark.ts for the same "is this still relevant" question.
 *
 * BEHAVIORAL CHANGE: previously a vessel dark for months would still be
 * re-flagged/re-confirmed (detected_at refreshed) on every run, forever.
 * After this change, a vessel whose last_seen is older than 30 days drops
 * out of the candidate set: its going_dark anomaly (if any) simply stops
 * being refreshed by this detector until the vessel reports in again. All
 * vessels within the last 30 days behave exactly as before — this only
 * changes long-silent vessels, which is the case flagged for user review.
 */
const MAX_GAP_DAYS = 30;

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
  // Query vessels with no update in >2 hours, bounded below by MAX_GAP_DAYS
  // so a prolonged feed outage can't grow this candidate set without limit
  // (see MAX_GAP_DAYS doc comment above).
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
      AND v.last_seen > NOW() - INTERVAL '${MAX_GAP_DAYS} days'
  `);

  const batch: UpsertAnomalyInput[] = [];

  for (const vessel of result.rows) {
    // Skip if not in a coverage zone (open ocean gaps are normal)
    if (!shouldFlagAsGoingDark(vessel.lastLat, vessel.lastLon, vessel.gapMinutes)) {
      continue;
    }

    const zone = getCoverageZone(vessel.lastLat, vessel.lastLon);
    const confidence = determineConfidence(vessel.gapMinutes);

    batch.push({
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
  }

  await upsertAnomaliesBatch(batch);
  const count = batch.length;

  // Resolve anomalies for vessels that have reported back recently (within 30 min)
  await pool.query(`
    UPDATE vessel_anomalies SET resolved_at = NOW()
    WHERE anomaly_type = 'going_dark' AND resolved_at IS NULL
      AND imo IN (SELECT imo FROM vessels WHERE last_seen > NOW() - INTERVAL '30 minutes')
  `);

  return count;
}
