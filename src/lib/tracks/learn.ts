/**
 * The estimator learns which method suits which situation — including how quickly ships
 * that go quiet tend to stop — and how uncertain its estimates are, from backtests it
 * never graded itself on.
 */
import { JITTER_NM } from './constants';
import type { Run } from './clean';
import { pathAt } from './curve';
import type { Method, VesselState } from './estimate';
import { cellOf, grid, inGrid } from './land';
import { toLat, toLon, type TPt } from './proj';

/** Candidate = an estimator, with the slow-down time constant folded in for 'damped'. */
export const CANDIDATES = ['hybrid', 'sea', 'damped:30', 'damped:60', 'damped:120', 'damped:240'] as const;
export type Candidate = (typeof CANDIDATES)[number];

const SPEED = ['Slow <6 kn', 'Cruising 6–12 kn', 'Fast >12 kn'];
const PLACE = ['open water', 'near coast'];
const QUIET = ['recent fix', 'silent >1 h'];
/** Context = speed band × near coast × how long the ship has been silent. */
export const CONTEXTS = SPEED.flatMap((s) => PLACE.flatMap((p) => QUIET.map((q) => `${s} · ${p} · ${q}`)));

/**
 * Priors before evidence, measured on production backtests (Sep 30, 2026): ships with a
 * recent fix were best estimated slowing with τ≈120 min; ships silent for hours had usually
 * stopped, best matched by τ≈30 min. Straight lines lost to both.
 */
const PRIOR: Record<number, Candidate> = { 0: 'damped:120', 1: 'damped:30' };
const CAP = 400, MIN_EVIDENCE = 8, RECENT = 60;

export interface LearnState {
  stats: Record<Candidate, number[]>[];
  rateErr: number[];
  lastRunAt: number | null;
}

const emptyStats = () => Object.fromEntries(CANDIDATES.map((c) => [c, [] as number[]])) as Record<Candidate, number[]>;
export const emptyLearnState = (): LearnState => ({ stats: CONTEXTS.map(emptyStats), rateErr: [], lastRunAt: null });

/** Stored state from an older engine version starts over rather than being misread. */
export function normalizeLearnState(raw: unknown): LearnState {
  const s = raw as Partial<LearnState> | null;
  const ok = !!s && Array.isArray(s.stats) && s.stats.length === CONTEXTS.length &&
    s.stats.every((c) => CANDIDATES.every((k) => Array.isArray((c as Record<string, unknown>)[k])));
  if (!ok) return { ...emptyLearnState(), lastRunAt: typeof s?.lastRunAt === 'number' ? s.lastRunAt : null };
  return { stats: s!.stats!, rateErr: Array.isArray(s!.rateErr) ? s!.rateErr : [], lastRunAt: typeof s!.lastRunAt === 'number' ? s!.lastRunAt : null };
}

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
/** `quietMin` = minutes between the last real fix and the moment being estimated from. */
export const contextOf = (st: VesselState, quietMin: number) =>
  ((st.spd < 6 ? 0 : st.spd < 12 ? 1 : 2) * 2 + (nearCoast(st) ? 1 : 0)) * 2 + (quietMin > 60 ? 1 : 0);

export function chooseCandidate(ls: LearnState, ctx: number): Candidate {
  const st = ls.stats[ctx];
  if (CANDIDATES.some((c) => st[c].length < MIN_EVIDENCE)) return PRIOR[ctx % 2];
  return CANDIDATES.reduce((a, c) => (median(st[c].slice(-RECENT)) < median(st[a].slice(-RECENT)) ? c : a), PRIOR[ctx % 2]);
}
export function parseCandidate(c: Candidate): { method: Method; tau: number } {
  const [m, t] = c.split(':');
  return { method: m as Method, tau: t ? Number(t) : 120 };
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

export function record(ls: LearnState, ctx: number, errs: Record<Candidate, number>, rate: number) {
  const push = (arr: number[], v: number) => { if (Number.isFinite(v)) { arr.push(v); if (arr.length > CAP) arr.splice(0, arr.length - CAP); } };
  for (const c of CANDIDATES) push(ls.stats[ctx][c], errs[c]);
  push(ls.rateErr, rate);
}
