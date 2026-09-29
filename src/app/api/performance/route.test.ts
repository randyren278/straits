import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const query = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ pool: { query } }));

import { POST } from './route';

const sample = {
  sampleId: '019a821f-6491-7a2d-8b2d-b41cb4249a77', metric: 'LCP', value: 2345,
  route: '/dashboard', device: 'phone', connection: '4g',
};

function request(body: unknown, origin = 'http://localhost') {
  const result = new NextRequest('http://localhost/api/performance', {
    method: 'POST', body: JSON.stringify(body),
  });
  result.headers.set('origin', origin);
  result.headers.set('Content-Type', 'application/json');
  return result;
}

beforeEach(() => { query.mockReset().mockResolvedValue({ rows: [] }); });

describe('POST /api/performance', () => {
  it('stores a bounded anonymous sample and upserts later vital updates', async () => {
    const response = await POST(request(sample));
    expect(response.status).toBe(204);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (sample_id, metric) DO UPDATE'), [
      sample.sampleId, 'LCP', '/dashboard', 'phone', '4g', 2345, 'local',
    ]);
    expect((await POST(request({ ...sample, metric: 'SNAPSHOT_RECEIVED' }))).status).toBe(204);
    expect((await POST(request({ ...sample, metric: 'MAP_STYLE_READY' }))).status).toBe(204);
  });

  it('rejects arbitrary routes, values, and cross-origin writes before the database', async () => {
    expect((await POST(request({ ...sample, route: '/dashboard?imo=private' }))).status).toBe(400);
    expect((await POST(request({ ...sample, value: Infinity }))).status).toBe(400);
    const crossOrigin = request(sample, 'https://elsewhere.example');
    expect(crossOrigin.headers.get('origin')).toBe('https://elsewhere.example');
    expect(crossOrigin.nextUrl.origin).toBe('http://localhost');
    expect((await POST(crossOrigin)).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('reports a database failure instead of swallowing it', async () => {
    query.mockRejectedValueOnce(new Error('database unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await POST(request(sample));
    expect(response.status).toBe(503);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('performance-sample-write-failed'));
    log.mockRestore();
  });
});
