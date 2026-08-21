import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/index', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('GET /api/ready', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 when the database accepts a probe query', async () => {
    const { pool } = await import('@/lib/db/index');
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ ok: 1 }] } as any);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(pool.query).toHaveBeenCalledWith('SELECT 1 AS ok');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.status).toBe('ready');
    expect(body.database).toBe('ok');
    expect(body.latencyMs).toEqual(expect.any(Number));
  });

  it('returns 503 without leaking the database error when the probe fails', async () => {
    const { pool } = await import('@/lib/db/index');
    vi.mocked(pool.query).mockRejectedValue(new Error('secret connection details'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('not_ready');
    expect(body.database).toBe('unavailable');
    expect(JSON.stringify(body)).not.toContain('secret connection details');
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
