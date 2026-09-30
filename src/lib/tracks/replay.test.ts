import { describe, expect, it } from 'vitest';
import { ReplayModel } from './replay';
import { encodeSeries } from './codec';
import type { TrackPayload } from './types';

const T0 = 1000;
// Eastbound at 12 kn (0.2 nm/min) from t=1000 to t=1120, 5-min samples; silent 1040–1080.
const east = Array.from({ length: 25 }, (_, k) => [T0 + k * 5, 25, 56 + (0.2 * k * 5) / 60 / Math.cos((25 * Math.PI) / 180)] as [number, number, number]);
const still: [number, number, number][] = [[T0, 25.5, 56.2], [T0 + 60, 25.5, 56.2], [T0 + 120, 25.5, 56.2]];
const resp = { generatedAt: '', from: T0, to: T0 + 120, vessels: [{ m: 'a', h: encodeSeries(east), g: [1040, 1080] }, { m: 'b', h: encodeSeries(still), g: [] }] };
const live = (over: Partial<TrackPayload>): TrackPayload => ({ mmsi: 'a', tier: 0, score: 80, parts: [1, 1, 1, 1, 1], state: 'underway', sog: 12, cog: 90, lastRealAt: 1120,
  method: 'hybrid', tau: null, uncert: 0.03, path: null, trail: null, cleaning: { kept: 1, rejected: 0, inland: 0, rerouted: 0 }, ...over });

describe('ReplayModel', () => {
  const model = new ReplayModel(resp, new Map([['a', live({ path: encodeSeries([[1120, 25, east[24][2]], [1180, 25, east[24][2] + 0.2]]) })]]));

  it('plays a moving ship smoothly along its history and marks silences as estimated', () => {
    const s1 = model.sample('a', 1012)!, s2 = model.sample('a', 1013)!;
    expect(s1.moving).toBe(true);
    expect(s1.estimated).toBe(false);
    expect(s2.lon).toBeGreaterThan(s1.lon);
    expect(s1.heading).toBeCloseTo(0, 1);                          // due east
    const inGap = model.sample('a', 1060)!;
    expect(inGap.estimated).toBe(true);
    expect(inGap.age).toBe(20);
  });

  it('continues past the last fix on the live estimated path, then stops', () => {
    const past = model.sample('a', 1150)!;
    expect(past.estimated).toBe(true);
    expect(past.lon).toBeGreaterThan(east[24][2]);
    expect(model.pathAhead('a', 1150, 20, 5).length).toBeGreaterThan(2);
    expect(model.pathAhead('a', 1050, 20, 5)).toEqual([]);        // no dashed path inside history
  });

  it('keeps a still ship at rest, hides ships before they were first seen, and pings when data resumes', () => {
    expect(model.sample('b', 1090)!.moving).toBe(false);
    expect(model.sample('a', 990)).toBeNull();
    expect(model.resumedBetween(1070, 1085)).toEqual(['a']);
    expect(model.resumedBetween(1085, 1100)).toEqual([]);
  });

  it('draws the hour behind a ship, flagging the silent stretch', () => {
    const trail = model.trailBehind('a', 1090);
    expect(trail.length).toBe(21);
    expect(trail.some((p) => p.estimated)).toBe(true);
    expect(trail.some((p) => !p.estimated)).toBe(true);
  });

  it('hides a ship through a jump in its data instead of sliding it across land, and breaks its wake', () => {
    const m = new ReplayModel({ ...resp, vessels: [{ m: 'a', h: encodeSeries(east), g: [], j: [1050, 1060] }] }, new Map());
    expect(m.sample('a', 1055)).toBeNull();
    expect(m.sample('a', 1065)).not.toBeNull();
    const trail = m.trailBehind('a', 1080);
    expect(trail.length).toBe(7);                                   // only the stretch after the jump
    expect(m.resumedBetween(1055, 1062)).toEqual(['a']);
  });
});
