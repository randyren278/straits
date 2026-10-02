import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const loadEvidence = vi.hoisted(() => vi.fn());
vi.mock('@/lib/investigations/evidence', () => ({ loadInvestigationEvidence: loadEvidence }));

import { GET } from './route';

function request(url: string) {
  return new NextRequest(`http://localhost${url}`);
}

beforeEach(() => {
  vi.stubEnv('STRAITS_CANARY', '1');
  vi.stubEnv('VERCEL_ENV', 'preview');
  loadEvidence.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/investigations/[region]', () => {
  it('returns explicit unsupported wording without querying evidence', async () => {
    const response = await GET(request('/api/investigations/hormuz?claim=Why%20did%20it%20close%3F'), { params: Promise.resolve({ region: 'hormuz' }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.evaluation.status).toBe('unsupported');
    expect(body.evidence).toBeNull();
    expect(loadEvidence).not.toHaveBeenCalled();
  });

  it('validates region and structured window inputs', async () => {
    expect((await GET(request('/api/investigations/unknown'), { params: Promise.resolve({ region: 'unknown' }) })).status).toBe(404);
    expect((await GET(request('/api/investigations/hormuz?window=30d'), { params: Promise.resolve({ region: 'hormuz' }) })).status).toBe(400);
    expect(loadEvidence).not.toHaveBeenCalled();
  });

  it('returns 404 outside the canary deployment', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const response = await GET(request('/api/investigations/hormuz'), { params: Promise.resolve({ region: 'hormuz' }) });
    expect(response.status).toBe(404);
    expect(loadEvidence).not.toHaveBeenCalled();
  });
});
