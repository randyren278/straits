/**
 * FRED Fetcher Tests
 * Covers the keyed observations API, key validation, and the keyless
 * fredgraph.csv fallback (FRED rejects missing/malformed keys with 400,
 * but fredgraph.csv serves the same series with no key at all).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFREDPrices } from './fred';

const API_HOST = 'api.stlouisfed.org';
const CSV_HOST = 'fred.stlouisfed.org/graph/fredgraph.csv';

const VALID_KEY = 'a'.repeat(32); // 32 lowercase alphanumerics

function apiResponse() {
  return {
    ok: true,
    json: async () => ({
      observations: [
        { date: '2026-07-20', value: '84.38' },
        { date: '2026-07-17', value: '83.43' },
      ],
    }),
  };
}

function csvResponse() {
  return {
    ok: true,
    text: async () =>
      'observation_date,DCOILWTICO\n' +
      '2026-07-15,79.10\n' +
      '2026-07-16,80.03\n' +
      '2026-07-17,.\n' + // holiday gap — must be filtered
      '2026-07-20,84.38\n',
  };
}

describe('fetchFREDPrices', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('uses the keyed observations API when the key is valid', async () => {
    vi.stubEnv('FRED_API_KEY', VALID_KEY);
    fetchMock.mockResolvedValue(apiResponse());

    const prices = await fetchFREDPrices();

    expect(prices).toHaveLength(2);
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.every((u) => u.includes(API_HOST))).toBe(true);
    expect(urls.every((u) => u.includes(`api_key=${VALID_KEY}`))).toBe(true);
  });

  it('skips straight to the keyless CSV when the key is malformed', async () => {
    // 36 chars with a '/': the shape of the real misconfiguration this guards.
    vi.stubEnv('FRED_API_KEY', 'abc123/def456ghi789jkl012mno345pqr67');
    fetchMock.mockResolvedValue(csvResponse());

    const prices = await fetchFREDPrices();

    expect(prices).toHaveLength(2);
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.every((u) => u.includes(CSV_HOST))).toBe(true);
  });

  it('uses the keyless CSV when no key is set', async () => {
    vi.stubEnv('FRED_API_KEY', '');
    fetchMock.mockResolvedValue(csvResponse());

    await fetchFREDPrices();

    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.every((u) => u.includes(CSV_HOST))).toBe(true);
  });

  it('parses the CSV into current price, change, and ascending history', async () => {
    vi.stubEnv('FRED_API_KEY', '');
    fetchMock.mockResolvedValue(csvResponse());

    const prices = await fetchFREDPrices();
    const wti = prices.find((p) => p.symbol === 'WTI')!;

    expect(wti.current).toBe(84.38);          // most recent valid row
    expect(wti.change).toBeCloseTo(4.35);     // 84.38 - 80.03 ('.' row skipped)
    // History reads oldest → newest for the sparkline.
    expect(wti.history.map((h) => h.price)).toEqual([79.1, 80.03, 84.38]);
  });

  it('falls back to the CSV when the keyed API fails', async () => {
    vi.stubEnv('FRED_API_KEY', VALID_KEY);
    fetchMock.mockImplementation(async (url: string) =>
      url.includes(API_HOST) ? { ok: false, status: 400 } : csvResponse()
    );

    const prices = await fetchFREDPrices();

    expect(prices).toHaveLength(2);
    expect(prices.every((p) => p.current > 0)).toBe(true);
  });

  it('throws when both the API and the CSV are unreachable (offline)', async () => {
    vi.stubEnv('FRED_API_KEY', '');
    fetchMock.mockRejectedValue(new Error('fetch failed'));

    await expect(fetchFREDPrices()).rejects.toThrow();
  });
});
