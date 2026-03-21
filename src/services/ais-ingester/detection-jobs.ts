/**
 * Detection Cron Jobs
 *
 * Scheduled jobs that run anomaly detection algorithms at regular intervals.
 * Runs within the AIS ingester service (not the Next.js app).
 *
 * Schedule:
 * - Going dark detection: every 15 minutes
 * - Route anomalies (loitering, speed, deviation, repeat_dark, sts): every 30 minutes
 *
 * Guard: startDetectionJobs() is idempotent — subsequent calls are no-ops.
 * This prevents duplicate cron registrations when the WebSocket reconnects.
 *
 * Requirements: ANOM-01, ANOM-02, DEVI-01, DEVI-02, PATT-01, PATT-03, RISK-02
 */
import cron from 'node-cron';
import { detectGoingDark } from '../../lib/detection/going-dark';
import { detectLoitering } from '../../lib/detection/loitering';
import { detectSpeedAnomaly, detectDeviation } from '../../lib/detection/deviation';
import { detectRepeatGoingDark } from '../../lib/detection/repeat-going-dark';
import { detectStsTransfers } from '../../lib/detection/sts-transfer';
import { computeRiskScores } from '../../lib/detection/risk-score';
import { generateAlertsForNewAnomalies } from '../../lib/db/alerts';

/** Guard flag — ensures cron jobs are only registered once per process. */
let started = false;

/**
 * Reset the started guard. ONLY for unit tests — allows startDetectionJobs()
 * to be called multiple times in isolated test cases.
 * @internal
 */
export function _resetStartedForTesting(): void {
  started = false;
}

/**
 * Start all detection cron jobs.
 * Called after WebSocket connection to AISStream is established.
 *
 * Idempotent: subsequent calls (e.g. after WebSocket reconnect) are no-ops
 * to prevent duplicate cron schedules from stacking up and blocking the
 * event loop.
 */
export function startDetectionJobs(): void {
  if (started) {
    console.log('Detection cron jobs already running — skipping duplicate registration');
    return;
  }
  started = true;

  console.log('Starting anomaly detection cron jobs...');

  // Going dark detection every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('[CRON] Running going dark detection...');
    const t0 = Date.now();
    try {
      const count = await detectGoingDark();
      console.log(`[CRON] Going dark: ${count} anomalies detected/updated (${Date.now() - t0}ms)`);
      await generateAlertsForNewAnomalies('going_dark');
    } catch (err) {
      console.error('[CRON] Going dark detection error:', err);
    }
  });

  // Route anomaly detection every 30 minutes.
  // Run independent detectors concurrently (Promise.allSettled) to avoid
  // serializing 6 heavy SQL queries that would block the event loop.
  cron.schedule('*/30 * * * *', async () => {
    console.log('[CRON] Running route anomaly detection...');
    const t0 = Date.now();
    try {
      // Phase 1: Run all independent detectors in parallel
      const [loiteringResult, speedResult, deviationResult, repeatDarkResult, stsResult] =
        await Promise.allSettled([
          detectLoitering(),
          detectSpeedAnomaly(),
          detectDeviation(),
          detectRepeatGoingDark(),
          detectStsTransfers(),
        ]);

      const loiteringCount = loiteringResult.status === 'fulfilled' ? loiteringResult.value : 0;
      const speedCount = speedResult.status === 'fulfilled' ? speedResult.value : 0;
      const deviationCount = deviationResult.status === 'fulfilled' ? deviationResult.value : 0;
      const repeatDarkCount = repeatDarkResult.status === 'fulfilled' ? repeatDarkResult.value : 0;
      const stsCount = stsResult.status === 'fulfilled' ? stsResult.value : 0;

      // Log any individual failures
      for (const [name, result] of [
        ['loitering', loiteringResult],
        ['speed', speedResult],
        ['deviation', deviationResult],
        ['repeat_dark', repeatDarkResult],
        ['sts', stsResult],
      ] as const) {
        if (result.status === 'rejected') {
          console.error(`[CRON] ${name} detection failed:`, result.reason);
        }
      }

      // Phase 2: Risk scores depend on anomaly data, so run after detectors
      const riskCount = await computeRiskScores();

      console.log(
        `[CRON] Route anomalies: ${loiteringCount} loitering, ${speedCount} speed, ` +
        `${deviationCount} deviation, ${repeatDarkCount} repeat_dark, ${stsCount} sts, ` +
        `${riskCount} risk_scores (${Date.now() - t0}ms)`
      );

      // Phase 3: Generate alerts concurrently
      await Promise.allSettled([
        generateAlertsForNewAnomalies('loitering'),
        generateAlertsForNewAnomalies('speed'),
        generateAlertsForNewAnomalies('deviation'),
        generateAlertsForNewAnomalies('repeat_going_dark'),
        generateAlertsForNewAnomalies('sts_transfer'),
      ]);
    } catch (err) {
      console.error('[CRON] Route anomaly detection error:', err);
    }
  });

  console.log('Detection cron jobs scheduled:');
  console.log('  - going_dark: every 15 minutes (*/15 * * * *)');
  console.log('  - loitering/speed/deviation/repeat_dark/sts: every 30 minutes (*/30 * * * *)');
}
