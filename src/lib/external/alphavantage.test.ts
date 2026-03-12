/**
 * Alpha Vantage API Tests
 * Tests for fetching WTI and Brent crude oil prices.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAlphaVantagePrices, type OilPriceData } from './alphavantage';

describe('Alpha Vantage API', () => {
  const originalFetch = global.fetch;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    vi.stubEnv('ALPHA_VANTAGE_API_KEY', mockApiKey);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  describe('fetchAlphaVantagePrices', () => {
    it('fetches WTI price from Alpha Vantage', async () => {
      const mockResponse = {
        name: 'Crude Oil Prices: West Texas Intermediate (WTI)',
        interval: 'daily',
        data: [
          { date: '2026-03-11', value: '80.50' },
          { date: '2026-03-10', value: '79.00' },
          { date: '2026-03-09', value: '78.50' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const prices = await fetchAlphaVantagePrices();
      const wti = prices.find(p => p.symbol === 'WTI');

      expect(wti).toBeDefined();
      expect(wti!.current).toBe(80.50);
      expect(wti!.change).toBeCloseTo(1.50);
      expect(wti!.changePercent).toBeCloseTo(1.899, 1);
    });

    it('fetches Brent price from Alpha Vantage', async () => {
      const mockWTI = {
        name: 'WTI',
        data: [{ date: '2026-03-11', value: '80.50' }, { date: '2026-03-10', value: '79.00' }],
      };
      const mockBrent = {
        name: 'Brent',
        data: [{ date: '2026-03-11', value: '85.00' }, { date: '2026-03-10', value: '84.00' }],
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        callCount++;
        const response = url.includes('BRENT') ? mockBrent : mockWTI;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        });
      });

      const prices = await fetchAlphaVantagePrices();
      const brent = prices.find(p => p.symbol === 'BRENT');

      expect(brent).toBeDefined();
      expect(brent!.current).toBe(85.00);
      expect(brent!.change).toBeCloseTo(1.00);
    });

    it('includes 30-day history for sparkline', async () => {
      const history = Array.from({ length: 35 }, (_, i) => ({
        date: `2026-03-${String(11 - i).padStart(2, '0')}`,
        value: String(80 - i * 0.1),
      }));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: history }),
      });

      const prices = await fetchAlphaVantagePrices();

      expect(prices[0].history.length).toBeLessThanOrEqual(30);
      expect(prices[0].history.length).toBeGreaterThan(0);
    });

    it('throws error when API key is not configured', async () => {
      vi.stubEnv('ALPHA_VANTAGE_API_KEY', '');

      await expect(fetchAlphaVantagePrices()).rejects.toThrow('ALPHA_VANTAGE_API_KEY not configured');
    });

    it('throws error on API rate limit', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          Note: 'API call frequency exceeded',
        }),
      });

      await expect(fetchAlphaVantagePrices()).rejects.toThrow('Alpha Vantage rate limit');
    });

    it('throws error on HTTP failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(fetchAlphaVantagePrices()).rejects.toThrow('Alpha Vantage WTI: 500');
    });
  });
});
