/**
 * Oil Price Fetcher (INTL-02)
 *
 * Orchestrates oil price fetching with FRED API as primary source
 * and Alpha Vantage as optional fallback. Includes 15-minute caching to reduce API calls.
 */

import { fetchAlphaVantagePrices, type OilPriceData } from '../external/alphavantage';
import { fetchFREDPrices } from '../external/fred';
import { getLatestPrices } from '../db/prices';

export type { OilPriceData };
export type { OilPricePoint } from '../external/alphavantage';

/**
 * Fetch current oil prices for WTI and Brent crude.
 * Tries FRED first, falls back to Alpha Vantage on failure.
 * Returns empty array if both APIs fail.
 *
 * @returns Array of oil prices (WTI and BRENT) with history for sparklines
 */
export async function fetchOilPrices(): Promise<OilPriceData[]> {
  try {
    return await fetchFREDPrices();
  } catch (error) {
    console.warn('FRED failed, falling back to Alpha Vantage:', error);
    try {
      return await fetchAlphaVantagePrices();
    } catch (avError) {
      console.error('Alpha Vantage fallback also failed:', avError);
      console.warn('Both APIs failed, using last known DB prices');
      const dbRows = await getLatestPrices();
      if (dbRows.length === 0) return [];
      return dbRows.map(row => ({
        symbol: row.symbol as 'WTI' | 'BRENT',
        current: row.price,
        change: row.change,
        changePercent: row.changePercent,
        history: row.history.map(h => ({ date: new Date(), price: h.value })),
      }));
    }
  }
}
