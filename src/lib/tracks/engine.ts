/**
 * One harvester run of the track engine: clean → smooth → repair → estimate → score,
 * plus a backtest (hide the last hour) whose errors feed the learner.
 */
import { MAX_EST_MIN } from './constants';
import { clean, runsOf, type RawFix } from './clean';
import { encodeSeries } from './codec';
import { hermite, type Kin } from './curve';
import { canEstimate, predictWith, stateOf } from './estimate';
import { scoreEvidence } from './evidence';
import { smooth } from './kalman';
import { cellOf, grid, inGrid, isLand } from './land';
import {
  CANDIDATES, chooseCandidate, CONTEXTS, contextOf, median, medianError, parseCandidate, record, truthUpdates,
  uncertaintyRate, type Candidate, type LearnState,
} from './learn';
import { projAt, toLat, toLon, toX, toY, type TPt } from './proj';
import { clearPath, repairLand, route, type Density } from './router';
import type { ReplayVessel, TrackPayload, TracksResponse } from './types';

export interface EngineVessel { mmsi: string; fixes: RawFix[]; identity: { name: boolean; type: boolean; flag: boolean; imoOrDest: boolean } }

/** Gaps longer than this between real fixes replay as estimated. */
const REPLAY_GAP_MIN = 25;
/**
 * A land-crossing step is re-sailed by sea only if the route is plausible at this speed
 * (generous: scraped fixes carry harvest-time stamps, so honest ships can look fast).
 */
const SEA_ROUTE_MAX_KN = 60;

/**
 * Ships never cross land. A step that does (both ends in water) follows a sea route when the
 * ship could plausibly have sailed it in the time; otherwise it is a jump in the data, and the
 * ship is hidden for that stretch (`hidden` pairs, whole minutes, rounded outward to cover the
 * series' whole-minute stamps) instead of sliding across land. Steps over open water are left
 * alone, however fast.
 */
export function seaSafe(pts: TPt[], proj: ReturnType<typeof projAt>, density: Density | null): { pts: TPt[]; hidden: number[] } {
  const out: TPt[] = pts.length ? [pts[0]] : [], hidden: number[] = [];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k], d = Math.hypot(b.x - a.x, b.y - a.y), dt = Math.max(0.1, b.t - a.t);
    if (d < 0.3) { out.push(b); continue; }
    const la = toLon(proj, a.x), pa = toLat(a.y), lb = toLon(proj, b.x), pb = toLat(b.y);
    if (isLand(la, pa) || isLand(lb, pb) || clearPath(la, pa, lb, pb)) { out.push(b); continue; }
    {
      const r = route(la, pa, lb, pb, density);
      if (r && r.length > 1) {
        const xy = r.map(([lo, lat]) => ({ x: toX(proj, lo), y: toY(lat) }));
        xy[0] = { x: a.x, y: a.y }; xy[xy.length - 1] = { x: b.x, y: b.y };
        const cum = [0];
        for (let i = 1; i < xy.length; i++) cum.push(cum[i - 1] + Math.hypot(xy[i].x - xy[i - 1].x, xy[i].y - xy[i - 1].y));
        const L = cum[cum.length - 1];
        if ((L / dt) * 60 <= SEA_ROUTE_MAX_KN) {
          for (let i = 1; i < xy.length - 1; i++) out.push({ t: a.t + (dt * cum[i]) / L, ...xy[i] });
          out.push(b); continue;
        }
      }
    }
    const h0 = Math.floor(a.t), h1 = Math.ceil(b.t);
    if (hidden.length && hidden[hidden.length - 1] >= h0) hidden[hidden.length - 1] = h1; else hidden.push(h0, h1);
    out.push(b);
  }
  return { pts: out, hidden };
}

/**
 * The last 24 h of the smoothed track at 5-min steps, thinned where the ship sat still
 * (kept at least hourly, and the sample before each move so a rest doesn't smear into it).
 */
function replayOf(s: ReturnType<typeof smooth>, meas: TPt[], proj: ReturnType<typeof projAt>, now: number, kin: Kin, density: Density | null): Omit<ReplayVessel, 'm'> {
  const from = Math.max(s.t[0], now - 1440), end = s.t[s.n - 1], pts: TPt[] = [];
  let prev: TPt | null = null;
  const keep = (p: TPt) => { const q = pts[pts.length - 1]; if (!q || q.t !== p.t) pts.push(p); };
  for (let t = from; ; t = Math.min(end, t + 5)) {
    hermite(s, t, kin);
    const p = { t, x: kin.x, y: kin.y }, q = pts[pts.length - 1];
    const moved = !!q && Math.hypot(p.x - q.x, p.y - q.y) >= 0.05;
    if (moved && prev && prev.t > q.t) keep(prev);
    if (!q || moved || t === end || t - q.t >= 60) keep(p);
    prev = p;
    if (t >= end) break;
  }
  const g: number[] = [];
  for (let k = 1; k < meas.length; k++) {
    if (meas[k].t - meas[k - 1].t <= REPLAY_GAP_MIN || meas[k].t <= from) continue;
    const a = Math.round(Math.max(from, meas[k - 1].t)), b = Math.round(meas[k].t);
    // Report times sit midway between fixes, so one silence can arrive as two touching gaps.
    if (g.length && g[g.length - 1] >= a) g[g.length - 1] = b; else g.push(a, b);
  }
  const safe = seaSafe(pts, proj, density);
  return { h: encodeSeries(toSeries(proj, safe.pts, 1)), g, ...(safe.hidden.length ? { j: safe.hidden } : {}) };
}

const toSeries = (proj: ReturnType<typeof projAt>, pts: TPt[], every: number) =>
  pts.filter((_, k) => k % every === 0 || k === pts.length - 1).map((p) => [p.t, toLat(p.y), toLon(proj, p.x)] as [number, number, number]);

export function runTrackEngine(input: { vessels: EngineVessel[]; now: number; density: Density; learn: LearnState }) {
  const { vessels, now, density, learn } = input;
  const choice = CONTEXTS.map((_, k) => chooseCandidate(learn, k)), uncert = uncertaintyRate(learn);
  const predict = (c: Candidate, st: ReturnType<typeof stateOf>, minutes: number) => {
    const { method, tau } = parseCandidate(c);
    return predictWith(method, st, minutes, density, tau);
  };
  const payloads: TrackPayload[] = [], replay: ReplayVessel[] = [], densityDelta = new Map<number, number>();
  const holdErr: number[] = [], estErr: number[] = [];
  // First-ever run seeds lanes from the whole day; after that, only motion since the last run.
  const since = Math.max(now - 1440, learn.lastRunAt ?? now - 1440);
  const kin: Kin = { x: 0, y: 0, vx: 0, vy: 0 };

  for (const v of vessels) {
    if (!v.fixes.length) continue;
    const proj = projAt(v.fixes[v.fixes.length - 1].lat);
    const runs = runsOf(v.fixes, proj, now);
    const cl = clean(runs, proj);
    if (!cl.meas.length) continue;
    const s = smooth(cl.meas);
    const rerouted = repairLand(s, proj, density);
    const st = stateOf(s, proj), estimable = cl.meas.length >= 2 && canEstimate(cl, st);
    if (!estimable) { const L = s.n - 1; s.vx[L] = 0; s.vy[L] = 0; }

    // Lanes learn from motion seen since the previous run.
    for (let t = Math.max(since, s.t[0]); t <= s.t[s.n - 1]; t += 5) {
      hermite(s, t, kin); if (Math.hypot(kin.vx, kin.vy) < 2) continue;
      const [c, r] = cellOf(toLon(proj, kin.x), toLat(kin.y));
      if (inGrid(c, r)) { const i = r * grid.w + c; densityDelta.set(i, (densityDelta.get(i) ?? 0) + 1); }
    }

    replay.push({ m: v.mmsi, ...replayOf(s, cl.meas, proj, now, kin, density) });

    const ev = scoreEvidence({ fixTimes: v.fixes.map((f) => f.t), now, rejected: cl.rejected, moves: cl.moves, identity: v.identity });
    let path: number[] | null = null, trail: number[] | null = null, m: TrackPayload['method'] = null, tau: number | null = null;
    if (estimable) {
      const c = choice[contextOf(st, now - st.t)];
      ({ method: m, tau } = parseCandidate(c));
      if (m !== 'damped') tau = null;
      path = encodeSeries(toSeries(proj, predict(c, st, MAX_EST_MIN), 3));   // 6-min samples
      if (ev.tier <= 1) {
        const pts: TPt[] = [];
        for (let t = Math.ceil((st.t - 120) / 3) * 3; t <= st.t; t += 3) { if (t < s.t[0]) continue; hermite(s, t, kin); pts.push({ t, x: kin.x, y: kin.y }); }
        const safe = seaSafe(pts, proj, density), lastJump = safe.hidden.length ? safe.hidden[safe.hidden.length - 1] : -Infinity;
        trail = encodeSeries(toSeries(proj, safe.pts.filter((p) => p.t >= lastJump), 1));
      }
    }
    let cog = (90 - (Math.atan2(st.vy, st.vx) * 180) / Math.PI + 360) % 360;
    if (!estimable) cog = 0;
    payloads.push({
      mmsi: v.mmsi, tier: ev.tier, score: ev.score, parts: ev.parts,
      state: estimable ? 'underway' : 'rest', sog: Math.round((estimable ? st.spd : 0) * 10) / 10, cog: Math.round(cog),
      lastRealAt: Math.round(st.t * 10) / 10, method: m, tau, uncert, path, trail,
      cleaning: { kept: cl.moves, rejected: cl.rejected, inland: cl.inland, rerouted },
    });

    // Backtest: estimate from what was known an hour ago, score against what happened since.
    const cutoff = now - 60, cRuns = runsOf(v.fixes, proj, cutoff), cCl = clean(cRuns, proj);
    if (cCl.meas.length < 2) continue;
    const cs = smooth(cCl.meas), cst = stateOf(cs, proj);
    if (!canEstimate(cCl, cst)) continue;
    const truth = truthUpdates(runs, cutoff);
    if (!truth.length) continue;
    const horizon = Math.max(10, Math.min(MAX_EST_MIN, cutoff + 75 - cst.t)), ctx = contextOf(cst, cutoff - cst.t);
    const errs = Object.fromEntries(CANDIDATES.map((c) => [c, medianError(predict(c, cst, horizon), truth)])) as Record<Candidate, number>;
    const used = choice[ctx], elapsed = Math.max(10, truth[truth.length - 1].t - cst.t);
    record(learn, ctx, errs, errs[used] / elapsed);
    holdErr.push(median(truth.map((q) => Math.hypot(q.x - cst.x, q.y - cst.y))));
    estErr.push(errs[used]);
  }
  learn.lastRunAt = now;
  const learned: TracksResponse['learned'] = { choice: CONTEXTS.map((_, k) => chooseCandidate(learn, k)), contexts: CONTEXTS };
  return { payloads, replay, densityDelta, backtest: { n: estErr.length, hold: median(holdErr), estimate: median(estErr) }, learned };
}
