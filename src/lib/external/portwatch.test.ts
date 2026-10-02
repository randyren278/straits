import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPortWatch, PORTWATCH_SOURCE, type PortWatchCountField } from './portwatch';

const NOW = new Date('2026-10-02T05:39:20.000Z');
const COUNT_FIELDS: PortWatchCountField[] = [
  'n_container', 'n_dry_bulk', 'n_general_cargo', 'n_roro', 'n_tanker', 'n_cargo', 'n_total',
];

function feature(date = '2026-09-27', overrides: Partial<Record<PortWatchCountField, unknown>> = {}) {
  const attributes: Record<string, unknown> = { date };
  COUNT_FIELDS.forEach((field, index) => { attributes[field] = index; });
  return { attributes: { ...attributes, ...overrides } };
}

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchPortWatch', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses source dates and integer transit counts without mixing in capacity estimates', async () => {
    fetchMock.mockResolvedValue(response({ features: [feature()] }));

    const result = await fetchPortWatch('hormuz', fetchMock, NOW);

    expect(result.status).toBe('available');
    expect(result.latestSourceDate).toBe('2026-09-27');
    expect(result.sourceLagDays).toBe(5);
    expect(result.stale).toBe(false);
    expect(result.fetchedAt).toBe(NOW.toISOString());
    expect(result.source).toBe(PORTWATCH_SOURCE);
    expect(result.rows[0].counts.n_tanker).toBe(4);
    expect(result.rows[0].counts.n_total).toBe(6);
    expect(result.rows[0]).not.toHaveProperty('capacity');

    const [requestUrl, init] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(requestUrl as string);
    expect(parsedUrl.searchParams.get('where')).toBe("portid='chokepoint6'");
    expect(parsedUrl.searchParams.get('resultRecordCount')).toBe('30');
    expect(parsedUrl.searchParams.get('returnGeometry')).toBe('false');
    expect((init as RequestInit & { next: { revalidate: number } }).next.revalidate).toBe(3600);
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps an empty valid feature list distinct from an upstream failure', async () => {
    fetchMock.mockResolvedValue(response({ features: [] }));
    await expect(fetchPortWatch('suez', fetchMock, NOW)).resolves.toMatchObject({
      status: 'empty', rows: [], latestSourceDate: null, sourceLagDays: null,
    });

    fetchMock.mockResolvedValue(response({ error: { code: 400, message: 'bad query' } }));
    await expect(fetchPortWatch('suez', fetchMock, NOW)).rejects.toThrow('reported a query error');
  });

  it('marks old source dates stale and keeps their observed lag', async () => {
    fetchMock.mockResolvedValue(response({ features: [feature('2026-08-20')] }));

    await expect(fetchPortWatch('babel_mandeb', fetchMock, NOW)).resolves.toMatchObject({
      latestSourceDate: '2026-08-20', sourceLagDays: 43, stale: true,
    });
  });

  it('rejects duplicate dates and internally inconsistent totals', async () => {
    fetchMock.mockResolvedValue(response({ features: [feature(), feature()] }));
    await expect(fetchPortWatch('hormuz', fetchMock, NOW)).rejects.toThrow('duplicate dates');

    fetchMock.mockResolvedValue(response({ features: [feature('2026-09-27', { n_total: 1 })] }));
    await expect(fetchPortWatch('hormuz', fetchMock, NOW)).rejects.toThrow('inconsistent total counts');
  });

  it.each([
    ['null count', { n_tanker: null }],
    ['fractional count', { n_tanker: 1.5 }],
    ['negative count', { n_tanker: -1 }],
    ['infinite count', { n_tanker: Number.POSITIVE_INFINITY }],
  ])('rejects %s instead of coercing it to zero', async (_label, overrides) => {
    fetchMock.mockResolvedValue(response({ features: [feature('2026-09-27', overrides)] }));
    await expect(fetchPortWatch('hormuz', fetchMock, NOW)).rejects.toThrow('invalid n_tanker count');
  });

  it.each(['2026-02-30', '2026-10-03', null])('rejects malformed or future source date %s', async (date) => {
    fetchMock.mockResolvedValue(response({ features: [feature(date as string)] }));
    await expect(fetchPortWatch('hormuz', fetchMock, NOW)).rejects.toThrow('invalid source date');
  });

  it('rejects malformed feature sets, oversized bodies, and non-success HTTP responses', async () => {
    fetchMock.mockResolvedValue(response({ notFeatures: [] }));
    await expect(fetchPortWatch('hormuz', fetchMock, NOW)).rejects.toThrow('no feature list');

    fetchMock.mockResolvedValue(new Response(' '.repeat(256 * 1024 + 1)));
    await expect(fetchPortWatch('hormuz', fetchMock, NOW)).rejects.toThrow('exceeded the size limit');

    fetchMock.mockResolvedValue(response({}, 503));
    await expect(fetchPortWatch('hormuz', fetchMock, NOW)).rejects.toThrow('HTTP 503');
  });
});
