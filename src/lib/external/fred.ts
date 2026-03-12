/**
 * FRED (Federal Reserve Economic Data) API Fallback Fetcher
 * Fetches WTI and Brent crude oil prices when Alpha Vantage is unavailable.
 * Uses DCOILWTICO (WTI) and DCOILBRENTEU (Brent) series.
 */

import type { OilPriceData, OilPricePoint } from './alphavantage';

export type { OilPriceData, OilPricePoint };

/**
 * Fetch WTI and Brent crude oil prices from FRED API.
 * Returns prices with current value, daily change, and 30-day history.
 *
 * FRED series IDs:
 * - DCOILWTICO: Crude Oil Prices: West Texas Intermediate
 * - DCOILBRENTEU: Crude Oil Prices: Brent - Europe
 *
 * @throws Error on API failure
 */
export async function fetchFREDPrices(): Promise<OilPriceData[]> {
  const apiKey = process.env.FRED_API_KEY;

  const series = [
    { symbol: 'WTI' as const, id: 'DCOILWTICO' },
    { symbol: 'BRENT' as const, id: 'DCOILBRENTEU' },
  ];

  const results = await Promise.all(
    series.map(async ({ symbol, id }) => {
      const url = apiKey
        ? `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${apiKey}&file_type=json&limit=30&sort_order=desc`
        : `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&file_type=json&limit=30&sort_order=desc`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`FRED ${symbol}: ${res.status}`);

      const data = await res.json();
      return parseFREDResponse(data, symbol);
    })
  );

  return results;
}

/**
 * Parse FRED API response into structured oil price data.
 * Filters out missing data points (marked as '.' by FRED).
 */
function parseFREDResponse(data: unknown, symbol: 'WTI' | 'BRENT'): OilPriceData {
  const dataObj = data as { observations?: Array<{ date: string; value: string }> };
  const observations = dataObj.observations || [];

  const history: OilPricePoint[] = observations
    .filter((o) => o.value !== '.')
    .map((o) => ({
      date: new Date(o.date),
      price: parseFloat(o.value),
    }));

  const current = history[0]?.price || 0;
  const previous = history[1]?.price || current;
  const change = current - previous;
  const changePercent = previous ? (change / previous) * 100 : 0;

  return { symbol, current, change, changePercent, history };
}
