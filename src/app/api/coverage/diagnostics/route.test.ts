import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enabled: true,
  buckets: vi.fn(),
  peers: vi.fn(),
  gaps: vi.fn(),
}));

vi.mock('@/lib/canary', () => ({ isCanaryEnabled: () => mocks.enabled }));
vi.mock('@/lib/db/coverage-diagnostics', () => ({
  getRegionBuckets: mocks.buckets,
  getRegionPeers: mocks.peers,
  getVesselGapSummary: mocks.gaps,
}));

import { GET } from './route';

describe('GET /api/coverage/diagnostics', () => {
  beforeEach(() => {
    mocks.enabled = true;
    mocks.buckets.mockReset().mockResolvedValue([]);
    mocks.peers.mockReset().mockResolvedValue([]);
    mocks.gaps.mockReset().mockResolvedValue(null);
  });

  it('returns 404 when canary is disabled', async () => {
    mocks.enabled = false;
    const response = await GET(new Request('http://localhost/api/coverage/diagnostics?region=suez'));
    expect(response.status).toBe(404);
    expect(mocks.buckets).not.toHaveBeenCalled();
  });

  it('validates region and MMSI before querying', async () => {
    expect((await GET(new Request('http://localhost/api/coverage/diagnostics?region=all'))).status).toBe(400);
    expect((await GET(new Request('http://localhost/api/coverage/diagnostics?region=suez&mmsi=bad'))).status).toBe(400);
    expect(mocks.buckets).not.toHaveBeenCalled();
  });

  it('returns regional records and refuses vessel queries outside the observed peer sample', async () => {
    const response = await GET(new Request('http://localhost/api/coverage/diagnostics?region=suez&mmsi=123456789'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.peers.limit).toBe(100);
    expect(body.selectedVessel).toMatchObject({ status: 'not_in_peer_sample', mmsi: '123456789' });
    expect(mocks.gaps).not.toHaveBeenCalled();
    expect(body.regionalCollection.hourly).toHaveLength(48);
  });

  it('queries vessel history only for one of the bounded regional peers', async () => {
    mocks.peers.mockResolvedValue([{ mmsi: '123456789', name: 'Example', lastFix: '2026-10-01T12:00:00Z' }]);
    mocks.gaps.mockResolvedValue({ count: 1, longestGapSeconds: null });
    const response = await GET(new Request('http://localhost/api/coverage/diagnostics?region=suez&mmsi=123456789'));
    const body = await response.json();
    expect(mocks.gaps).toHaveBeenCalledWith('123456789');
    expect(body.selectedVessel.status).toBe('insufficient_history');
    expect(body.interpretation).toMatch(/proves evasion/);
  });
});
