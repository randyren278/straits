/**
 * Detection Cron Jobs
 *
 * Scheduled jobs that run anomaly detection algorithms at regular intervals.
 * Runs within the AIS ingester service (not the Next.js app).
 *
 * Schedule:
 * - Going dark detection: every 15 minutes
 * - Route anomalies (loitering, speed): every 30 minutes
 *
 * Requirements: ANOM-01, ANOM-02
 */
import cron from 'node-cron';
import { detectGoingDark } from '../../lib/detection/going-dark';
import { detectLoitering } from '../../lib/detection/loitering';
import { detectSpeedAnomaly } from '../../lib/detection/deviation';
import { generateAlertsForNewAnomalies } from '../../lib/db/alerts';

/**
 * Start all detection cron jobs.
 * Called after WebSocket connection to AISStream is established.
 */
export function startDetectionJobs(): void {
  console.log('Starting anomaly detection cron jobs...');

  // Going dark detection every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('[CRON] Running going dark detection...');
    try {
      const count = await detectGoingDark();
      console.log(`[CRON] Going dark: ${count} anomalies detected/updated`);
      await generateAlertsForNewAnomalies('going_dark');
    } catch (err) {
      console.error('[CRON] Going dark detection error:', err);
    }
  });

  // Route anomaly detection every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('[CRON] Running route anomaly detection...');
    try {
      const loiteringCount = await detectLoitering();
      const speedCount = await detectSpeedAnomaly();
      console.log(`[CRON] Route anomalies: ${loiteringCount} loitering, ${speedCount} speed`);
      await generateAlertsForNewAnomalies('loitering');
      await generateAlertsForNewAnomalies('speed');
    } catch (err) {
      console.error('[CRON] Route anomaly detection error:', err);
    }
  });

  console.log('Detection cron jobs scheduled:');
  console.log('  - going_dark: every 15 minutes (*/15 * * * *)');
  console.log('  - loitering/speed: every 30 minutes (*/30 * * * *)');
}
