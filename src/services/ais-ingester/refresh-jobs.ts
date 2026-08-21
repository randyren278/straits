/**
 * Refresh Cron Jobs
 *
 * Scheduled background jobs that populate prices, news, and sanctions tables.
 * Runs within the AIS ingester service (not Next.js).
 *
 * The in-process `started` flag prevents duplicate cron registration after a
 * WebSocket reconnect. PostgreSQL advisory locks in runExclusiveJob provide the
 * cross-process guarantee: multiple worker replicas may register the same
 * schedules, but only one executes a given job at a time.
 */
import cron from 'node-cron';
import { fetchOilPrices } from '../../lib/prices/fetcher';
import { insertPrice } from '../../lib/db/prices';
import { fetchNews } from '../../lib/news/fetcher';
import { insertNewsItem } from '../../lib/db/news';
import { fetchSanctionsList } from '../../lib/external/opensanctions';
import { batchUpsertSanctions, migrateSanctionsSchema } from '../../lib/db/sanctions';
import { runExclusiveJob } from '../../lib/db/pipeline-runs';
import { validateSanctionsSnapshot } from '../../lib/sanctions/snapshot-guard';

let started = false;

export function _resetStartedForTesting(): void {
  started = false;
}

async function refreshPrices(source: 'startup' | 'cron'): Promise<void> {
  await runExclusiveJob('refresh:prices', async () => {
    const prices = await fetchOilPrices();
    for (const price of prices) await insertPrice(price);
    console.log(`[${source.toUpperCase()}] Prices refreshed: ${prices.length} symbols`);
  }, { source });
}

async function refreshNews(source: 'startup' | 'cron'): Promise<void> {
  await runExclusiveJob('refresh:news', async () => {
    const headlines = await fetchNews();
    for (const item of headlines) await insertNewsItem(item);
    console.log(`[${source.toUpperCase()}] News refreshed: ${headlines.length} headlines`);
  }, { source });
}

async function refreshSanctions(source: 'startup' | 'cron'): Promise<void> {
  await runExclusiveJob('refresh:sanctions', async () => {
    await migrateSanctionsSchema();
    const entries = await fetchSanctionsList();
    const validation = await validateSanctionsSnapshot(entries);
    const result = await batchUpsertSanctions(entries);
    console.log(
      `[${source.toUpperCase()}] Sanctions refreshed: ${result.upserted} upserted, ` +
      `${result.deleted} stale removed; coverage=${validation.retainRatio.toFixed(3)}`
    );
  }, { source });
}

function logRefreshFailure(job: string, error: unknown): void {
  console.error(`[${job}] refresh error:`, error);
}

/**
 * Register refresh jobs once per process. Cross-replica execution is serialized
 * by Postgres advisory locks, which makes horizontal worker scaling safe.
 */
export function startRefreshJobs(): void {
  if (started) {
    console.log('Refresh cron jobs already running — skipping duplicate registration');
    return;
  }
  started = true;

  console.log('Starting background refresh jobs...');

  // Eager population. Failures are persisted by runExclusiveJob and logged here
  // without terminating the long-lived AIS WebSocket process.
  void refreshPrices('startup').catch((error) => logRefreshFailure('STARTUP prices', error));
  void refreshNews('startup').catch((error) => logRefreshFailure('STARTUP news', error));
  void refreshSanctions('startup').catch((error) => logRefreshFailure('STARTUP sanctions', error));

  // Prices: every 6 hours.
  cron.schedule('0 */6 * * *', async () => {
    await refreshPrices('cron').catch((error) => logRefreshFailure('CRON prices', error));
  });

  // News: every 30 minutes.
  cron.schedule('*/30 * * * *', async () => {
    await refreshNews('cron').catch((error) => logRefreshFailure('CRON news', error));
  });

  // Sanctions: daily at 02:00. Snapshot validation happens before destructive
  // reconciliation, so a partial upstream download cannot wipe good records.
  cron.schedule('0 2 * * *', async () => {
    await refreshSanctions('cron').catch((error) => logRefreshFailure('CRON sanctions', error));
  });

  console.log('Refresh cron jobs scheduled: prices every 6h, news every 30m, sanctions daily');
}
