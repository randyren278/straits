import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  clientQuery: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
  buildSnapshot: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ pool: { connect: mocks.connect } }));
vi.mock('@/lib/investigations/stories', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/investigations/stories')>();
  return { ...actual, buildStorySnapshot: mocks.buildSnapshot };
});

import { POST } from './route';

const serverSnapshot = {
  version: 1,
  region: 'hormuz',
  window: '24h',
  claim: { id: 'hormuz-stopped', text: 'Hormuz traffic stopped' },
  evaluation: { status: 'activity_observed' },
  evidence: { generatedAt: '2026-10-01T12:00:00.000Z', activity: { current: { contacts: 12 } } },
};

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/investigation-stories', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv('STRAITS_CANARY', '1');
  vi.stubEnv('VERCEL_ENV', 'preview');
  mocks.release.mockReset();
  mocks.clientQuery.mockReset()
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ count: 0 }] })
    .mockResolvedValueOnce({ rows: [{ id: '211a53ef-a933-47a7-b651-e032479871a2', created_at: new Date('2026-10-01T12:01:00Z') }] })
    .mockResolvedValueOnce({ rows: [] });
  mocks.connect.mockReset().mockResolvedValue({ query: mocks.clientQuery, release: mocks.release });
  mocks.buildSnapshot.mockReset().mockResolvedValue(serverSnapshot);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/investigation-stories', () => {
  it('rebuilds and persists the server snapshot from bounded question input', async () => {
    const response = await POST(request({ region: 'hormuz', window: '24h', claim: 'Hormuz traffic stopped', annotation: 'Check again tomorrow.' }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.href).toBe('/investigations/stories/211a53ef-a933-47a7-b651-e032479871a2');
    expect(mocks.buildSnapshot).toHaveBeenCalledWith({ region: 'hormuz', window: '24h', claimText: 'Hormuz traffic stopped', annotation: 'Check again tomorrow.' });
    const insert = mocks.clientQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO canary.investigation_stories'));
    expect(insert?.[1][5]).toBe(JSON.stringify(serverSnapshot));
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('rejects client-provided report data rather than treating it as evidence', async () => {
    const response = await POST(request({ region: 'hormuz', window: '24h', claim: 'Hormuz traffic stopped', evidence: serverSnapshot.evidence }));
    expect(response.status).toBe(400);
    expect(mocks.buildSnapshot).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('rejects request bodies above the byte limit', async () => {
    const response = await POST(request(' '.repeat(9 * 1024)));
    expect(response.status).toBe(413);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('hides the story endpoint outside canary', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const response = await POST(request({ region: 'hormuz', window: '24h', claim: 'Hormuz traffic stopped' }));
    expect(response.status).toBe(404);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
