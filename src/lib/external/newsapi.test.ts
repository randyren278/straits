/**
 * NewsAPI Fetcher Tests
 * Tests for fetching and filtering news headlines by oil/tanker keywords.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchNewsHeadlines, calculateRelevance, type NewsHeadline } from './newsapi';

describe('NewsAPI Fetcher', () => {
  const originalFetch = global.fetch;
  const mockApiKey = 'test-news-api-key';

  beforeEach(() => {
    vi.stubEnv('NEWSAPI_KEY', mockApiKey);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  describe('fetchNewsHeadlines', () => {
    it('fetches headlines from NewsAPI', async () => {
      const mockResponse = {
        status: 'ok',
        articles: [
          {
            title: 'Oil prices surge amid Middle East tensions',
            source: { name: 'Reuters' },
            url: 'https://reuters.com/article1',
            publishedAt: '2026-03-11T10:00:00Z',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const headlines = await fetchNewsHeadlines();

      expect(global.fetch).toHaveBeenCalled();
      expect(headlines.length).toBeGreaterThan(0);
      expect(headlines[0].title).toBe('Oil prices surge amid Middle East tensions');
    });

    it('filters headlines by oil/tanker keywords', async () => {
      const mockResponse = {
        status: 'ok',
        articles: [
          { title: 'Oil tanker blocked at Strait of Hormuz', source: { name: 'BBC' }, url: 'https://bbc.com/1', publishedAt: '2026-03-11T10:00:00Z' },
          { title: 'Weather forecast for tomorrow', source: { name: 'Weather' }, url: 'https://weather.com/1', publishedAt: '2026-03-11T10:00:00Z' },
          { title: 'OPEC announces production cuts', source: { name: 'CNN' }, url: 'https://cnn.com/1', publishedAt: '2026-03-11T10:00:00Z' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const headlines = await fetchNewsHeadlines();

      // Should include oil/tanker headlines, exclude weather
      expect(headlines.some(h => h.title.includes('tanker'))).toBe(true);
      expect(headlines.some(h => h.title.includes('OPEC'))).toBe(true);
      expect(headlines.some(h => h.title.includes('Weather'))).toBe(false);
    });

    it('returns max 15 headlines', async () => {
      const mockArticles = Array.from({ length: 50 }, (_, i) => ({
        title: `Oil price update ${i}`,
        source: { name: 'News' },
        url: `https://news.com/${i}`,
        publishedAt: '2026-03-11T10:00:00Z',
      }));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', articles: mockArticles }),
      });

      const headlines = await fetchNewsHeadlines();

      expect(headlines.length).toBeLessThanOrEqual(15);
    });

    it('throws error when API key is not configured', async () => {
      vi.stubEnv('NEWSAPI_KEY', '');

      await expect(fetchNewsHeadlines()).rejects.toThrow('NEWSAPI_KEY not configured');
    });

    it('throws error on HTTP failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });

      await expect(fetchNewsHeadlines()).rejects.toThrow('NewsAPI: 403');
    });
  });

  describe('relevance scoring', () => {
    it('assigns higher score to headlines with multiple keywords', () => {
      const score1 = calculateRelevance('Oil tanker in Strait of Hormuz sanctions');
      const score2 = calculateRelevance('Oil prices rise');

      expect(score1).toBeGreaterThan(score2);
      expect(score1).toBeGreaterThanOrEqual(4); // oil, tanker, Strait of Hormuz, sanctions
    });

    it('assigns score 0 to headlines with no matching keywords', () => {
      const score = calculateRelevance('Weather forecast for tomorrow');

      expect(score).toBe(0);
    });

    it('handles case-insensitive matching', () => {
      const score = calculateRelevance('OIL TANKER IRAN SANCTIONS');

      expect(score).toBeGreaterThan(0);
    });
  });
});
