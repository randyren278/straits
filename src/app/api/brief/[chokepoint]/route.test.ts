/**
 * Tests for GET /api/brief/[chokepoint] — Chokepoint Situation Brief.
 *
 * Mocks the underlying data functions (vessels, prices, news, SPC band, pool)
 * and asserts the brief composes the expected sections, that news is ordered by
 * relevance_score, and that an unknown chokepoint returns 404.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  pool: { query: vi.fn() },
}));
vi.mock('@/lib/geo/chokepoints', async () => {
  const actual = await vi.importActual<typeof import('@/lib/geo/chokepoints-constants')>(
    '@/lib/geo/chokepoints-constants'
  );
  return {
    CHOKEPOINTS: actual.CHOKEPOINTS,
    getVesselsInChokepoint: vi.fn(),
  };
});
vi.mock('@/lib/db/prices', () => ({ getLatestPrices: vi.fn() }));
vi.mock('@/lib/db/news', () => ({ getLatestNews: vi.fn() }));
vi.mock('@/lib/detection/spc-index', () => ({ getChokepointSpcBand: vi.fn() }));

function makeParams(chokepoint: string) {
  return { params: Promise.resolve({ chokepoint }) };
}

describe('GET /api/brief/[chokepoint]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('composes traffic, anomalies, top-risk, prices, jamming, news, and SPC sections', async () => {
    const { getVesselsInChokepoint } = await import('@/lib/geo/chokepoints');
    const { getLatestPrices } = await import('@/lib/db/prices');
    const { getLatestNews } = await import('@/lib/db/news');
    const { getChokepointSpcBand } = await import('@/lib/detection/spc-index');
    const { pool } = await import('@/lib/db');

    vi.mocked(getVesselsInChokepoint).mockResolvedValue([
      { mmsi: '1', imo: '9000001', name: 'ALPHA', flag: 'PA', shipType: 80, latitude: 25, longitude: 56, hasActiveAnomaly: true, anomalyType: 'going_dark' },
      { mmsi: '2', imo: '9000002', name: 'BETA', flag: 'LR', shipType: 70, latitude: 25, longitude: 56, hasActiveAnomaly: true, anomalyType: 'going_dark' },
      { mmsi: '3', imo: '9000003', name: 'GAMMA', flag: 'MH', shipType: 82, latitude: 25, longitude: 56, hasActiveAnomaly: false, anomalyType: null },
    ] as any);

    vi.mocked(getLatestPrices).mockResolvedValue([
      { symbol: 'WTI', price: 78.5, change: 1.2, changePercent: 1.55, history: [] },
      { symbol: 'BRENT', price: 82.1, change: -0.4, changePercent: -0.48, history: [] },
    ]);

    vi.mocked(getLatestNews).mockResolvedValue([
      { title: 'High relevance', source: 'Reuters', url: 'https://r.com/1', publishedAt: new Date('2026-07-01T00:00:00Z'), relevanceScore: 5 },
      { title: 'Low relevance', source: 'BBC', url: 'https://b.com/1', publishedAt: new Date('2026-07-20T00:00:00Z'), relevanceScore: 1 },
    ]);

    vi.mocked(getChokepointSpcBand).mockResolvedValue({
      mean: 100, stddev: 10, lower: 80, upper: 120, latest: 70, z: -3,
    });

    // Two pool queries: [0] top-risk, [1] jamming ratio.
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [
          { imo: '9000001', name: 'ALPHA', flag: 'PA', score: 88 },
          { imo: '9000003', name: 'GAMMA', flag: 'MH', score: 42 },
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [{ total: '10', low_confidence: '4' }],
      } as any);

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/brief/hormuz'), makeParams('hormuz'));

    expect(response.status).toBe(200);
    const data = await response.json();

    // Chokepoint + traffic
    expect(data.chokepoint.id).toBe('hormuz');
    expect(data.traffic.totalVessels).toBe(3);
    expect(data.traffic.tankerCount).toBe(2); // ship types 80 and 82

    // Anomaly breakdown by type
    expect(data.anomalies.totalActive).toBe(2);
    expect(data.anomalies.byType.going_dark).toBe(2);

    // Top-risk vessels
    expect(data.topRisk).toHaveLength(2);
    expect(data.topRisk[0].score).toBe(88);

    // Prices
    expect(data.prices).toHaveLength(2);
    expect(data.prices[0].symbol).toBe('WTI');

    // GPS jamming ratio
    expect(data.gpsJamming.ratio).toBeCloseTo(0.4);

    // News in relevance order (mock returns already-ranked; brief preserves order)
    expect(data.news[0].relevanceScore).toBe(5);
    expect(data.news[1].relevanceScore).toBe(1);
    expect(data.news[0].relevanceScore).toBeGreaterThanOrEqual(data.news[1].relevanceScore);

    // SPC band present + flagged below band
    expect(data.spc).not.toBeNull();
    expect(data.spc.z).toBe(-3);
    expect(data.spc.belowBand).toBe(true);
  });

  it('respects the SPC cold-start null', async () => {
    const { getVesselsInChokepoint } = await import('@/lib/geo/chokepoints');
    const { getLatestPrices } = await import('@/lib/db/prices');
    const { getLatestNews } = await import('@/lib/db/news');
    const { getChokepointSpcBand } = await import('@/lib/detection/spc-index');
    const { pool } = await import('@/lib/db');

    vi.mocked(getVesselsInChokepoint).mockResolvedValue([]);
    vi.mocked(getLatestPrices).mockResolvedValue([]);
    vi.mocked(getLatestNews).mockResolvedValue([]);
    vi.mocked(getChokepointSpcBand).mockResolvedValue(null);
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0', low_confidence: '0' }] } as any);

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/brief/suez'), makeParams('suez'));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.spc).toBeNull();
    expect(data.gpsJamming.ratio).toBe(0);
  });

  it('renders a markdown SITREP with a timestamp header when format=md', async () => {
    const { getVesselsInChokepoint } = await import('@/lib/geo/chokepoints');
    const { getLatestPrices } = await import('@/lib/db/prices');
    const { getLatestNews } = await import('@/lib/db/news');
    const { getChokepointSpcBand } = await import('@/lib/detection/spc-index');
    const { pool } = await import('@/lib/db');

    vi.mocked(getVesselsInChokepoint).mockResolvedValue([]);
    vi.mocked(getLatestPrices).mockResolvedValue([]);
    vi.mocked(getLatestNews).mockResolvedValue([]);
    vi.mocked(getChokepointSpcBand).mockResolvedValue(null);
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0', low_confidence: '0' }] } as any);

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/brief/hormuz?format=md'), makeParams('hormuz'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/markdown');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    const body = await response.text();
    expect(body).toContain('# SITREP — STRAIT OF HORMUZ');
    expect(body).toContain('GENERATED:');
  });

  it('returns 404 for an unknown chokepoint', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/brief/nowhere'), makeParams('nowhere'));

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});
