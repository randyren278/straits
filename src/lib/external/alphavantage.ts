/**
 * Alpha Vantage Oil Price Fetcher
 * Fetches WTI and Brent crude oil prices from Alpha Vantage API.
 */

export interface OilPricePoint {
  date: Date;
  price: number;
}

export interface OilPriceData {
  symbol: 'WTI' | 'BRENT';
  current: number;
  change: number;
  changePercent: number;
  history: OilPricePoint[];
}

/**
 * Fetch WTI and Brent crude oil prices from Alpha Vantage.
 * Returns prices with current value, daily change, and 30-day history.
 *
 * @throws Error if API key is not configured
 * @throws Error on rate limit or API failure
 */
export async function fetchAlphaVantagePrices(): Promise<OilPriceData[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error('ALPHA_VANTAGE_API_KEY not configured');

  const endpoints = [
    { symbol: 'WTI' as const, function: 'WTI' },
    { symbol: 'BRENT' as const, function: 'BRENT' },
  ];

  // Fetch sequentially to avoid hitting the 5-req/min free tier rate limit
  const results: OilPriceData[] = [];
  for (const { symbol, function: fn } of endpoints) {
    const url = `https://www.alphavantage.co/query?function=${fn}&interval=daily&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Alpha Vantage ${symbol}: ${res.status}`);

    const data = await res.json();
    // Check for rate limit message (Note, Information, or Error Message)
    if (data.Note || data['Error Message'] || data.Information) {
      throw new Error(`Alpha Vantage rate limit: ${data.Note || data.Information || data['Error Message']}`);
    }

    results.push(parseAlphaVantageResponse(data, symbol));
  }

  return results;
}

/**
 * Parse Alpha Vantage API response into structured oil price data.
 * Extracts current price, daily change, and up to 30 days of history.
 */
function parseAlphaVantageResponse(data: unknown, symbol: 'WTI' | 'BRENT'): OilPriceData {
  const dataObj = data as Record<string, unknown>;
  const key = Object.keys(dataObj).find(k => k.includes('data'));
  const timeSeries = (key ? dataObj[key] : []) as Array<{ date: string; value: string }>;

  const history: OilPricePoint[] = timeSeries
    .slice(0, 30)
    .map((point) => ({
      date: new Date(point.date),
      price: parseFloat(point.value),
    }))
    .filter((p) => !isNaN(p.price));

  const current = history[0]?.price || 0;
  const previous = history[1]?.price || current;
  const change = current - previous;
  const changePercent = previous ? (change / previous) * 100 : 0;

  return { symbol, current, change, changePercent, history };
}
