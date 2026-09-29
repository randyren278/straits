/** Stage 4: carry a ship forward from its last smoothed state. Samples every 2 minutes. */
import { MAX_KN, MIN_EST_KN } from './constants';
import type { Cleaned } from './clean';
import { along, pathAt, polyline } from './curve';
import type { Smoothed } from './kalman';
import { cellOf, grid, inGrid, isLand } from './land';
import { toLat, toLon, toX, toY, type Proj, type TPt } from './proj';
import { route, type Density } from './router';

export interface VesselState { t: number; x: number; y: number; vx: number; vy: number; spd: number; proj: Proj }
export type Method = 'hybrid' | 'sea' | 'damped';

export function stateOf(s: Smoothed, proj: Proj): VesselState {
  const L = s.n - 1;
  return { t: s.t[L], x: s.x[L], y: s.y[L], vx: s.vx[L], vy: s.vy[L], spd: Math.hypot(s.vx[L], s.vy[L]), proj };
}
export const heading = (st: { vx: number; vy: number }) => Math.atan2(st.vy, st.vx);

/** A sane smoothed speed backed by a real move shortly before the last fix. */
export function canEstimate(cl: Cleaned, st: VesselState): boolean {
  return st.spd >= MIN_EST_KN && st.spd <= MAX_KN &&
    cl.meas.some((m, k) => k > 0 && m.t >= st.t - 90 && Math.hypot(m.x - cl.meas[k - 1].x, m.y - cl.meas[k - 1].y) > 0.3);
}

const landAt = (st: VesselState, x: number, y: number) => isLand(toLon(st.proj, x), toLat(y));

function straightFrom(st: VesselState, minutes: number): TPt[] {
  let x = st.x, y = st.y;
  const ux = st.vx / st.spd, uy = st.vy / st.spd, pts: TPt[] = [{ t: st.t, x, y }];
  for (let t = st.t + 2; t <= st.t + minutes; t += 2) {
    const nx = x + (ux * st.spd) / 30, ny = y + (uy * st.spd) / 30;
    if (landAt(st, nx, ny)) break;
    x = nx; y = ny; pts.push({ t, x, y });
  }
  return pts;
}

/** Sea route from a point on a heading toward the most lane-like open water ahead. */
function seaFrom(st: VesselState, x0: number, y0: number, t0: number, h: number, minutes: number, density: Density | null): TPt[] | null {
  const dist = (st.spd * minutes) / 60;
  let best: { gx: number; gy: number; score: number } | null = null;
  for (const frac of [1, 0.6, 0.35]) {
    for (const off of [0, 10, -10, 20, -20, 35, -35, 55, -55, 80, -80]) {
      const a = h + (off * Math.PI) / 180, gx = x0 + Math.cos(a) * dist * frac, gy = y0 + Math.sin(a) * dist * frac;
      const [c, r] = cellOf(toLon(st.proj, gx), toLat(gy));
      if (!inGrid(c, r) || !grid.water[r * grid.w + c]) continue;
      let lane = 0;
      if (density) for (let da = -2; da <= 2; da++) for (let db = -2; db <= 2; db++) { const cc = c + db, rr = r + da; if (inGrid(cc, rr)) lane += density[rr * grid.w + cc]; }
      const score = Math.cos((off * Math.PI) / 180) * 3 + Math.log1p(lane) * 0.6;
      if (!best || score > best.score) best = { gx, gy, score };
    }
    if (best) break;
  }
  if (!best) return null;
  const p = route(toLon(st.proj, x0), toLat(y0), toLon(st.proj, best.gx), toLat(best.gy), density);
  if (!p) return null;
  const pl = polyline(p.map(([lo, la]) => ({ x: toX(st.proj, lo), y: toY(la) })));
  const out: TPt[] = [{ t: t0, x: x0, y: y0 }], q = { x: 0, y: 0, ux: 0, uy: 0 };
  for (let t = t0 + 2; t <= t0 + minutes; t += 2) {
    const d = (st.spd * (t - t0)) / 60; if (d > pl.len) break;
    along(pl, d, q); out.push({ t, x: q.x, y: q.y });
  }
  return out;
}

/** Straight while the water ahead is open; ~20 min before landfall, bend through open water. */
function hybridFrom(st: VesselState, minutes: number, density: Density | null): TPt[] {
  const dr = straightFrom(st, minutes), full = Math.floor(minutes / 2) + 1;
  if (dr.length >= full) return dr;
  const keep = Math.max(0, dr.length - 1 - 10), p0 = dr[keep];
  const rest = seaFrom(st, p0.x, p0.y, p0.t, heading(st), st.t + minutes - p0.t, density);
  return rest && rest.length > 1 ? dr.slice(0, keep + 1).concat(rest.slice(1)) : dr;
}

/** Same water-aware geometry, but speed decays: distance = v0·tau·(1 − e^(−Δt/tau)). */
function dampedFrom(st: VesselState, minutes: number, density: Density | null, tau: number): TPt[] {
  const geo = hybridFrom(st, minutes, density);
  if (geo.length < 2) return geo;
  const out: TPt[] = [{ t: st.t, x: st.x, y: st.y }], q = { x: 0, y: 0 };
  for (let t = st.t + 2; t <= st.t + minutes; t += 2) {
    const dist = st.spd * (tau / 60) * (1 - Math.exp(-(t - st.t) / tau));
    const tp = st.t + (dist / st.spd) * 60;
    if (tp >= geo[geo.length - 1].t) break;
    pathAt(geo, tp, q); out.push({ t, x: q.x, y: q.y });
  }
  return out;
}

export function predictWith(m: Method, st: VesselState, minutes: number, density: Density | null, tau: number): TPt[] {
  if (m === 'sea') return seaFrom(st, st.x, st.y, st.t, heading(st), minutes, density) ?? hybridFrom(st, minutes, density);
  if (m === 'damped') return dampedFrom(st, minutes, density, tau);
  return hybridFrom(st, minutes, density);
}
