/**
 * News Database Tests
 * Tests for storing and retrieving news items from database.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { insertNewsItem, getLatestNews, purgeOldNews, type NewsHeadline } from './news';

// Mock the database pool
vi.mock('./index', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from './index';

describe('News Database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('insertNewsItem', () => {
    it('inserts new headline into news_items table', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const item: NewsHeadline = {
        title: 'Oil prices rise amid tensions',
        source: 'Reuters',
        url: 'https://reuters.com/article1',
        publishedAt: new Date('2026-03-11T10:00:00Z'),
        relevanceScore: 3,
      };

      await insertNewsItem(item);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO news_items'),
        expect.arrayContaining([item.title, item.source, item.url])
      );
    });

    it('updates relevance score on URL conflict (upsert)', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const item: NewsHeadline = {
        title: 'Oil prices rise amid tensions',
        source: 'Reuters',
        url: 'https://reuters.com/article1',
        publishedAt: new Date('2026-03-11T10:00:00Z'),
        relevanceScore: 5,
      };

      await insertNewsItem(item);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });
  });

  describe('getLatestNews', () => {
    it('returns recent 15 headlines ordered by published_at', async () => {
      const mockNews = [
        { title: 'Article 1', source: 'BBC', url: 'https://bbc.com/1', publishedAt: new Date(), relevanceScore: 2 },
        { title: 'Article 2', source: 'CNN', url: 'https://cnn.com/1', publishedAt: new Date(), relevanceScore: 3 },
      ];

      vi.mocked(pool.query).mockResolvedValue({ rows: mockNews } as any);

      const news = await getLatestNews();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY published_at DESC'),
        expect.arrayContaining([15])
      );
      expect(news.length).toBe(2);
    });

    it('accepts custom limit parameter', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as any);

      await getLatestNews(10);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10])
      );
    });
  });

  describe('purgeOldNews', () => {
    it('deletes news older than specified days', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 5 } as any);

      const deleted = await purgeOldNews(7);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM news_items')
      );
      expect(deleted).toBe(5);
    });
  });
});
