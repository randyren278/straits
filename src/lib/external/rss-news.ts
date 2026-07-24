/**
 * Google News RSS Fetcher (keyless)
 * Fetches oil/tanker/Middle-East news from Google News RSS search feeds,
 * which require no API key. Parses the RSS XML with a small string-based
 * parser (no new dependency) and scores relevance via calculateRelevance.
 */

import { calculateRelevance, type NewsHeadline } from './newsapi';

export type { NewsHeadline };

/**
 * Google News RSS search feed URLs (keyless). Scoped to the last 7 days.
 */
const FEED_URLS = [
  'https://news.google.com/rss/search?q=' +
    encodeURIComponent('oil tanker "Strait of Hormuz" OPEC when:7d') +
    '&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=' +
    encodeURIComponent('Middle East oil sanctions shipping when:7d') +
    '&hl=en-US&gl=US&ceid=US:en',
];

const USER_AGENT =
  'Mozilla/5.0 (compatible; Straits/1.0; +https://github.com/randyren278/straits)';

/**
 * Fetch news headlines from Google News RSS search feeds.
 * Returns up to 15 deduplicated headlines sorted by relevance then recency.
 * Never throws — returns an empty array on any fetch/parse failure.
 */
export async function fetchRSSHeadlines(): Promise<NewsHeadline[]> {
  try {
    const xmls = await Promise.all(
      FEED_URLS.map(async (url) => {
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
          });
          if (!res.ok) return '';
          return await res.text();
        } catch {
          return '';
        }
      })
    );

    const headlines = xmls.flatMap((xml) => parseRSS(xml));

    // Deduplicate by url, falling back to title.
    const seen = new Set<string>();
    const deduped = headlines.filter((h) => {
      const key = h.url || h.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped
      .sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        return b.publishedAt.getTime() - a.publishedAt.getTime();
      })
      .slice(0, 15);
  } catch (error) {
    console.error('Failed to fetch RSS news:', error);
    return [];
  }
}

/**
 * Extract the first captured group of a regex from a string, or ''.
 */
function extract(block: string, regex: RegExp): string {
  const match = block.match(regex);
  return match ? match[1] : '';
}

/**
 * Strip CDATA wrappers and decode a handful of common XML entities.
 */
function clean(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * Parse a Google News RSS XML string into NewsHeadline objects.
 * Extracts <item> blocks and their <title>, <link>, <pubDate>, <source>.
 */
function parseRSS(xml: string): NewsHeadline[] {
  if (!xml) return [];

  const items = xml.match(/<item\b[\s\S]*?<\/item>/g) ?? [];

  return items
    .map((block) => {
      const title = clean(extract(block, /<title>([\s\S]*?)<\/title>/));
      const link = clean(extract(block, /<link>([\s\S]*?)<\/link>/));
      const pubDate = clean(extract(block, /<pubDate>([\s\S]*?)<\/pubDate>/));
      // Google News RSS <source> has attributes: <source url="...">Name</source>
      const source =
        clean(extract(block, /<source\b[^>]*>([\s\S]*?)<\/source>/)) ||
        'Google News';

      const publishedAt = pubDate ? new Date(pubDate) : new Date();

      return {
        title,
        source,
        url: link,
        publishedAt: isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
        relevanceScore: calculateRelevance(title),
      };
    })
    .filter((h) => h.title.length > 0);
}
