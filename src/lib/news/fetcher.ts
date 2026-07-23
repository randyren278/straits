/**
 * News Fetcher (INTL-03)
 *
 * Orchestrates news fetching from a keyless Google News RSS source with
 * keyword filtering. Re-exports types from the external newsapi module.
 */

import { fetchRSSHeadlines } from '../external/rss-news';
import { type NewsHeadline } from '../external/newsapi';

export type { NewsHeadline };

// Re-export for backwards compatibility
export type NewsItem = NewsHeadline;

/**
 * Fetch relevant news headlines from keyless Google News RSS feeds.
 * Filters for oil/tanker keywords and Middle East region.
 * Returns max 15 headlines sorted by relevance.
 *
 * @returns Array of news items with relevance scores
 */
export async function fetchNews(): Promise<NewsHeadline[]> {
  try {
    return await fetchRSSHeadlines();
  } catch (error) {
    console.error('Failed to fetch news:', error);
    return [];
  }
}
