/**
 * Destination-Flip Sequence Detector (composite_diversion)
 *
 * A mid-voyage destination change is routine on its own. But a destination
 * flip that is shortly *followed* by an evasion anomaly — going dark, a route
 * deviation, or an STS transfer — for the same vessel is a stronger dark-fleet
 * signal. This detector joins vessel_destination_changes to subsequent
 * vessel_anomalies within a bounded window and writes a composite_diversion
 * anomaly for the vessel.
 *
 * Deferred (not done here): toward/away chokepoint aggregation, sanctioned-port
 * lists.
 */
import { pool } from '../db';
import { upsertAnomaliesBatch } from '../db/anomalies';
import type { Confidence, CompositeDiversionDetails, UpsertAnomalyInput } from '../../types/anomaly';

/** Hours after a destination flip within which a following evasion counts. */
export const FLIP_WINDOW_HOURS = 24;

/** Evasion anomaly types that, when following a flip, imply a diversion. */
const EVASION_TYPES = ['going_dark', 'deviation', 'sts_transfer'] as const;

/**
 * Heuristic flag for junk / obfuscated AIS destination fields. Real ports have
 * mixed-case names and specific text; junk fields are blank, generic ("FOR
 * ORDERS"), or all-caps garbage with no lowercase letters.
 *
 * @param destination - Raw AIS destination string (may be null)
 * @returns True when the destination looks like a junk/obfuscated field
 */
export function isJunkDestination(destination: string | null | undefined): boolean {
  if (!destination) return true;
  const trimmed = destination.trim();
  if (trimmed.length === 0) return true;

  const upper = trimmed.toUpperCase();
  const generic = ['FOR ORDERS', 'ORDERS', 'UNKNOWN', 'N/A', 'NA', 'TBN', 'TBA', 'NONE', '---', '...'];
  if (generic.includes(upper)) return true;

  // No letters at all (pure punctuation / digits) → junk.
  if (!/[A-Za-z]/.test(trimmed)) return true;

  return false;
}

/**
 * A destination flip joined to a subsequent evasion anomaly.
 */
export interface FlipEvasionMatch {
  imo: string;
  previousDestination: string;
  newDestination: string;
  changedAt: Date;
  followedBy: (typeof EVASION_TYPES)[number];
  followedAt: Date;
}

/**
 * Detect composite diversions and write a composite_diversion anomaly for each
 * vessel whose recent destination flip was followed by an evasion event.
 *
 * A frequency threshold (>= minEvasions distinct following evasion events)
 * avoids flagging routine one-off reroutes as diversions.
 *
 * @param lookbackHours - How far back to scan for destination flips
 * @param minEvasions - Minimum distinct following evasion events to flag
 * @returns Number of composite_diversion anomalies written
 */
export async function detectCompositeDiversions(
  lookbackHours: number = 72,
  minEvasions: number = 1
): Promise<number> {
  const evasionList = EVASION_TYPES.map((t) => `'${t}'`).join(', ');

  // For each destination flip in the lookback window, find evasion anomalies
  // for the same vessel detected AFTER the flip but within FLIP_WINDOW_HOURS.
  const result = await pool.query<{
    imo: string;
    previous_destination: string;
    new_destination: string;
    changed_at: Date;
    followed_by: FlipEvasionMatch['followedBy'];
    followed_at: Date;
    evasion_count: string;
  }>(`
    SELECT DISTINCT ON (dc.imo)
      dc.imo,
      dc.previous_destination,
      dc.new_destination,
      dc.changed_at,
      a.anomaly_type AS followed_by,
      a.detected_at AS followed_at,
      COUNT(*) OVER (PARTITION BY dc.imo)::text AS evasion_count
    FROM vessel_destination_changes dc
    JOIN vessel_anomalies a
      ON a.imo = dc.imo
     AND a.anomaly_type IN (${evasionList})
     AND a.detected_at > dc.changed_at
     AND a.detected_at <= dc.changed_at + ($1 || ' hours')::interval
    WHERE dc.changed_at > NOW() - ($2 || ' hours')::interval
    ORDER BY dc.imo, a.detected_at ASC
  `, [FLIP_WINDOW_HOURS, lookbackHours]);

  const batch: UpsertAnomalyInput[] = [];

  for (const row of result.rows) {
    if (parseInt(row.evasion_count, 10) < minEvasions) continue;

    const gapHours =
      (new Date(row.followed_at).getTime() - new Date(row.changed_at).getTime()) / 3_600_000;

    const details: CompositeDiversionDetails = {
      previousDestination: row.previous_destination,
      newDestination: row.new_destination,
      changedAt: new Date(row.changed_at).toISOString(),
      followedBy: row.followed_by,
      followedAt: new Date(row.followed_at).toISOString(),
      gapHours,
      junkDestination: isJunkDestination(row.new_destination),
    };

    // A junk destination alongside evasion raises confidence to confirmed.
    const confidence: Confidence = details.junkDestination ? 'confirmed' : 'suspected';

    batch.push({
      imo: row.imo,
      anomalyType: 'composite_diversion',
      confidence,
      detectedAt: new Date(),
      details,
    });
  }

  await upsertAnomaliesBatch(batch);
  return batch.length;
}
