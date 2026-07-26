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
  // FRED rejects anything but a 32-char lowercase-alphanumeric key with 400,
  // and rejects keyless observations requests the same way — so a malformed
  // key must not be sent, and "no key" must not mean "no prices". The keyless
  // fredgraph.csv endpoint serves the same series and is the fallback both ways.
  const rawKey = process.env.FRED_API_KEY;
  const apiKey = rawKey && /^[a-z0-9]{32}$/.test(rawKey) ? rawKey : undefined;
  if (rawKey && !apiKey) {
    console.warn('FRED_API_KEY is malformed (FRED requires 32 lowercase alphanumerics) — using the keyless CSV endpoint');
  }

  const series = [
    { symbol: 'WTI' as const, id: 'DCOILWTICO' },
    { symbol: 'BRENT' as const, id: 'DCOILBRENTEU' },
  ];

  const results = await Promise.all(
    series.map(async ({ symbol, id }) => {
      if (apiKey) {
        try {
          const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${apiKey}&file_type=json&limit=30&sort_order=desc`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`FRED ${symbol}: ${res.status}`);
          return parseFREDResponse(await res.json(), symbol);
        } catch {
          console.warn(`FRED ${symbol} keyed request failed — falling back to the keyless CSV`);
        }
      }
      return parseFREDResponse(await fetchFredgraphCsv(id, symbol), symbol);
    })
  );

  return results;
}

/**
 * Keyless fallback: fredgraph.csv serves the full history of a series with no
 * API key. Returns the tail reshaped like the observations API (most recent
 * first) so parseFREDResponse handles both paths identically.
 */
async function fetchFredgraphCsv(
  id: string,
  symbol: string
): Promise<{ observations: Array<{ date: string; value: string }> }> {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`);
  if (!res.ok) throw new Error(`FRED CSV ${symbol}: ${res.status}`);
  const text = await res.text();

  const lines = text.trim().split(/\r?\n/).slice(1); // drop header row
  const observations = lines
    .slice(-60) // enough tail to yield 30 rows after '.' (holiday) filtering
    .map((line) => {
      const [date, value] = line.split(',');
      return { date, value };
    })
    .reverse()
    .slice(0, 30);
  return { observations };
}

/**
 * Parse FRED API response into structured oil price data.
 * Filters out missing data points (marked as '.' by FRED).
 */
function parseFREDResponse(data: unknown, symbol: 'WTI' | 'BRENT'): OilPriceData {
  const dataObj = data as { observations?: Array<{ date: string; value: string }> };
  const observations = dataObj.observations || [];

  // FRED returns observations in descending date order (most recent first).
  const descending: OilPricePoint[] = observations
    .filter((o) => o.value !== '.')
    .map((o) => ({
      date: new Date(o.date),
      price: parseFloat(o.value),
    }));

  const current = descending[0]?.price || 0;
  const previous = descending[1]?.price || current;
  const change = current - previous;
  const changePercent = previous ? (change / previous) * 100 : 0;

  // Sparkline history should be ascending (oldest to newest) to read left-to-right.
  const history: OilPricePoint[] = [...descending].reverse();

  return { symbol, current, change, changePercent, history };
}
