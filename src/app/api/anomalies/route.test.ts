import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const query = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ pool: { query } }));

import { GET } from './route';

describe('GET /api/anomalies since view', () => {
  it('returns only the fields needed for a returning visitor', async () => {
    query.mockResolvedValueOnce({ rows: [{ imo: '9000001', detectedAt: new Date('2026-09-29T12:00:00Z') }] });
    const response = await GET(new NextRequest('http://localhost/api/anomalies?view=since&since=2026-09-28T12%3A00%3A00Z'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ anomalies: [{ imo: '9000001', detectedAt: '2026-09-29T12:00:00.000Z' }] });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('va.detected_at > $1'), [new Date('2026-09-28T12:00:00Z')]);
    expect(query.mock.calls[0][0]).not.toContain('va.details');
  });

  it('rejects a malformed timestamp without querying the database', async () => {
    query.mockClear();
    const response = await GET(new NextRequest('http://localhost/api/anomalies?view=since&since=bad'));
    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('keeps the full fleet response as the default contract', async () => {
    query.mockReset();
    const row = { imo: '9000001', details: { reason: 'test' }, riskScore: 71 };
    query.mockResolvedValueOnce({ rows: [row] });
    const response = await GET(new NextRequest('http://localhost/api/anomalies'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ anomalies: [row] });
    expect(query.mock.calls[0][0]).toContain('va.details');
  });

  it('returns tab counts without anomaly dossiers', async () => {
    query.mockReset();
    query.mockResolvedValueOnce({ rows: [
      { anomalyType: 'loitering', count: '30' },
      { anomalyType: 'sanctioned', count: '2' },
      { anomalyType: 'speed', count: '0' },
    ] });
    query.mockResolvedValueOnce({ rows: [{ id: 1, imo: '9000001' }] });
    const response = await GET(new NextRequest('http://localhost/api/anomalies?view=fleet-summary'));
    expect(await response.json()).toEqual({
      counts: [ { anomalyType: 'loitering', count: 30 }, { anomalyType: 'sanctioned', count: 2 } ],
      initialTab: 'sanctioned', initialAnomalies: [{ id: 1, imo: '9000001' }], pageSize: 15,
    });
    expect(query.mock.calls[0][0]).toContain('COUNT(DISTINCT active.imo)');
    expect(query.mock.calls[0][0]).not.toContain('va.details');
  });

  it('limits a sorted fleet page to 15 and rejects untrusted sort SQL', async () => {
    query.mockReset();
    query.mockResolvedValueOnce({ rows: [{ id: 26, imo: '9000001' }] });
    const response = await GET(new NextRequest('http://localhost/api/anomalies?view=fleet-page&tab=loitering&page=2&sort=riskScore&dir=asc'));
    expect(await response.json()).toEqual({ anomalies: [{ id: 26, imo: '9000001' }], page: 2, pageSize: 15 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('"riskScore" ASC NULLS LAST'), ['loitering', 15, 15]);
    query.mockClear();
    const rejected = await GET(new NextRequest('http://localhost/api/anomalies?view=fleet-page&tab=loitering&sort=DROP%20TABLE'));
    expect(rejected.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
