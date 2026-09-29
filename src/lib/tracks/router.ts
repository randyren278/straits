/**
 * A* over the 0.02° water grid. Coastal cells cost 2.5×; learned lane density makes
 * busy water cheaper. String-pulling removes grid zig-zags (straights ≤ 6 nm so lane
 * bends survive), then Chaikin corner-cutting is kept only while it stays in water.
 */
import { GRID_RES } from './constants';
import { cellCenter, cellOf, grid, isLand, nearestWater } from './land';
import { hermite, polyline, type Kin } from './curve';
import type { Smoothed } from './kalman';
import { nmBetween, toLat, toLon, toX, toY, type Proj } from './proj';

export type Density = Float32Array;

export function clearPath(lon1: number, lat1: number, lon2: number, lat2: number): boolean {
  const n = Math.max(1, Math.ceil(nmBetween(lon1, lat1, lon2, lat2) / 0.2));
  for (let k = 1; k <= n; k++) if (isLand(lon1 + ((lon2 - lon1) * k) / n, lat1 + ((lat2 - lat1) * k) / n)) return false;
  return true;
}

export function route(lon1: number, lat1: number, lon2: number, lat2: number, density: Density | null): [number, number][] | null {
  const s = nearestWater(...cellOf(lon1, lat1)), g = nearestWater(...cellOf(lon2, lat2));
  if (!s || !g) return null;
  const { w: GW, water, coast } = grid;
  let maxD = 1;
  if (density) for (let i = 0; i < density.length; i++) if (density[i] > maxD) maxD = density[i];
  const cost = (i: number) => (coast[i] ? 2.5 : 1) / (density ? 1 + 0.6 * Math.log1p(density[i]) : 1);
  const hmin = density ? 1 / (1 + 0.6 * Math.log1p(maxD)) : 1;
  const pad = 30;
  const c0 = Math.max(0, Math.min(s[0], g[0]) - pad), c1 = Math.min(grid.w - 1, Math.max(s[0], g[0]) + pad);
  const r0 = Math.max(0, Math.min(s[1], g[1]) - pad), r1 = Math.min(grid.h - 1, Math.max(s[1], g[1]) + pad);
  const ww = c1 - c0 + 1, n = ww * (r1 - r0 + 1);
  const gs = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const cellNm = 60 / GRID_RES, kAt = (r: number) => Math.cos((cellCenter(0, r)[1] * Math.PI) / 180);
  const H = (c: number, r: number) => Math.hypot((c - g[0]) * cellNm * kAt(r), (r - g[1]) * cellNm) * hmin;
  const hf: number[] = [], hi: number[] = [];
  const push = (f: number, i: number) => {
    hf.push(f); hi.push(i); let k = hf.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; [hf[p], hf[k]] = [hf[k], hf[p]]; [hi[p], hi[k]] = [hi[k], hi[p]]; k = p; }
  };
  const pop = () => {
    const top = hi[0], lf = hf.pop()!, li = hi.pop()!;
    if (hf.length) {
      hf[0] = lf; hi[0] = li; let k = 0;
      for (;;) {
        const l = 2 * k + 1, rr = l + 1; let m = k;
        if (l < hf.length && hf[l] < hf[m]) m = l;
        if (rr < hf.length && hf[rr] < hf[m]) m = rr;
        if (m === k) break;
        [hf[m], hf[k]] = [hf[k], hf[m]]; [hi[m], hi[k]] = [hi[k], hi[m]]; k = m;
      }
    }
    return top;
  };
  const li = (c: number, r: number) => (r - r0) * ww + (c - c0);
  const si = li(s[0], s[1]), gi = li(g[0], g[1]);
  gs[si] = 0; push(H(s[0], s[1]), si);
  let found = false, expanded = 0;
  while (hf.length) {
    const cur = pop(); if (closed[cur]) continue; closed[cur] = 1;
    if (cur === gi) { found = true; break; }
    if (++expanded > 60000) break;
    const cc = (cur % ww) + c0, cr = Math.floor(cur / ww) + r0, k = kAt(cr);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if (!a && !b) continue;
      const nc = cc + b, nr = cr + a;
      if (nc < c0 || nc > c1 || nr < r0 || nr > r1) continue;
      const g2 = nr * GW + nc; if (!water[g2]) continue;
      if (a && b && (!water[cr * GW + nc] || !water[nr * GW + cc])) continue;
      const ni = li(nc, nr); if (closed[ni]) continue;
      const ng = gs[cur] + Math.hypot(b * cellNm * k, a * cellNm) * cost(g2);
      if (ng < gs[ni]) { gs[ni] = ng; from[ni] = cur; push(ng + H(nc, nr), ni); }
    }
  }
  if (!found) return null;
  const cells: number[] = [];
  for (let k = gi; k !== -1; k = from[k]) cells.push(k);
  cells.reverse();
  const pts = cells.map((k) => cellCenter((k % ww) + c0, Math.floor(k / ww) + r0));
  pts[0] = [lon1, lat1];
  if (!isLand(lon2, lat2)) pts[pts.length - 1] = [lon2, lat2];
  const pulled: [number, number][] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = i + 1;
    for (let k = pts.length - 1; k > i + 1; k--) {
      if (nmBetween(pts[i][0], pts[i][1], pts[k][0], pts[k][1]) > 6) continue;
      if (clearPath(pts[i][0], pts[i][1], pts[k][0], pts[k][1])) { j = k; break; }
    }
    pulled.push(pts[j]); i = j;
  }
  let sm = pulled;
  for (let it = 0; it < 3; it++) {
    const out: [number, number][] = [sm[0]];
    for (let k = 0; k < sm.length - 1; k++) {
      const p = sm[k], q = sm[k + 1];
      out.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
    }
    out.push(sm[sm.length - 1]);
    let ok = true;
    for (let k = 1; k < out.length - 2 && ok; k++) ok = clearPath(out[k][0], out[k][1], out[k + 1][0], out[k + 1][1]);
    if (!ok) break;
    sm = out;
  }
  return sm;
}

/** Replace history segments whose curve touches land (away from their ends) with sea routes. */
export function repairLand(s: Smoothed, proj: Proj, density: Density | null): number {
  const q: Kin = { x: 0, y: 0, vx: 0, vy: 0 };
  let added = 0;
  for (let a = 0; a < s.n - 1; a++) {
    const steps = Math.max(4, Math.ceil(Math.hypot(s.x[a + 1] - s.x[a], s.y[a + 1] - s.y[a]) / 0.25));
    let hit = false;
    for (let k = 1; k < steps && !hit; k++) {
      hermite(s, s.t[a] + ((s.t[a + 1] - s.t[a]) * k) / steps, q);
      const nearEnd = Math.min(Math.hypot(q.x - s.x[a], q.y - s.y[a]), Math.hypot(q.x - s.x[a + 1], q.y - s.y[a + 1])) < 0.6;
      hit = !nearEnd && isLand(toLon(proj, q.x), toLat(q.y));
    }
    if (!hit) continue;
    const p = route(toLon(proj, s.x[a]), toLat(s.y[a]), toLon(proj, s.x[a + 1]), toLat(s.y[a + 1]), density);
    const pts = p ? p.map(([lo, la]) => ({ x: toX(proj, lo), y: toY(la) })) : [{ x: s.x[a], y: s.y[a] }, { x: s.x[a + 1], y: s.y[a + 1] }];
    (s.detour ??= {})[a] = polyline(pts);
    added++;
  }
  return added;
}

