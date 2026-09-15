import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./index', () => ({ pool: { query: vi.fn() } }));

import { pool } from './index';
import { loadSuezTracks, upsertChokepointDaily, getChokepointDaily } from './crossings';

const query = vi.mocked(pool.query);

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue({ rows: [] } as never);
});

describe('loadSuezTracks', () => {
  it('groups ordered rows by MMSI and bounds the query to the Suez box', async () => {
    query.mockResolvedValueOnce({ rows: [
      { mmsi: 'a', time: new Date('2026-09-12T00:00:00Z'), latitude: 31.3, longitude: 32.33 },
      { mmsi: 'a', time: new Date('2026-09-12T04:00:00Z'), latitude: 30.6, longitude: 32.33 },
      { mmsi: 'b', time: new Date('2026-09-12T01:00:00Z'), latitude: 29.95, longitude: 32.55 },
    ] } as never);
    const since = new Date('2026-09-08T00:00:00Z');
    const until = new Date('2026-09-15T03:00:00Z');
    const tracks = await loadSuezTracks(since, until);
    expect([...tracks.keys()]).toEqual(['a', 'b']);
    expect(tracks.get('a')).toHaveLength(2);
    expect(query.mock.calls[0][1]).toEqual([since, until, 29.5, 32.5, 31.5, 33]);
  });
});

describe('upsertChokepointDaily', () => {
  it('writes nothing for an empty list', async () => {
    expect(await upsertChokepointDaily('suez', [])).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('upserts all days in one statement keyed on (chokepoint, day)', async () => {
    const n = await upsertChokepointDaily('suez', [
      { day: '2026-09-12', northbound: 3, southbound: 2, waiting: 1, incomplete: 0, distinctMmsi: 6 },
      { day: '2026-09-13', northbound: 1, southbound: 4, waiting: 0, incomplete: 2, distinctMmsi: 7 },
    ]);
    expect(n).toBe(2);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (chokepoint, day) DO UPDATE');
    expect(params).toEqual(['suez', '2026-09-12', 3, 2, 1, 0, 6, 'suez', '2026-09-13', 1, 4, 0, 2, 7]);
  });
});

describe('getChokepointDaily', () => {
  it('maps rows to camelCase with ISO computed_at', async () => {
    query.mockResolvedValueOnce({ rows: [
      { day: '2026-09-12', northbound: 3, southbound: 2, waiting: 1, incomplete: 0, distinct_mmsi: 6, computed_at: new Date('2026-09-15T03:00:00Z') },
    ] } as never);
    const rows = await getChokepointDaily('suez', 7);
    expect(rows).toEqual([{ day: '2026-09-12', northbound: 3, southbound: 2, waiting: 1, incomplete: 0, distinctMmsi: 6, computedAt: '2026-09-15T03:00:00.000Z' }]);
    expect(query.mock.calls[0][1]).toEqual(['suez', '7']);
  });
});
