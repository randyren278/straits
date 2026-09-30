import { describe, expect, it } from 'vitest';
import { runTrackEngine } from './engine';
import { emptyLearnState } from './learn';
import { grid, isLand } from './land';
import { decodeSeries } from './codec';

const NOW = 29_500_000;
const east = (mmsi: string, lon0: number, lat: number, kn: number, ids = true) => ({
  mmsi,
  fixes: Array.from({ length: 30 }, (_, k) => ({ t: NOW - 290 + k * 10, lon: lon0 + ((kn / 6) * k) / (60 * Math.cos((lat * Math.PI) / 180)), lat })),
  identity: { name: ids, type: ids, flag: ids, imoOrDest: ids },
});
const anchored = (mmsi: string) => ({
  mmsi, fixes: Array.from({ length: 30 }, (_, k) => ({ t: NOW - 290 + k * 10, lon: 56.45, lat: 25.3 })),
  identity: { name: true, type: true, flag: false, imoOrDest: false },
});

describe('runTrackEngine', () => {
  it('estimates underway ships, rests anchored ones, and never draws on land', () => {
    const out = runTrackEngine({ vessels: [east('1', 57.0, 24.9, 10), anchored('2')], now: NOW, density: new Float32Array(grid.w * grid.h), learn: emptyLearnState() });
    const [moving, rest] = out.payloads;
    expect(moving.state).toBe('underway');
    expect(moving.sog).toBeCloseTo(10, 0);
    expect(moving.path).not.toBeNull();
    for (const [, lat, lon] of decodeSeries(moving.path!)) expect(isLand(lon, lat)).toBe(false);
    expect(rest.state).toBe('rest');
    expect(rest.path).toBeNull();
    expect(out.backtest.n).toBeGreaterThan(0);
    expect(out.densityDelta.size).toBeGreaterThan(0);          // a first run seeds lanes from history
  });

  it('replays the day: a moving ship at 5-min steps, a still one thinned, silences marked as gaps', () => {
    const gappy = east('3', 56.9, 24.7, 12);
    gappy.fixes = gappy.fixes.filter((f) => f.t < NOW - 200 || f.t > NOW - 120);   // 80 min without a fix
    const out = runTrackEngine({ vessels: [east('1', 57.0, 24.9, 10), anchored('2'), gappy], now: NOW, density: new Float32Array(grid.w * grid.h), learn: emptyLearnState() });
    const [moving, still, gap] = out.replay.map((r) => ({ ...r, pts: decodeSeries(r.h) }));
    expect(moving.m).toBe('1');
    expect(moving.pts.length).toBeGreaterThan(50);                      // ~290 min at 5-min steps
    expect(moving.pts.at(-1)![0]).toBeGreaterThanOrEqual(NOW - 10);            // up to the last smoothed fix
    expect(still.pts.length).toBeLessThan(10);                          // hourly anchors, not 58 copies
    expect(moving.g).toEqual([]);
    expect(gap.g).toHaveLength(2);
    expect(gap.g[1] - gap.g[0]).toBeGreaterThan(60);
  });
});
