import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { clearJsonSnapshots, fetchCachedJson } from './cached-json';

beforeEach(() => {
  clearJsonSnapshots();
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const response = (data: unknown, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => data });

describe('public JSON snapshots', () => {
  it('reuses a recent result, separates filters, and refetches after expiry', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ rows: [1] }));
    vi.stubGlobal('fetch', fetcher);
    await fetchCachedJson('/api/history?range=30d');
    expect(await fetchCachedJson('/api/history?range=30d')).toEqual({ rows: [1] });
    await fetchCachedJson('/api/history?range=90d');
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(30_000);
    await fetchCachedJson('/api/history?range=30d');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('shares a fetch without letting one cancelled consumer cancel another', async () => {
    let resolve!: (data: ReturnType<typeof response>) => void;
    const fetcher = vi.fn(() => new Promise<ReturnType<typeof response>>(r => { resolve = r; }));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    const a = fetchCachedJson('/api/shared', { signal: controller.signal });
    const b = fetchCachedJson('/api/shared');
    const rejected = expect(a).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    expect(fetcher.mock.calls).toHaveLength(1);
    resolve(response({ complete: true }));
    await rejected;
    expect(await b).toEqual({ complete: true });
    expect(await fetchCachedJson('/api/shared')).toEqual({ complete: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aborts unused network work and does not cache its late response', async () => {
    let resolve!: (data: ReturnType<typeof response>) => void;
    const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise<ReturnType<typeof response>>(r => { resolve = r; }));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    const pending = fetchCachedJson('/api/cancelled', { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    expect(fetcher.mock.calls[0][1].signal?.aborted).toBe(true);
    resolve(response({ obsolete: true }));
    await rejected;
    await Promise.resolve();
    fetcher.mockResolvedValue(response({ current: true }));
    expect(await fetchCachedJson('/api/cancelled')).toEqual({ current: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('never caches errors', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ error: 'Unavailable' }, false)).mockResolvedValue(response({ ok: true }));
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchCachedJson('/api/retry')).rejects.toThrow('Unavailable');
    expect(await fetchCachedJson('/api/retry')).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('bounds retained snapshots and keeps recently used entries', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ ok: true }));
    vi.stubGlobal('fetch', fetcher);
    for (let i = 0; i < 64; i++) await fetchCachedJson(`/api/entry/${i}`);
    await fetchCachedJson('/api/entry/0');
    await fetchCachedJson('/api/entry/64');
    await fetchCachedJson('/api/entry/0');
    expect(fetcher).toHaveBeenCalledTimes(65);
    await fetchCachedJson('/api/entry/1');
    expect(fetcher).toHaveBeenCalledTimes(66);
  });
});
