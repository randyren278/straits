import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const load = vi.hoisted(() => vi.fn());
vi.mock('@/lib/investigations/encounters', () => ({ loadRecentEncounterLeads: load }));

import { GET } from './route';

beforeEach(() => {
  vi.stubEnv('STRAITS_CANARY', '1');
  vi.stubEnv('VERCEL_ENV', 'preview');
  load.mockReset().mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/investigations/encounters', () => {
  it('returns a bounded public lead list with a one-minute edge cache', async () => {
    const lead = { imo: '9000001', name: 'NORTH STAR', partnerImo: '9000002', partnerName: 'SOUTH STAR', lastSeenAt: '2026-10-09T09:00:00.000Z', minDistanceKm: 0.42, eventId: '9000002-1791532800000000' };
    load.mockResolvedValueOnce([lead]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=60');
    expect(await response.json()).toEqual({ leads: [lead] });
  });

  it('hides leads outside the canary deployment', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await GET()).status).toBe(404);
    expect(load).not.toHaveBeenCalled();
  });

  it('returns an unavailable state without caching a failed query', async () => {
    load.mockRejectedValueOnce(new Error('unavailable'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
