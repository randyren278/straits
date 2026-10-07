/**
 * Repeat Going Dark Detection
 *
 * Detects vessels that have gone dark multiple times within a 30-day window.
 * Repeat evasion pattern indicates likely intentional AIS transponder disabling
 * rather than technical issues.
 *
 * Requirements: PATT-01
 */
import { pool } from '../db';

/**
 * Minimum number of going-dark events in the window to flag as repeat offender
 */
const MIN_EVENT_COUNT = 3;

/**
 * Lookback window in days for counting going-dark events
 */
const WINDOW_DAYS = 30;

/**
 * Detect vessels exhibiting repeat going-dark patterns.
 *
 * Process:
 * 1. Count going_dark events (active + resolved) per IMO over the last 30 days
 * 2. Upsert a repeat_going_dark anomaly for each IMO with 3+, recording the
 *    count and the events (newest first) as details
 * 3. Auto-resolve repeat_going_dark anomalies for vessels that have dropped below threshold
 *
 * Steps 1-2 run as one statement inside Postgres. The client-side version
 * downloaded the whole event history every harvest (~0.5 MB of Supabase
 * egress) only to write it straight back; the stored details are identical
 * (details: RepeatGoingDarkDetails, see repeat-going-dark.test.ts).
 *
 * @returns Number of repeat_going_dark anomalies upserted
 */
export async function detectRepeatGoingDark(): Promise<number> {
  const result = await pool.query(`
    INSERT INTO vessel_anomalies (imo, anomaly_type, confidence, detected_at, details)
    SELECT imo, 'repeat_going_dark', 'confirmed', NOW(),
           jsonb_build_object(
             'goingDarkCount', COUNT(*),
             'windowDays', ${WINDOW_DAYS},
             'recentEvents', jsonb_agg(
               jsonb_build_object('detectedAt', detected_at, 'resolvedAt', resolved_at)
               ORDER BY detected_at DESC))
    FROM vessel_anomalies
    WHERE anomaly_type = 'going_dark'
      AND detected_at > NOW() - INTERVAL '${WINDOW_DAYS} days'
    GROUP BY imo
    HAVING COUNT(*) >= ${MIN_EVENT_COUNT}
    ON CONFLICT (imo, anomaly_type) WHERE resolved_at IS NULL
    DO UPDATE SET
      confidence = EXCLUDED.confidence,
      detected_at = EXCLUDED.detected_at,
      details = EXCLUDED.details
  `);
  const count = result.rowCount ?? 0;

  // Auto-resolve: clear repeat_going_dark anomalies for vessels that have fallen below threshold
  await pool.query(`
    UPDATE vessel_anomalies SET resolved_at = NOW()
    WHERE anomaly_type = 'repeat_going_dark' AND resolved_at IS NULL
      AND imo NOT IN (
        SELECT imo FROM vessel_anomalies
        WHERE anomaly_type = 'going_dark'
          AND detected_at > NOW() - INTERVAL '${WINDOW_DAYS} days'
        GROUP BY imo
        HAVING COUNT(*) >= ${MIN_EVENT_COUNT}
      )
  `);

  return count;
}
