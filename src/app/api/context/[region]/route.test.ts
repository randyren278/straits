import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/context/region', () => ({ loadRegionContext: vi.fn() }));

describe('GET /api/context/[region]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRAITS_CANARY', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 404 without loading context when canary is disabled', async () => {
    vi.stubEnv('STRAITS_CANARY', '0');
    const { loadRegionContext } = await import('@/lib/context/region');

    const response = await GET(new Request('https://straits.test/api/context/hormuz'), {
      params: Promise.resolve({ region: 'hormuz' }),
    });

    expect(response.status).toBe(404);
    expect(loadRegionContext).not.toHaveBeenCalled();
  });

  it('keeps unsupported regions closed without loading context', async () => {
    const { loadRegionContext } = await import('@/lib/context/region');

    const response = await GET(new Request('https://straits.test/api/context/unknown'), {
      params: Promise.resolve({ region: 'unknown' }),
    });

    expect(response.status).toBe(404);
    expect(loadRegionContext).not.toHaveBeenCalled();
  });

  it('returns the loaded context without caching a canary response', async () => {
    const { loadRegionContext } = await import('@/lib/context/region');
    vi.mocked(loadRegionContext).mockResolvedValue({
      region: 'hormuz', generatedAt: '2026-10-02T06:00:00.000Z',
      sources: { portwatch: { status: 'empty' }, marine: { status: 'available' } },
    } as never);

    const response = await GET(new Request('https://straits.test/api/context/hormuz'), {
      params: Promise.resolve({ region: 'hormuz' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ region: 'hormuz', sources: { portwatch: { status: 'empty' } } });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(loadRegionContext).toHaveBeenCalledWith('hormuz');
  });

  it('does not expose canary context on production even with the flag set', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const { loadRegionContext } = await import('@/lib/context/region');

    const response = await GET(new Request('https://straits.test/api/context/hormuz'), {
      params: Promise.resolve({ region: 'hormuz' }),
    });

    expect(response.status).toBe(404);
    expect(loadRegionContext).not.toHaveBeenCalled();
  });
});
