/**
 * Oil Price Fetcher Tests
 * Tests for the orchestrating fetcher with Alpha Vantage primary and FRED fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchOilPrices, type OilPriceData } from './fetcher';

// Mock the external modules
vi.mock('../external/alphavantage', () => ({
  fetchAlphaVantagePrices: vi.fn(),
}));

vi.mock('../external/fred', () => ({
  fetchFREDPrices: vi.fn(),
}));

import { fetchAlphaVantagePrices } from '../external/alphavantage';
import { fetchFREDPrices } from '../external/fred';

describe('Oil Price Fetcher', () => {
  const mockAlphaVantagePrices: OilPriceData[] = [
    {
      symbol: 'WTI',
      current: 80.50,
      change: 1.50,
      changePercent: 1.90,
      history: [{ date: new Date('2026-03-11'), price: 80.50 }],
    },
    {
      symbol: 'BRENT',
      current: 85.00,
      change: 1.00,
      changePercent: 1.19,
      history: [{ date: new Date('2026-03-11'), price: 85.00 }],
    },
  ];

  const mockFREDPrices: OilPriceData[] = [
    {
      symbol: 'WTI',
      current: 80.00,
      change: 1.00,
      changePercent: 1.27,
      history: [{ date: new Date('2026-03-11'), price: 80.00 }],
    },
    {
      symbol: 'BRENT',
      current: 84.50,
      change: 0.50,
      changePercent: 0.60,
      history: [{ date: new Date('2026-03-11'), price: 84.50 }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchOilPrices', () => {
    it('fetches WTI price from Alpha Vantage', async () => {
      vi.mocked(fetchAlphaVantagePrices).mockResolvedValue(mockAlphaVantagePrices);

      const prices = await fetchOilPrices();
      const wti = prices.find(p => p.symbol === 'WTI');

      expect(fetchAlphaVantagePrices).toHaveBeenCalled();
      expect(wti).toBeDefined();
      expect(wti!.current).toBe(80.50);
    });

    it('fetches Brent price from Alpha Vantage', async () => {
      vi.mocked(fetchAlphaVantagePrices).mockResolvedValue(mockAlphaVantagePrices);

      const prices = await fetchOilPrices();
      const brent = prices.find(p => p.symbol === 'BRENT');

      expect(brent).toBeDefined();
      expect(brent!.current).toBe(85.00);
    });

    it('falls back to FRED when Alpha Vantage fails', async () => {
      vi.mocked(fetchAlphaVantagePrices).mockRejectedValue(new Error('Rate limit exceeded'));
      vi.mocked(fetchFREDPrices).mockResolvedValue(mockFREDPrices);

      const prices = await fetchOilPrices();

      expect(fetchAlphaVantagePrices).toHaveBeenCalled();
      expect(fetchFREDPrices).toHaveBeenCalled();
      expect(prices.length).toBe(2);
      expect(prices[0].current).toBe(80.00); // FRED price
    });

    it('returns empty array on complete API failure', async () => {
      vi.mocked(fetchAlphaVantagePrices).mockRejectedValue(new Error('Alpha Vantage down'));
      vi.mocked(fetchFREDPrices).mockRejectedValue(new Error('FRED down'));

      const prices = await fetchOilPrices();

      expect(prices).toEqual([]);
    });
  });
});
