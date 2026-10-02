import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => vi.fn());
vi.mock('./index', () => ({ query: queryMock }));

import { getRegionBuckets, getRegionPeers, getVesselGapSummary } from './coverage-diagnostics';

describe('bounded coverage diagnostics queries', () => {
  beforeEach(() => queryMock.mockReset().mockResolvedValue([]));

  it('reads only the requested region’s 48-hour buckets', async () => {
    await getRegionBuckets('suez');
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("bucket_start >= NOW() - INTERVAL '48 hours'");
    expect(sql).toContain("bucket_start <= NOW()");
    expect(sql).toContain('FROM collection_buckets');
    expect(params).toEqual(['suez']);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE|DROP)\b/i);
  });

  it('limits latest in-region vessels to 100 and parameterizes bounds', async () => {
    await getRegionPeers('suez', { minLat: 29.5, maxLat: 32.5, minLon: 31.5, maxLon: 33 });
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain('LIMIT 100');
    expect(sql).toContain("latest.time >= NOW() - INTERVAL '48 hours'");
    expect(sql).toContain('latest.latitude BETWEEN $1 AND $2');
    expect(sql).toContain('latest.longitude BETWEEN $3 AND $4');
    expect(params).toEqual([29.5, 32.5, 31.5, 33]);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE|DROP)\b/i);
  });

  it('bounds selected vessel fixes to one MMSI and the same 48-hour window', async () => {
    await getVesselGapSummary('123456789');
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain('FROM vessel_positions');
    expect(sql).toContain("time >= NOW() - INTERVAL '48 hours'");
    expect(sql).toContain('time <= NOW()');
    expect(sql).toContain('WHERE mmsi = $1');
    expect(sql.match(/ORDER BY seconds DESC, gap_start ASC LIMIT 1/g)).toHaveLength(3);
    expect(params).toEqual(['123456789']);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE|DROP)\b/i);
  });
});
