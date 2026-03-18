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
import { upsertAnomaly, resolveAnomaly } from '../db/anomalies';
import type { RepeatGoingDarkDetails } from '../../types/anomaly';

/**
 * Minimum number of going-dark events in the window to flag as repeat offender
 */
const MIN_EVENT_COUNT = 3;

/**
 * Lookback window in days for counting going-dark events
 */
const WINDOW_DAYS = 30;

/**
 * Row returned from the going-dark frequency query
 */
interface RepeatGoingDarkRow {
  imo: string;
  dark_count: string;
  recent_events: Array<{ detectedAt: string; resolvedAt: string | null }>;
}

/**
 * Detect vessels exhibiting repeat going-dark patterns.
 *
 * Process:
 * 1. Query vessel_anomalies for IMOs with 3+ going_dark events in last 30 days
 *    (counts both active and resolved events)
 * 2. Upsert repeat_going_dark anomaly for each qualifying vessel
 * 3. Auto-resolve repeat_going_dark anomalies for vessels that have dropped below threshold
 *
 * @returns Number of repeat_going_dark anomalies upserted
 */
export async function detectRepeatGoingDark(): Promise<number> {
  // Query going_dark events per vessel in the last 30 days (active + resolved)
  const result = await pool.query<RepeatGoingDarkRow>(`
    SELECT imo, COUNT(*) as dark_count,
           json_agg(json_build_object(
             'detectedAt', detected_at,
             'resolvedAt', resolved_at
           ) ORDER BY detected_at DESC) as recent_events
    FROM vessel_anomalies
    WHERE anomaly_type = 'going_dark'
      AND detected_at > NOW() - INTERVAL '${WINDOW_DAYS} days'
    GROUP BY imo
    HAVING COUNT(*) >= ${MIN_EVENT_COUNT}
  `);

  let count = 0;

  for (const row of result.rows) {
    const details: RepeatGoingDarkDetails = {
      goingDarkCount: parseInt(row.dark_count, 10),
      windowDays: WINDOW_DAYS,
      recentEvents: row.recent_events,
    };

    await upsertAnomaly({
      imo: row.imo,
      anomalyType: 'repeat_going_dark',
      confidence: 'confirmed',
      detectedAt: new Date(),
      details,
    });

    count++;
  }

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
