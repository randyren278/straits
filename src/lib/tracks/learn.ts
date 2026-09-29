/**
 * The estimator learns which method suits which situation, how fast ships slow down, and
 * how uncertain its estimates are — from backtests it never graded itself on.
 */
import { JITTER_NM } from './constants';
import type { Run } from './clean';
import { pathAt } from './curve';
import type { Method, VesselState } from './estimate';
import { cellOf, grid, inGrid } from './land';
import { toLat, toLon, type TPt } from './proj';

export const METHODS: Method[] = ['hybrid', 'sea', 'damped'];
export const TAUS = [30, 60, 120, 240];
export const CONTEXTS = [
  'Slow <6 kn · open water', 'Slow <6 kn · near coast',
  'Cruising 6–12 kn · open water', 'Cruising 6–12 kn · near coast',
  'Fast >12 kn · open water', 'Fast >12 kn · near coast',
];
const CAP = 400, MIN_EVIDENCE = 8, RECENT = 60;

export interface LearnState {
  stats: Record<Method, number[]>[];
  tauErr: Record<string, number[]>;
  rateErr: number[];
  lastRunAt: number | null;
}

export const emptyLearnState = (): LearnState => ({
  stats: CONTEXTS.map(() => ({ hybrid: [], sea: [], damped: [] })),
  tauErr: Object.fromEntries(TAUS.map((t) => [String(t), []])),
  rateErr: [],
  lastRunAt: null,
});

export const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
};

function nearCoast(st: VesselState): boolean {
  const [c, r] = cellOf(toLon(st.proj, st.x), toLat(st.y));
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
    const cc = c + b, rr = r + a;
    if (inGrid(cc, rr) && !grid.water[rr * grid.w + cc]) return true;
  }
  return false;
}
export const contextOf = (st: VesselState) => (st.spd < 6 ? 0 : st.spd < 12 ? 1 : 2) * 2 + (nearCoast(st) ? 1 : 0);

export function chooseMethod(ls: LearnState, ctx: number): Method {
  const st = ls.stats[ctx];
  if (METHODS.some((m) => st[m].length < MIN_EVIDENCE)) return 'hybrid';
  return METHODS.reduce((a, m) => (median(st[m].slice(-RECENT)) < median(st[a].slice(-RECENT)) ? m : a), 'hybrid' as Method);
}
export function chooseTau(ls: LearnState): number {
  return TAUS.reduce((a, t) => {
    const e = ls.tauErr[String(t)], ea = ls.tauErr[String(a)];
    return e.length && (!ea.length || median(e.slice(-200)) < median(ea.slice(-200))) ? t : a;
  }, 120);
}
/** nm of uncertainty per minute since the last fix, calibrated from backtests. */
export const uncertaintyRate = (ls: LearnState) => median(ls.rateErr.slice(-200)) || 0.03;

/** Real position changes after `cutoff`, at their midpoint report times. */
export function truthUpdates(runs: Run[], cutoff: number, horizon = 60): TPt[] {
  const idx = runs.findIndex((r) => r.t0 > cutoff);
  if (idx < 0) return [];
  let prev = runs[idx - 1], prevEnd = prev ? prev.t1 : cutoff;
  const out: TPt[] = [];
  for (const r of runs.slice(idx)) {
    const t = (prevEnd + r.t0) / 2; prevEnd = r.t1;
    const moved = prev ? Math.hypot(r.x - prev.x, r.y - prev.y) : 0; prev = r;
    if (moved >= JITTER_NM && t <= cutoff + horizon) out.push({ t, x: r.x, y: r.y });
  }
  return out;
}

export function medianError(pts: TPt[], truth: TPt[]): number {
  const o = { x: 0, y: 0 };
  return median(truth.map((q) => (pathAt(pts, q.t, o), Math.hypot(q.x - o.x, q.y - o.y))));
}

export function record(ls: LearnState, ctx: number, errs: Record<Method, number>, tauErrs: Record<string, number>, rate: number) {
  const push = (arr: number[], v: number) => { if (Number.isFinite(v)) { arr.push(v); if (arr.length > CAP) arr.splice(0, arr.length - CAP); } };
  for (const m of METHODS) push(ls.stats[ctx][m], errs[m]);
  for (const [t, e] of Object.entries(tauErrs)) push(ls.tauErr[t] ?? (ls.tauErr[t] = []), e);
  push(ls.rateErr, rate);
}
