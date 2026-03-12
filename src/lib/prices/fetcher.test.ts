import { describe, it, expect } from 'vitest';

describe('Oil Price Fetcher', () => {
  describe('fetchOilPrices', () => {
    it.todo('fetches WTI price from Alpha Vantage');
    it.todo('fetches Brent price from Alpha Vantage');
    it.todo('falls back to FRED when Alpha Vantage fails');
    it.todo('returns empty array on complete API failure');
  });

  describe('caching', () => {
    it.todo('returns cached price within 15 minutes');
    it.todo('fetches fresh price after cache expiry');
  });
});
