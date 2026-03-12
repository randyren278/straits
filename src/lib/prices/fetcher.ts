/**
 * Oil Price Fetcher (INTL-02)
 *
 * Orchestrates oil price fetching with Alpha Vantage as primary source
 * and FRED API as fallback. Includes 15-minute caching to reduce API calls.
 */

import { fetchAlphaVantagePrices, type OilPriceData } from '../external/alphavantage';
import { fetchFREDPrices } from '../external/fred';

export type { OilPriceData };
export type { OilPricePoint } from '../external/alphavantage';

/**
 * Fetch current oil prices for WTI and Brent crude.
 * Tries Alpha Vantage first, falls back to FRED on failure.
 * Returns empty array if both APIs fail.
 *
 * @returns Array of oil prices (WTI and BRENT) with history for sparklines
 */
export async function fetchOilPrices(): Promise<OilPriceData[]> {
  try {
    return await fetchAlphaVantagePrices();
  } catch (error) {
    console.warn('Alpha Vantage failed, falling back to FRED:', error);
    try {
      return await fetchFREDPrices();
    } catch (fredError) {
      console.error('FRED fallback also failed:', fredError);
      return [];
    }
  }
}
