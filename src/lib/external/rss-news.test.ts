/**
 * Google News RSS Fetcher Tests
 * Tests parsing of canned Google News RSS XML into NewsHeadline objects.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchRSSHeadlines } from './rss-news';

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Oil news</title>
    <item>
      <title>Oil tanker blocked at Strait of Hormuz amid sanctions</title>
      <link>https://news.google.com/articles/oil-tanker-hormuz</link>
      <pubDate>Mon, 20 Jul 2026 10:00:00 GMT</pubDate>
      <source url="https://reuters.com">Reuters</source>
    </item>
    <item>
      <title>OPEC announces crude production cuts</title>
      <link>https://news.google.com/articles/opec-cuts</link>
      <pubDate>Sun, 19 Jul 2026 08:00:00 GMT</pubDate>
      <source url="https://bbc.com">BBC</source>
    </item>
  </channel>
</rss>`;

describe('Google News RSS Fetcher', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses RSS XML into NewsHeadline objects', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(RSS_XML),
    });

    const headlines = await fetchRSSHeadlines();

    expect(global.fetch).toHaveBeenCalled();
    expect(headlines.length).toBeGreaterThan(0);

    const top = headlines[0];
    expect(top.title).toBe('Oil tanker blocked at Strait of Hormuz amid sanctions');
    expect(top.url).toBe('https://news.google.com/articles/oil-tanker-hormuz');
    expect(top.source).toBe('Reuters');
    expect(top.publishedAt).toBeInstanceOf(Date);
    expect(top.publishedAt.getTime()).not.toBeNaN();
    expect(top.relevanceScore).toBeGreaterThan(0);
  });

  it('sends a User-Agent header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(RSS_XML),
    });
    global.fetch = fetchMock;

    await fetchRSSHeadlines();

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers?.['User-Agent']).toBeTruthy();
  });

  it('deduplicates headlines by url across feeds', async () => {
    // Both feeds return the same XML, so every item appears twice pre-dedup.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(RSS_XML),
    });

    const headlines = await fetchRSSHeadlines();
    const urls = headlines.map((h) => h.url);

    expect(new Set(urls).size).toBe(urls.length);
    expect(headlines.length).toBe(2);
  });

  it('returns an empty array on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    const headlines = await fetchRSSHeadlines();

    expect(headlines).toEqual([]);
  });

  it('returns an empty array on non-ok responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve(''),
    });

    const headlines = await fetchRSSHeadlines();

    expect(headlines).toEqual([]);
  });
});
