/**
 * Detection Cron Jobs
 *
 * Scheduled anomaly detection runs inside the standalone AIS worker. The local
 * `started` flag prevents duplicate cron registration after reconnects; database
 * advisory locks prevent duplicate execution across horizontally scaled workers.
 */
import cron from 'node-cron';
import { detectGoingDark } from '../../lib/detection/going-dark';
import { detectLoitering } from '../../lib/detection/loitering';
import { detectSpeedAnomaly, detectDeviation } from '../../lib/detection/deviation';
import { detectRepeatGoingDark } from '../../lib/detection/repeat-going-dark';
import { detectStsTransfers } from '../../lib/detection/sts-transfer';
import { detectSpoofedPositions } from '../../lib/detection/teleport';
import { computeRiskScores } from '../../lib/detection/risk-score';
import { generateAlertsForNewAnomalies } from '../../lib/db/alerts';
import { runExclusiveJob } from '../../lib/db/pipeline-runs';

let started = false;

export function _resetStartedForTesting(): void {
  started = false;
}

async function runGoingDarkDetection(): Promise<void> {
  await runExclusiveJob('detect:going-dark', async () => {
    const count = await detectGoingDark();
    console.log(`[CRON] Going dark: ${count} anomalies detected/updated`);
    await generateAlertsForNewAnomalies('going_dark');
  }, { cadence: '15m' });
}

async function runRouteDetections(): Promise<void> {
  await runExclusiveJob('detect:route-anomalies', async () => {
    const t0 = Date.now();
    const [loiteringResult, speedResult, deviationResult, repeatDarkResult, stsResult, spoofResult] =
      await Promise.allSettled([
        detectLoitering(),
        detectSpeedAnomaly(),
        detectDeviation(),
        detectRepeatGoingDark(),
        detectStsTransfers(),
        detectSpoofedPositions(),
      ]);

    const results = [
      ['loitering', loiteringResult],
      ['speed', speedResult],
      ['deviation', deviationResult],
      ['repeat_dark', repeatDarkResult],
      ['sts', stsResult],
      ['spoofed_position', spoofResult],
    ] as const;

    const failures = results.filter(([, result]) => result.status === 'rejected');
    for (const [name, result] of failures) {
      if (result.status === 'rejected') console.error(`[CRON] ${name} detection failed:`, result.reason);
    }

    // A partial detector failure should not silently become a successful pipeline
    // run. We still let independent detectors finish, then fail the run before
    // risk-score materialization so operators can see/retry the degraded cycle.
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map(([, result]) => result.status === 'rejected' ? result.reason : undefined),
        `${failures.length} anomaly detector(s) failed`
      );
    }

    const counts = results.map(([, result]) => result.status === 'fulfilled' ? result.value : 0);
    const [loiteringCount, speedCount, deviationCount, repeatDarkCount, stsCount, spoofCount] = counts;

    // Risk scores are a materialized derivative of anomaly data, so compute only
    // after all detector writes have succeeded.
    const riskCount = await computeRiskScores();

    console.log(
      `[CRON] Route anomalies: ${loiteringCount} loitering, ${speedCount} speed, ` +
      `${deviationCount} deviation, ${repeatDarkCount} repeat_dark, ${stsCount} sts, ` +
      `${spoofCount} spoofed_position, ${riskCount} risk_scores (${Date.now() - t0}ms)`
    );

    const alertResults = await Promise.allSettled([
      generateAlertsForNewAnomalies('loitering'),
      generateAlertsForNewAnomalies('speed'),
      generateAlertsForNewAnomalies('deviation'),
      generateAlertsForNewAnomalies('repeat_going_dark'),
      generateAlertsForNewAnomalies('sts_transfer'),
      generateAlertsForNewAnomalies('spoofed_position'),
    ]);

    const alertFailures = alertResults.filter((result) => result.status === 'rejected');
    if (alertFailures.length > 0) {
      throw new AggregateError(
        alertFailures.map((result) => result.status === 'rejected' ? result.reason : undefined),
        `${alertFailures.length} alert generation task(s) failed`
      );
    }
  }, { cadence: '30m' });
}

function logDetectionFailure(job: string, error: unknown): void {
  console.error(`[CRON] ${job} error:`, error);
}

export function startDetectionJobs(): void {
  if (started) {
    console.log('Detection cron jobs already running — skipping duplicate registration');
    return;
  }
  started = true;

  console.log('Starting anomaly detection cron jobs...');

  cron.schedule('*/15 * * * *', async () => {
    await runGoingDarkDetection().catch((error) => logDetectionFailure('going dark detection', error));
  });

  cron.schedule('*/30 * * * *', async () => {
    await runRouteDetections().catch((error) => logDetectionFailure('route anomaly detection', error));
  });

  console.log('Detection cron jobs scheduled:');
  console.log('  - going_dark: every 15 minutes (*/15 * * * *)');
  console.log('  - loitering/speed/deviation/repeat_dark/sts/spoof: every 30 minutes (*/30 * * * *)');
}
