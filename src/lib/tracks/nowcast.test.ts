import { describe, expect, it } from 'vitest';
import { Nowcaster } from './nowcast';
import { encodeSeries } from './codec';
import type { TrackPayload } from './types';

const base = (lastRealAt: number, lon0: number, knEast: number, over: Partial<TrackPayload> = {}): TrackPayload => {
  const pts: [number, number, number][] = [];
  for (let k = 0; k <= 60; k++) pts.push([lastRealAt + k * 6, 25, lon0 + (knEast * (k * 6)) / 60 / (60 * Math.cos((25 * Math.PI) / 180))]);
  return { mmsi: '1', tier: 0, score: 90, parts: [30, 25, 15, 15, 5], state: 'underway', sog: knEast, cog: 90, lastRealAt,
    method: 'hybrid', tau: null, uncert: 0.03, path: encodeSeries(pts), trail: null, cleaning: { kept: 1, rejected: 0, inland: 0, rerouted: 0 }, ...over };
};

describe('Nowcaster', () => {
  it('places a ship along its estimated path by wall-clock time', () => {
    const n = new Nowcaster(); n.ingest([base(1000, 57, 12)], 1000);
    const a = n.sample('1', 1030)!;
    expect(a.lon).toBeGreaterThan(57);
    expect(a.estimated).toBe(true);
    expect(n.sample('1', 1005)!.estimated).toBe(false);
  });

  it('corrects onto new data without a velocity jump (smoothness gate)', () => {
    const n = new Nowcaster();
    n.ingest([base(1000, 57, 12)], 1000);
    // new data lands at t=1020: the ship is 1.5 nm further north, slower, and turning ~40° to the northeast
    n.ingest([base(1018, 57.05, 8, { path: encodeSeries(Array.from({ length: 61 }, (_, k) => [1018 + k * 6, 25.025 + 0.012 * k, 57.05 + (8 * (k * 6)) / 60 / (60 * Math.cos((25 * Math.PI) / 180))])) })], 1020);
    const dt = 0.1, K = Math.cos((25 * Math.PI) / 180);
    let p0 = n.sample('1', 1019.8)!, p1 = n.sample('1', 1019.9)!, maxAcc = 0, maxTurn = 0, h1 = p1.heading;
    for (let t = 1020; t <= 1100; t += dt) {
      const p = n.sample('1', t, true)!;
      const ax = ((p.lon - 2 * p1.lon + p0.lon) * 60 * K), ay = (p.lat - 2 * p1.lat + p0.lat) * 60;
      maxAcc = Math.max(maxAcc, Math.hypot(ax, ay) / (dt / 60) ** 2);
      let d = Math.abs(p.heading - h1); if (d > Math.PI) d = 2 * Math.PI - d;
      maxTurn = Math.max(maxTurn, (d * 180) / Math.PI / dt);
      h1 = p.heading; p0 = p1; p1 = p;
    }
    expect(maxAcc).toBeLessThan(400);     // nm/h² — the playback harness threshold
    expect(maxTurn).toBeLessThan(25);     // ° per map-minute
  });

  it('decelerates to a halt at the end of an estimate instead of stopping dead', () => {
    const n = new Nowcaster(); n.ingest([base(1000, 57, 12)], 1000);
    const end = 1000 + 360, a = n.sample('1', end - 1)!, b = n.sample('1', end - 0.5)!;
    expect(Math.abs(b.lon - a.lon)).toBeLessThan(0.0005);
  });
});
