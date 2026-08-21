import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/health', () => {
  it('returns a cache-disabled liveness payload without external dependencies', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.status).toBe('ok');
    expect(body.service).toBe('straits');
    expect(body.timestamp).toEqual(expect.any(String));
    expect(body.environment).toEqual(expect.any(String));
    expect(body.revision).toEqual(expect.any(String));
  });
});
