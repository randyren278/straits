import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./index', () => ({ pool: { query: vi.fn() } }));

import { pool } from './index';
import { upsertCollectionBuckets, getRecentBuckets, getChokepointQuality } from './coverage';
import type { CollectionBucketRow } from '../coverage/buckets';

const query = vi.mocked(pool.query);
const row = (i: number): CollectionBucketRow => ({
  region: 'hormuz', bucketStart: new Date('2026-09-15T02:40:00Z'), source: `s${i}`,
  messageCount: i, uniqueMmsi: i, latestFix: null, runId: 'r',
});

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue({ rows: [] } as never);
});

describe('upsertCollectionBuckets', () => {
  it('writes nothing for an empty list', async () => {
    expect(await upsertCollectionBuckets([])).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('uses one multi-row statement with ON CONFLICT for a small batch', async () => {
    await upsertCollectionBuckets([row(1), row(2), row(3)]);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (region, bucket_start, source)');
    expect(sql).toContain('message_count = collection_buckets.message_count + EXCLUDED.message_count');
    expect(params).toHaveLength(3 * 7);
  });

  it('chunks at 500 rows per statement', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => row(i));
    expect(await upsertCollectionBuckets(rows)).toBe(1001);
    expect(query).toHaveBeenCalledTimes(3);
    expect((query.mock.calls[0][1] as unknown[]).length).toBe(500 * 7);
    expect((query.mock.calls[2][1] as unknown[]).length).toBe(1 * 7);
  });
});

describe('getRecentBuckets', () => {
  it('maps rows and passes region + hours as parameters, not interpolated', async () => {
    query.mockResolvedValueOnce({ rows: [
      { bucket_start: new Date('2026-09-15T02:40:00Z'), message_count: 4, unique_mmsi: 3, latest_fix: null },
    ] } as never);
    const out = await getRecentBuckets('suez', 24);
    expect(out).toEqual([{ bucketStart: new Date('2026-09-15T02:40:00Z'), messageCount: 4, uniqueMmsi: 3, latestFix: null }]);
    expect(query.mock.calls[0][1]).toEqual(['suez', '24']);
  });
});

describe('getChokepointQuality', () => {
  it('returns one assessment per chokepoint, insufficient when there is no history', async () => {
    const out = await getChokepointQuality(new Date('2026-09-15T03:00:00Z'));
    expect(out.map((c) => c.id).sort()).toEqual(['babel_mandeb', 'gulf_of_aden', 'hormuz', 'suez']);
    expect(out.every((c) => c.quality === 'insufficient' && c.subscribed)).toBe(true);
    expect(out[0].basis).toHaveProperty('nonEmptyLast6h');
  });
});

describe('getCoverageHistory', () => {
  it('groups hourly rows per chokepoint and fills regions with no rows', async () => {
    const { getCoverageHistory } = await import('./coverage');
    query.mockResolvedValueOnce({ rows: [
      { region: 'suez', hour: new Date('2026-09-15T03:00:00Z'), messages: 40, unique: 226, aisstream: 15, fallback: 226, attempted: 6 },
    ] } as never);
    const out = await getCoverageHistory(24);
    expect(out.map((r) => r.id)).toEqual(['hormuz', 'babel_mandeb', 'suez', 'gulf_of_aden']);
    expect(out.find((r) => r.id === 'suez')!.hours).toEqual([
      { hour: '2026-09-15T03:00:00.000Z', messages: 40, unique: 226, aisstream: 15, fallback: 226, attempted: 6 },
    ]);
    expect(out.find((r) => r.id === 'hormuz')!.hours).toEqual([]);
    expect(query.mock.calls[0][1]).toEqual([['hormuz', 'babel_mandeb', 'suez', 'gulf_of_aden'], '24']);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/SUM\(unique_mmsi\) AS unique_all/);
    expect(sql).toMatch(/GROUP BY region, bucket_start/);
  });
});

describe('getRecentBuckets merges sources per bucket', () => {
  it('sums unique and message counts in SQL grouped by bucket_start', async () => {
    await getRecentBuckets('suez', 24);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/SUM\(unique_mmsi\)::int AS unique_mmsi/);
    expect(sql).toMatch(/GROUP BY bucket_start/);
  });
});
