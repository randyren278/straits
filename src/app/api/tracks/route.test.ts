import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/tracks', () => ({
  getTracks: vi.fn().mockResolvedValue({ generatedAt: 'x', vessels: [{ mmsi: '1' }], backtest: null, learned: null }),
}));
import { GET } from './route';

describe('GET /api/tracks', () => {
  it('returns payloads with CDN caching', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=300');
    expect((await res.json()).vessels).toHaveLength(1);
  });
});
