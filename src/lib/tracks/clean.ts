/** Stage 1: turn raw scraped fixes into trustworthy measurements. */
import { CONFIRM_NM, DWELL_MIN, JITTER_NM, TELEPORT_KN } from './constants';
import { deepInland } from './land';
import { toLat, toLon, toX, toY, type Proj, type TPt } from './proj';

export interface RawFix { t: number; lon: number; lat: number }
export interface Run { t0: number; t1: number; x: number; y: number; n: number }
export interface Cleaned { meas: TPt[]; rejected: number; moves: number; jitter: number; inland: number }

/** Collapse identical consecutive fixes (the feed repeats stale positions). */
export function runsOf(fixes: RawFix[], proj: Proj, tMax = Infinity): Run[] {
  const runs: Run[] = [];
  for (const f of fixes) {
    if (f.t > tMax) break;
    const x = toX(proj, f.lon), y = toY(f.lat), last = runs[runs.length - 1];
    if (last && last.x === x && last.y === y) { last.t1 = f.t; last.n++; }
    else runs.push({ t0: f.t, t1: f.t, x, y, n: 1 });
  }
  return runs;
}

export function clean(runs: Run[], proj: Proj): Cleaned {
  const meas: TPt[] = [];
  let rejected = 0, moves = 0, jitter = 0, inland = 0;
  let quarantine: TPt | null = null, dwellEnd = -Infinity, prevEnd: number | null = null;
  for (const r of runs) {
    // Fixes are stamped with fetch time; the report happened between the last fetch that
    // still showed the old position and this one — take the midpoint.
    const tEst = prevEnd === null ? r.t0 : (prevEnd + r.t0) / 2;
    prevEnd = r.t1;
    if (deepInland(toLon(proj, r.x), toLat(r.y))) { inland++; rejected++; continue; }
    if (!meas.length) { meas.push({ t: tEst, x: r.x, y: r.y }); dwellEnd = r.t1; continue; }
    const last = meas[meas.length - 1];
    const d = Math.hypot(r.x - last.x, r.y - last.y);
    const v = d / (Math.max(1, tEst - last.t) / 60);
    if (d < JITTER_NM) { jitter++; dwellEnd = r.t1; continue; }
    if (v > TELEPORT_KN) {
      if (quarantine && Math.hypot(r.x - quarantine.x, r.y - quarantine.y) < CONFIRM_NM) {
        meas.push(quarantine, { t: tEst, x: r.x, y: r.y });
        moves += 2; rejected--; quarantine = null; dwellEnd = r.t1; continue;
      }
      quarantine = { t: tEst, x: r.x, y: r.y }; rejected++; continue;
    }
    quarantine = null;
    if (dwellEnd - last.t >= DWELL_MIN) meas.push({ t: dwellEnd, x: last.x, y: last.y });
    meas.push({ t: tEst, x: r.x, y: r.y }); moves++; dwellEnd = r.t1;
  }
  if (meas.length) {
    const last = meas[meas.length - 1];
    if (dwellEnd - last.t >= DWELL_MIN) meas.push({ t: dwellEnd, x: last.x, y: last.y });
  }
  return { meas, rejected, moves, jitter, inland };
}
