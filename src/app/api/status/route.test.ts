/**
 * Tests for GET /api/status route.
 * Tests freshness classification for AIS, prices, and news sources.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classify } from './route';

// Mock the database pool
vi.mock('@/lib/db/index', () => ({
  pool: {
    query: vi.fn(),
  },
}));

const MIN = 60 * 1000;
const HR = 60 * MIN;

describe('classify()', () => {
  it('returns offline when lastUpdate is null', () => {
    expect(classify(null, 5 * MIN, 30 * MIN)).toBe('offline');
    expect(classify(null, 2 * HR, 24 * HR)).toBe('offline');
    expect(classify(null, HR, 12 * HR)).toBe('offline');
  });

  it('returns live when lastUpdate is within live threshold', () => {
    const recent = new Date(Date.now() - 2 * MIN); // 2 min ago
    expect(classify(recent, 5 * MIN, 30 * MIN)).toBe('live');
  });

  it('returns degraded when lastUpdate is between live and degraded thresholds', () => {
    const degraded = new Date(Date.now() - 3 * HR); // 3 hours ago
    // prices: live < 2hr, degraded < 24hr
    expect(classify(degraded, 2 * HR, 24 * HR)).toBe('degraded');
  });

  it('returns offline when lastUpdate exceeds degraded threshold', () => {
    const stale = new Date(Date.now() - 25 * HR); // 25 hours ago
    expect(classify(stale, 2 * HR, 24 * HR)).toBe('offline');
  });
});

describe('GET /api/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { ais: live, prices: live, news: live } when all timestamps are recent', async () => {
    const { pool } = await import('@/lib/db/index');
    const now = new Date();
    const recentAis = new Date(Date.now() - 2 * MIN); // 2 min ago
    const recentPrices = new Date(Date.now() - 30 * MIN); // 30 min ago
    const recentNews = new Date(Date.now() - 20 * MIN); // 20 min ago

    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ last_update: recentAis }] } as any)
      .mockResolvedValueOnce({ rows: [{ last_update: recentPrices }] } as any)
      .mockResolvedValueOnce({ rows: [{ last_update: recentNews }] } as any);

    const { GET } = await import('./route');
    const response = await GET();
    const data = await response.json();

    expect(data).toEqual({ ais: 'live', prices: 'live', news: 'live' });
  });

  it('returns offline for all sources when tables are empty (null timestamps)', async () => {
    const { pool } = await import('@/lib/db/index');

    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ last_update: null }] } as any)
      .mockResolvedValueOnce({ rows: [{ last_update: null }] } as any)
      .mockResolvedValueOnce({ rows: [{ last_update: null }] } as any);

    const { GET } = await import('./route');
    const response = await GET();
    const data = await response.json();

    expect(data).toEqual({ ais: 'offline', prices: 'offline', news: 'offline' });
  });

  it('returns degraded for prices when fetched_at is between 2hr and 24hr old', async () => {
    const { pool } = await import('@/lib/db/index');
    const recentAis = new Date(Date.now() - 2 * MIN);
    const degradedPrices = new Date(Date.now() - 3 * HR); // 3 hours ago
    const recentNews = new Date(Date.now() - 20 * MIN);

    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ last_update: recentAis }] } as any)
      .mockResolvedValueOnce({ rows: [{ last_update: degradedPrices }] } as any)
      .mockResolvedValueOnce({ rows: [{ last_update: recentNews }] } as any);

    const { GET } = await import('./route');
    const response = await GET();
    const data = await response.json();

    expect(data.prices).toBe('degraded');
    expect(data.ais).toBe('live');
    expect(data.news).toBe('live');
  });

  it('returns 200 status code with JSON content', async () => {
    const { pool } = await import('@/lib/db/index');
    const now = new Date(Date.now() - 1 * MIN);

    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ last_update: now }] } as any)
      .mockResolvedValueOnce({ rows: [{ last_update: now }] } as any)
      .mockResolvedValueOnce({ rows: [{ last_update: now }] } as any);

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('ais');
    expect(data).toHaveProperty('prices');
    expect(data).toHaveProperty('news');
  });
});
