import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const load = vi.hoisted(() => vi.fn());
vi.mock('@/lib/investigations/encounters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/investigations/encounters')>();
  return { ...actual, loadEncounterCase: load };
});

import { GET } from './route';

function request(suffix = '') {
  return new Request(`http://localhost/api/investigations/encounters/9000001${suffix}`);
}

function context(imo = '9000001') {
  return { params: Promise.resolve({ imo }) };
}

beforeEach(() => {
  vi.stubEnv('STRAITS_CANARY', '1');
  vi.stubEnv('VERCEL_ENV', 'preview');
  load.mockReset().mockResolvedValue({
    kind: 'found',
    data: { vessel: { imo: '9000001', name: 'NORTH STAR', mmsi: '123456789', flag: 'PA' }, encounters: [], selected: null },
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/investigations/encounters/[imo]', () => {
  it('returns a canary case and disables HTTP caching', async () => {
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect((await response.json()).selected).toBeNull();
    expect(load).toHaveBeenCalledWith('9000001', undefined);
  });

  it('hides the route outside canary before reading evidence', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await GET(request(), context())).status).toBe(404);
    expect(load).not.toHaveBeenCalled();
  });

  it('rejects malformed IMO and event identifiers before reading evidence', async () => {
    expect((await GET(request(), context('not-an-imo'))).status).toBe(404);
    expect((await GET(request('?event=unsafe'), context())).status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });

  it('returns 404 for a well-formed event absent from the ledger', async () => {
    load.mockResolvedValueOnce({ kind: 'event_not_found' });
    const response = await GET(request('?event=9000002-1791552000000000'), context());
    expect(response.status).toBe(404);
    expect(load).toHaveBeenCalledWith('9000001', '9000002-1791552000000000');
  });
});
