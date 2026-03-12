/**
 * Prices Database Tests
 * Tests for storing and retrieving oil prices from database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertPrice, getLatestPrices, type OilPriceData } from './prices';

// Mock the database pool
vi.mock('./index', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from './index';

describe('Prices Database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('insertPrice', () => {
    it('inserts price into oil_prices table', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const price: OilPriceData = {
        symbol: 'WTI',
        current: 80.50,
        change: 1.50,
        changePercent: 1.90,
        history: [],
      };

      await insertPrice(price);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO oil_prices'),
        expect.arrayContaining([price.symbol, price.current, price.change, price.changePercent])
      );
    });
  });

  describe('getLatestPrices', () => {
    it('returns latest price for each symbol with history', async () => {
      const latestRows = [
        { symbol: 'WTI', price: 80.50, change: 1.50, changePercent: 1.90 },
        { symbol: 'BRENT', price: 85.00, change: 1.00, changePercent: 1.19 },
      ];
      const historyRows = [
        { symbol: 'WTI', value: 80.50, fetched_at: new Date() },
        { symbol: 'WTI', value: 79.00, fetched_at: new Date() },
        { symbol: 'BRENT', value: 85.00, fetched_at: new Date() },
      ];

      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: latestRows } as any)
        .mockResolvedValueOnce({ rows: historyRows } as any);

      const prices = await getLatestPrices();

      expect(prices.length).toBe(2);
      expect(prices[0].symbol).toBe('WTI');
      expect(prices[0].history.length).toBe(2);
      expect(prices[1].symbol).toBe('BRENT');
    });

    it('queries distinct latest prices and 30-day history', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await getLatestPrices();

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query).toHaveBeenNthCalledWith(1, expect.stringContaining('DISTINCT ON (symbol)'));
      expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('30 days'));
    });
  });
});
