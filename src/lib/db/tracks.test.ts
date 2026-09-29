import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./index', () => ({ pool: { query: vi.fn() } }));
import { pool } from './index';
import { getTracks, loadEngineVessels, saveEngineRun } from './tracks';
import { emptyLearnState } from '../tracks/learn';

const q = pool.query as ReturnType<typeof vi.fn>;
beforeEach(() => vi.clearAllMocks());

describe('track storage', () => {
  it('groups 24 h of fixes per vessel with identity flags, ordered by time', async () => {
    q.mockResolvedValueOnce({ rows: [
      { mmsi: '1', t: '2026-09-30T00:00:00Z', latitude: 25, longitude: 56, name: 'A', ship_type: 80, flag: 'PA', imo: '9', destination: null },
      { mmsi: '1', t: '2026-09-30T00:10:00Z', latitude: 25.01, longitude: 56, name: 'A', ship_type: 80, flag: 'PA', imo: '9', destination: null },
    ] });
    const vs = await loadEngineVessels();
    expect(vs).toHaveLength(1);
    expect(vs[0].fixes).toHaveLength(2);
    expect(vs[0].fixes[1].t - vs[0].fixes[0].t).toBe(10);
    expect(vs[0].identity).toEqual({ name: true, type: true, flag: true, imoOrDest: true });
  });

  it('saves all payloads in one statement and the learning state in another', async () => {
    q.mockResolvedValue({ rows: [] });
    await saveEngineRun([{ mmsi: '1' } as never], emptyLearnState(), { backtest: null, learned: null });
    const sqls = q.mock.calls.map((c) => String(c[0]));
    expect(sqls.filter((s) => s.includes('vessel_track_state'))).toHaveLength(2);   // upsert + prune
    expect(sqls.some((s) => s.includes('track_engine_state'))).toBe(true);
  });

  it('serves recent payloads with the run summary', async () => {
    q.mockResolvedValueOnce({ rows: [{ payload: { mmsi: '1' } }] })
      .mockResolvedValueOnce({ rows: [{ value: { backtest: { n: 3, hold: 4, estimate: 1.5 }, learned: null, generatedAt: 'x' } }] });
    const r = await getTracks();
    expect(r.vessels).toEqual([{ mmsi: '1' }]);
    expect(r.backtest?.estimate).toBe(1.5);
  });
});
