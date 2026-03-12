/**
 * News Fetcher (INTL-03)
 *
 * Orchestrates news fetching from NewsAPI with keyword filtering.
 * Re-exports types and functions from the external newsapi module.
 */

import { fetchNewsHeadlines, type NewsHeadline } from '../external/newsapi';

export type { NewsHeadline };

// Re-export for backwards compatibility
export type NewsItem = NewsHeadline;

/**
 * Fetch relevant news headlines from NewsAPI.
 * Filters for oil/tanker keywords and Middle East region.
 * Returns max 15 headlines sorted by relevance.
 *
 * @returns Array of news items with relevance scores
 */
export async function fetchNews(): Promise<NewsHeadline[]> {
  try {
    return await fetchNewsHeadlines();
  } catch (error) {
    console.error('Failed to fetch news:', error);
    return [];
  }
}
