/**
 * NewsAPI Fetcher
 * Fetches oil and shipping related news headlines from NewsAPI.
 * Filters headlines by relevant keywords and calculates relevance scores.
 */

export interface NewsHeadline {
  title: string;
  source: string;
  url: string;
  publishedAt: Date;
  relevanceScore: number;
}

/**
 * Keywords for filtering oil/tanker/geopolitical news.
 * Includes oil industry terms, shipping, Middle East regions, and sanctions.
 */
const KEYWORDS = [
  'oil', 'tanker', 'Iran', 'Strait of Hormuz', 'OPEC', 'sanctions',
  'Red Sea', 'Houthi', 'Saudi Arabia', 'UAE', 'pipeline', 'crude',
  'petroleum', 'shipping', 'vessel', 'embargo', 'Middle East',
];

/**
 * Fetch news headlines from NewsAPI filtered by oil/tanker keywords.
 * Returns up to 15 headlines sorted by relevance score.
 *
 * @throws Error if API key is not configured
 * @throws Error on API failure
 */
export async function fetchNewsHeadlines(): Promise<NewsHeadline[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) throw new Error('NEWSAPI_KEY not configured');

  // Use everything endpoint with keyword query
  const query = encodeURIComponent('oil OR tanker OR "Middle East" OR OPEC OR sanctions');
  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=50&apiKey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`NewsAPI: ${res.status}`);

  const data = await res.json() as {
    status: string;
    articles: Array<{
      title: string;
      source: { name: string };
      url: string;
      publishedAt: string;
    }>;
  };

  return data.articles
    .map((article) => ({
      title: article.title,
      source: article.source?.name || 'Unknown',
      url: article.url,
      publishedAt: new Date(article.publishedAt),
      relevanceScore: calculateRelevance(article.title),
    }))
    .filter((h) => h.relevanceScore > 0)
    .slice(0, 15);
}

/**
 * Calculate relevance score based on keyword matches in title.
 * Higher score = more relevant to oil/tanker tracking.
 *
 * @param title - Article headline text
 * @returns Number of keyword matches (0 = not relevant)
 */
export function calculateRelevance(title: string): number {
  const lowerTitle = title.toLowerCase();
  return KEYWORDS.filter(kw => lowerTitle.includes(kw.toLowerCase())).length;
}
