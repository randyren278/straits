/**
 * Refresh Cron Jobs
 *
 * Scheduled background jobs that populate prices, news, and sanctions tables
 * on a regular interval. Runs within the AIS ingester service (not Next.js).
 *
 * Schedules:
 * - Prices: every 6 hours (8 req/day — within Alpha Vantage 25/day free tier)
 * - News: every 30 minutes (48 req/day — within NewsAPI 100/day limit)
 * - Sanctions: daily at 2 AM (OpenSanctions CSV, no rate limit concern)
 *
 * Guard: startRefreshJobs() is idempotent — subsequent calls are no-ops.
 * This prevents duplicate cron registrations when the WebSocket reconnects.
 *
 * CRITICAL: Uses relative imports only — no @/ alias. The ingester runs outside
 * Next.js and @/ won't resolve.
 *
 * Requirements: WIRE-02, WIRE-03, WIRE-04
 */
import cron from 'node-cron';
import { fetchOilPrices } from '../../lib/prices/fetcher';
import { insertPrice } from '../../lib/db/prices';
import { fetchNews } from '../../lib/news/fetcher';
import { insertNewsItem } from '../../lib/db/news';
import { fetchSanctionsList } from '../../lib/external/opensanctions';
import { batchUpsertSanctions, migrateSanctionsSchema } from '../../lib/db/sanctions';

/** Guard flag — ensures cron jobs are only registered once per process. */
let started = false;

/**
 * Reset the started guard. ONLY for unit tests — allows startRefreshJobs()
 * to be called multiple times in isolated test cases.
 * @internal
 */
export function _resetStartedForTesting(): void {
  started = false;
}

/**
 * Eager startup fetch for oil prices.
 * Prevents the status bar from showing "offline" on first start.
 */
async function eagerFetchPrices(): Promise<void> {
  try {
    const prices = await fetchOilPrices();
    for (const price of prices) {
      await insertPrice(price);
    }
    console.log(`[STARTUP] Prices fetched: ${prices.length} symbols`);
  } catch (err) {
    console.error('[STARTUP] Prices fetch error:', err);
  }
}

/**
 * Eager startup fetch for news headlines.
 */
async function eagerFetchNews(): Promise<void> {
  try {
    const headlines = await fetchNews();
    for (const item of headlines) {
      await insertNewsItem(item);
    }
    console.log(`[STARTUP] News fetched: ${headlines.length} headlines`);
  } catch (err) {
    console.error('[STARTUP] News fetch error:', err);
  }
}

/**
 * Eager startup fetch for sanctions list.
 * Also runs schema migration to add enriched columns (idempotent).
 */
async function eagerFetchSanctions(): Promise<void> {
  try {
    await migrateSanctionsSchema();
    const entries = await fetchSanctionsList();
    const result = await batchUpsertSanctions(entries);
    console.log(
      `[STARTUP] Sanctions fetched: ${result.upserted} entries upserted, ${result.deleted} stale removed`
    );
  } catch (err) {
    console.error('[STARTUP] Sanctions fetch error:', err);
  }
}

/**
 * Start all background refresh cron jobs.
 * Called after WebSocket connection to AISStream is established.
 *
 * Idempotent: subsequent calls (e.g. after WebSocket reconnect) are no-ops
 * to prevent duplicate cron schedules from stacking up and blocking the
 * event loop.
 *
 * Also performs an eager fetch of all data sources immediately on startup
 * to populate the DB before the first cron fires.
 */
export function startRefreshJobs(): void {
  if (started) {
    console.log('Refresh cron jobs already running — skipping duplicate registration');
    return;
  }
  started = true;

  console.log('Starting background refresh jobs...');

  // ── Eager startup fetch ──────────────────────────────────────────────────
  // Run all three fetchers immediately so the UI isn't empty on first load.
  eagerFetchPrices();
  eagerFetchNews();
  eagerFetchSanctions();

  // ── Prices cron: every 6 hours ───────────────────────────────────────────
  // Alpha Vantage free tier: 25 req/day. 6h interval = 8 req/day.
  cron.schedule('0 */6 * * *', async () => {
    console.log('[CRON] Running prices refresh...');
    try {
      const prices = await fetchOilPrices();
      for (const price of prices) {
        await insertPrice(price);
      }
      console.log(`[CRON] Prices refreshed: ${prices.length} symbols`);
    } catch (err) {
      console.error('[CRON] Prices refresh error:', err);
    }
  });

  // ── News cron: every 30 minutes ──────────────────────────────────────────
  // NewsAPI free tier: 100 req/day. 30m interval = 48 req/day.
  cron.schedule('*/30 * * * *', async () => {
    console.log('[CRON] Running news refresh...');
    try {
      const headlines = await fetchNews();
      for (const item of headlines) {
        await insertNewsItem(item);
      }
      console.log(`[CRON] News refreshed: ${headlines.length} headlines`);
    } catch (err) {
      console.error('[CRON] News refresh error:', err);
    }
  });

  // ── Sanctions cron: daily at 2 AM ────────────────────────────────────────
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Running sanctions refresh...');
    try {
      const entries = await fetchSanctionsList();
      const result = await batchUpsertSanctions(entries);
      console.log(
        `[CRON] Sanctions refreshed: ${result.upserted} entries upserted, ${result.deleted} stale removed`
      );
    } catch (err) {
      console.error('[CRON] Sanctions refresh error:', err);
    }
  });

  console.log('Refresh cron jobs scheduled: prices every 6h, news every 30m, sanctions daily');
}
