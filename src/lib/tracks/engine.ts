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
import { cellOf, grid, inGrid } from './land';
import {
  CANDIDATES, chooseCandidate, CONTEXTS, contextOf, median, medianError, parseCandidate, record, truthUpdates,
  uncertaintyRate, type Candidate, type LearnState,
} from './learn';
import { projAt, toLat, toLon, type TPt } from './proj';
import { repairLand, type Density } from './router';
import type { TrackPayload, TracksResponse } from './types';

export interface EngineVessel { mmsi: string; fixes: RawFix[]; identity: { name: boolean; type: boolean; flag: boolean; imoOrDest: boolean } }

const toSeries = (proj: ReturnType<typeof projAt>, pts: TPt[], every: number) =>
  pts.filter((_, k) => k % every === 0 || k === pts.length - 1).map((p) => [p.t, toLat(p.y), toLon(proj, p.x)] as [number, number, number]);

export function runTrackEngine(input: { vessels: EngineVessel[]; now: number; density: Density; learn: LearnState }) {
  const { vessels, now, density, learn } = input;
  const choice = CONTEXTS.map((_, k) => chooseCandidate(learn, k)), uncert = uncertaintyRate(learn);
  const predict = (c: Candidate, st: ReturnType<typeof stateOf>, minutes: number) => {
    const { method, tau } = parseCandidate(c);
    return predictWith(method, st, minutes, density, tau);
  };
  const payloads: TrackPayload[] = [], densityDelta = new Map<number, number>();
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
        trail = encodeSeries(toSeries(proj, pts, 1));
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
  return { payloads, densityDelta, backtest: { n: estErr.length, hold: median(holdErr), estimate: median(estErr) }, learned };
}
