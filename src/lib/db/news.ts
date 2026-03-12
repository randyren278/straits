/**
 * News Database CRUD Operations
 * Store and retrieve news headlines from the news_items table.
 */

import { pool } from './index';

export interface NewsHeadline {
  title: string;
  source: string;
  url: string;
  publishedAt: Date;
  relevanceScore: number;
}

/**
 * Insert or update a news headline in the database.
 * Uses upsert pattern to update relevance score if URL already exists.
 *
 * @param item - News headline with relevance score
 */
export async function insertNewsItem(item: NewsHeadline): Promise<void> {
  await pool.query(`
    INSERT INTO news_items (title, source, url, published_at, relevance_score)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (url) DO UPDATE SET
      relevance_score = EXCLUDED.relevance_score
  `, [item.title, item.source, item.url, item.publishedAt, item.relevanceScore]);
}

/**
 * Get the latest news headlines from the database.
 * Returns headlines ordered by publication date (newest first).
 *
 * @param limit - Maximum number of headlines to return (default 15)
 * @returns Array of news headlines with relevance scores
 */
export async function getLatestNews(limit: number = 15): Promise<NewsHeadline[]> {
  const result = await pool.query<{
    title: string;
    source: string;
    url: string;
    publishedAt: Date;
    relevanceScore: number;
  }>(`
    SELECT title, source, url, published_at as "publishedAt", relevance_score as "relevanceScore"
    FROM news_items
    ORDER BY published_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
}

/**
 * Delete old news items to prevent database bloat.
 *
 * @param daysOld - Delete items older than this many days (default 7)
 * @returns Number of deleted rows
 */
export async function purgeOldNews(daysOld: number = 7): Promise<number> {
  const result = await pool.query(`
    DELETE FROM news_items WHERE created_at < NOW() - INTERVAL '${daysOld} days'
  `);
  return result.rowCount || 0;
}
