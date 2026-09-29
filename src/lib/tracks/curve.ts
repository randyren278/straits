/** History and estimate curves in a vessel's nm frame. */
import type { Smoothed } from './kalman';
import type { TPt } from './proj';

export interface Polyline { pts: { x: number; y: number }[]; cum: number[]; len: number }
export interface Kin { x: number; y: number; vx: number; vy: number }

export function polyline(pts: { x: number; y: number }[]): Polyline {
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
  return { pts, cum, len: cum[cum.length - 1] || 1e-6 };
}

export function along(pl: Polyline, d: number, o: { x: number; y: number; ux: number; uy: number }) {
  const P = pl.pts, C = pl.cum, L = P.length - 1;
  if (L === 0) { o.x = P[0].x; o.y = P[0].y; o.ux = 1; o.uy = 0; return o; }
  d = Math.max(0, Math.min(pl.len, d));
  let a = 0, b = L;
  while (b - a > 1) { const m = (a + b) >> 1; if (C[m] <= d) a = m; else b = m; }
  const seg = C[b] - C[a] || 1e-9, f = (d - C[a]) / seg;
  o.x = P[a].x + (P[b].x - P[a].x) * f; o.y = P[a].y + (P[b].y - P[a].y) * f;
  o.ux = (P[b].x - P[a].x) / seg; o.uy = (P[b].y - P[a].y) / seg;
  return o;
}

/**
 * Smoothed history at time t. Normal segments are cubic Hermite (continuous position and
 * velocity). Segments rerouted around land follow their sea route; relocation segments
 * (coverage jumps) are one steady smoothstep slide instead of a sprinting spline.
 */
export function hermite(s: Smoothed, t: number, o: Kin): Kin {
  if (t <= s.t[0]) { o.x = s.x[0]; o.y = s.y[0]; o.vx = 0; o.vy = 0; return o; }
  const L = s.n - 1;
  if (t >= s.t[L]) { o.x = s.x[L]; o.y = s.y[L]; o.vx = s.vx[L]; o.vy = s.vy[L]; return o; }
  let a = 0, b = L;
  while (b - a > 1) { const m = (a + b) >> 1; if (s.t[m] <= t) a = m; else b = m; }
  const u = (t - s.t[a]) / (s.t[b] - s.t[a]), h = (s.t[b] - s.t[a]) / 60;
  const detour = s.detour?.[a];
  if (detour) {
    const q = { x: 0, y: 0, ux: 0, uy: 0 };
    along(detour, u * detour.len, q);
    const sp = detour.len / h;
    o.x = q.x; o.y = q.y; o.vx = q.ux * sp; o.vy = q.uy * sp; return o;
  }
  if (s.reloc[a]) {
    const w = u * u * (3 - 2 * u), dw = (6 * u * (1 - u)) / h;
    o.x = s.x[a] + (s.x[b] - s.x[a]) * w; o.y = s.y[a] + (s.y[b] - s.y[a]) * w;
    o.vx = (s.x[b] - s.x[a]) * dw; o.vy = (s.y[b] - s.y[a]) * dw; return o;
  }
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  o.x = h00 * s.x[a] + h10 * h * s.vx[a] + h01 * s.x[b] + h11 * h * s.vx[b];
  o.y = h00 * s.y[a] + h10 * h * s.vy[a] + h01 * s.y[b] + h11 * h * s.vy[b];
  const d00 = 6 * u2 - 6 * u, d10 = 3 * u2 - 4 * u + 1, d01 = -6 * u2 + 6 * u, d11 = 3 * u2 - 2 * u;
  o.vx = (d00 * s.x[a] + d10 * h * s.vx[a] + d01 * s.x[b] + d11 * h * s.vx[b]) / h;
  o.vy = (d00 * s.y[a] + d10 * h * s.vy[a] + d01 * s.y[b] + d11 * h * s.vy[b]) / h;
  return o;
}

/** Uniform Catmull-Rom through evenly spaced samples, with mirrored phantom end points. */
export function pathAt(pts: TPt[], t: number, o: { x: number; y: number }) {
  if (pts.length < 2 || t <= pts[0].t) { o.x = pts[0].x; o.y = pts[0].y; return o; }
  const L = pts.length - 1;
  if (t >= pts[L].t) { o.x = pts[L].x; o.y = pts[L].y; return o; }
  const step = pts[1].t - pts[0].t;
  const k = Math.min(L - 1, Math.floor((t - pts[0].t) / step)), f = (t - pts[k].t) / (pts[k + 1].t - pts[k].t);
  const p1 = pts[k], p2 = pts[k + 1];
  const p0 = k > 0 ? pts[k - 1] : { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
  const p3 = k + 2 <= L ? pts[k + 2] : { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
  const f2 = f * f, f3 = f2 * f;
  const cr = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);
  o.x = cr(p0.x, p1.x, p2.x, p3.x); o.y = cr(p0.y, p1.y, p2.y, p3.y);
  return o;
}
