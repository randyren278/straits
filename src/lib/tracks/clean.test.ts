import { describe, expect, it } from 'vitest';
import { clean, runsOf, type RawFix } from './clean';
import { projAt } from './proj';

const P = projAt(25.3);
const LON = 56.6, LAT = 25.3;                 // open water off Fujairah
const nmLon = (nm: number) => nm / (60 * P.k);
const fix = (min: number, dxNm = 0, dyNm = 0): RawFix => ({ t: min, lon: LON + nmLon(dxNm), lat: LAT + dyNm / 60 });

describe('clean', () => {
  it('collapses repeated positions into runs', () => {
    const runs = runsOf([fix(0), fix(10), fix(20), fix(30, 2)], P);
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ t0: 0, t1: 20, n: 3 });
  });

  it('stamps a change at the midpoint between the last old sighting and the new one', () => {
    const { meas } = clean(runsOf([fix(0), fix(10), fix(20, 2)], P), P);
    expect(meas[1].t).toBe(15);
  });

  it('holds jitter under 0.1 nm as dwelling, not motion', () => {
    const c = clean(runsOf([fix(0), fix(10, 0.05), fix(20, 0.02, 0.03)], P), P);
    expect(c.jitter).toBe(2);
    expect(c.moves).toBe(0);
  });

  it('quarantines a teleport and accepts it once the next fix confirms it', () => {
    const rejected = clean(runsOf([fix(0), fix(10, 1), fix(20, 30), fix(30, 1.5)], P), P);
    expect(rejected.rejected).toBe(1);
    const confirmed = clean(runsOf([fix(0), fix(10, 1), fix(20, 30), fix(30, 30.3)], P), P);
    expect(confirmed.rejected).toBe(0);
    expect(confirmed.meas.at(-1)!.x).toBeGreaterThan(confirmed.meas[0].x + 25);
  });

  it('adds a stationary measurement after a dwell of 25+ minutes', () => {
    const { meas } = clean(runsOf([fix(0), fix(10, 2), fix(20, 2), fix(40, 2)], P), P);
    expect(meas.at(-1)!.t).toBe(40);
    expect(meas.at(-1)!.x).toBeCloseTo(meas.at(-2)!.x);
  });

  it('rejects fixes deep inland as GPS interference', () => {
    const inland: RawFix = { t: 10, lon: 57.0, lat: 23.0 };
    const c = clean(runsOf([fix(0), inland, fix(20, 1)], P), P);
    expect(c.inland).toBe(1);
  });
});
