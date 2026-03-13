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
import { upsertSanction } from '../../lib/db/sanctions';

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
 */
async function eagerFetchSanctions(): Promise<void> {
  try {
    const entries = await fetchSanctionsList();
    for (const entry of entries) {
      await upsertSanction(entry);
    }
    console.log(`[STARTUP] Sanctions fetched: ${entries.length} entries`);
  } catch (err) {
    console.error('[STARTUP] Sanctions fetch error:', err);
  }
}

/**
 * Start all background refresh cron jobs.
 * Called after WebSocket connection to AISStream is established.
 *
 * Also performs an eager fetch of all data sources immediately on startup
 * to populate the DB before the first cron fires.
 */
export function startRefreshJobs(): void {
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
      for (const entry of entries) {
        await upsertSanction(entry);
      }
      console.log(`[CRON] Sanctions refreshed: ${entries.length} entries`);
    } catch (err) {
      console.error('[CRON] Sanctions refresh error:', err);
    }
  });

  console.log('Refresh cron jobs scheduled: prices every 6h, news every 30m, sanctions daily');
}
