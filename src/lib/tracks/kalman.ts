/** Stage 2: constant-velocity Kalman filter + RTS smoother, one axis at a time. */
import { KALMAN_Q as Q, KALMAN_R as R, MAX_KN } from './constants';
import type { TPt } from './proj';
import type { Polyline } from './curve';

export interface Smoothed {
  t: number[]; x: Float64Array; y: Float64Array; vx: Float64Array; vy: Float64Array; n: number;
  /** 1 where the hop to the next knot implies > MAX_KN: a coverage jump, not motion. */
  reloc: Uint8Array;
  /** Sea-route replacements for segments whose curve would cross land (Task 4). */
  detour: Record<number, Polyline> | null;
}

function smoothAxis(ts: number[], zs: number[]): { p: Float64Array; v: Float64Array } {
  const n = ts.length;
  const mp = new Float64Array(n), mv = new Float64Array(n);
  const Pa = new Float64Array(n), Pb = new Float64Array(n), Pc = new Float64Array(n);
  const pp = new Float64Array(n), pv = new Float64Array(n), Qa = new Float64Array(n), Qb = new Float64Array(n), Qc = new Float64Array(n);
  let p = zs[0], v = 0, a = R, b = 0, c = 100;
  for (let k = 0; k < n; k++) {
    if (k > 0) {
      const dt = (ts[k] - ts[k - 1]) / 60;
      const na = a + 2 * b * dt + c * dt * dt + (Q * dt * dt * dt) / 3, nb = b + c * dt + (Q * dt * dt) / 2, nc = c + Q * dt;
      p += v * dt; a = na; b = nb; c = nc;
    }
    pp[k] = p; pv[k] = v; Qa[k] = a; Qb[k] = b; Qc[k] = c;
    const S = a + R, k0 = a / S, k1 = b / S, innov = zs[k] - p;
    p += k0 * innov; v += k1 * innov;
    const ua = (1 - k0) * a, ub = (1 - k0) * b, uc = c - k1 * b; a = ua; b = ub; c = uc;
    mp[k] = p; mv[k] = v; Pa[k] = a; Pb[k] = b; Pc[k] = c;
  }
  const sp = Float64Array.from(mp), sv = Float64Array.from(mv);
  let sa = Pa[n - 1], sb = Pb[n - 1], sc = Pc[n - 1];
  for (let k = n - 2; k >= 0; k--) {
    const dt = (ts[k + 1] - ts[k]) / 60;
    const fa = Pa[k] + Pb[k] * dt, fb = Pb[k], fc = Pb[k] + Pc[k] * dt, fd = Pc[k];
    const A = Qa[k + 1], B = Qb[k + 1], C = Qc[k + 1], det = A * C - B * B || 1e-9;
    const i00 = C / det, i01 = -B / det, i11 = A / det;
    const g00 = fa * i00 + fb * i01, g01 = fa * i01 + fb * i11, g10 = fc * i00 + fd * i01, g11 = fc * i01 + fd * i11;
    const dp = sp[k + 1] - pp[k + 1], dv = sv[k + 1] - pv[k + 1];
    sp[k] = mp[k] + g00 * dp + g01 * dv; sv[k] = mv[k] + g10 * dp + g11 * dv;
    const da = sa - A, db = sb - B, dc = sc - C;
    sa = Pa[k] + g00 * g00 * da + 2 * g00 * g01 * db + g01 * g01 * dc;
    sb = Pb[k] + g00 * g10 * da + (g00 * g11 + g01 * g10) * db + g01 * g11 * dc;
    sc = Pc[k] + g10 * g10 * da + 2 * g10 * g11 * db + g11 * g11 * dc;
  }
  return { p: sp, v: sv };
}

export function smooth(meas: TPt[]): Smoothed {
  const ts = meas.map((m) => m.t);
  const sx = smoothAxis(ts, meas.map((m) => m.x)), sy = smoothAxis(ts, meas.map((m) => m.y));
  const reloc = new Uint8Array(ts.length);
  for (let k = 0; k < ts.length - 1; k++) {
    const d = Math.hypot(sx.p[k + 1] - sx.p[k], sy.p[k + 1] - sy.p[k]), h = (ts[k + 1] - ts[k]) / 60;
    if (h > 0 && d / h > MAX_KN) reloc[k] = 1;
  }
  return { t: ts, x: sx.p, y: sy.p, vx: sx.v, vy: sy.v, n: ts.length, reloc, detour: null };
}
