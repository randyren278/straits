/**
 * 24 h replay of the harvester's smoothed tracks, sampled through the same interface as the
 * live Nowcaster so the overlay draws either one. Stretches with no real fix (gaps) and time
 * past a ship's last fix (where it follows the live estimated path) count as estimated.
 * Pure and framework-free.
 */
import { decodeSeries } from './codec';
import type { Sample } from './nowcast';
import type { ReplayResponse, TrackPayload } from './types';

export interface MotionSource {
  sample(mmsi: string, tMin: number, withHeading?: boolean): Sample | null;
  pathAhead(mmsi: string, tMin: number, minutes: number, step: number): [number, number][];
  trailBehind(mmsi: string, tMin: number): { lat: number; lon: number; estimated: boolean }[];
}

interface Pt { t: number; lat: number; lon: number }
interface Track { pts: Pt[]; gaps: number[]; jumps: number[]; after: Pt[] | null; tier: 0 | 1 | 2 }

const kAt = (lat: number) => Math.cos((lat * Math.PI) / 180);
/** Below this (nm per minute, ≈1 kn) a ship reads as at rest. */
const MOVING_NM_PER_MIN = 1 / 60;

/** Catmull-Rom through samples with uneven spacing (the series is thinned where ships sat still). */
function curveAt(P: Pt[], t: number): { lat: number; lon: number } {
  const L = P.length - 1;
  if (t <= P[0].t) return P[0];
  if (t >= P[L].t) return P[L];
  let lo = 0, hi = L;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (P[mid].t <= t) lo = mid; else hi = mid; }
  const p1 = P[lo], p2 = P[hi], f = (t - p1.t) / (p2.t - p1.t || 1);
  // Across a long still stretch the neighbours say nothing about the curve; stay linear.
  if (p2.t - p1.t > 10) return { lat: p1.lat + (p2.lat - p1.lat) * f, lon: p1.lon + (p2.lon - p1.lon) * f };
  const p0 = lo > 0 ? P[lo - 1] : { lat: 2 * p1.lat - p2.lat, lon: 2 * p1.lon - p2.lon };
  const p3 = hi < L ? P[hi + 1] : { lat: 2 * p2.lat - p1.lat, lon: 2 * p2.lon - p1.lon };
  const f2 = f * f, f3 = f2 * f;
  const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);
  return { lat: cr(p0.lat, p1.lat, p2.lat, p3.lat), lon: cr(p0.lon, p1.lon, p2.lon, p3.lon) };
}

export class ReplayModel implements MotionSource {
  readonly from: number;
  readonly to: number;
  private tracks = new Map<string, Track>();

  constructor(resp: ReplayResponse, live: Map<string, TrackPayload>) {
    this.from = resp.from; this.to = resp.to;
    for (const v of resp.vessels) {
      const pts = decodeSeries(v.h).map(([t, lat, lon]) => ({ t, lat, lon }));
      if (!pts.length) continue;
      const p = live.get(v.m);
      const after = p?.state === 'underway' && p.path ? decodeSeries(p.path).map(([t, lat, lon]) => ({ t, lat, lon })) : null;
      this.tracks.set(v.m, { pts, gaps: v.g, jumps: v.j ?? [], after: after && after.length > 1 ? after : null, tier: p?.tier ?? 2 });
    }
  }

  has(mmsi: string) { return this.tracks.has(mmsi); }

  private gapStart(tr: Track, t: number): number | null {
    for (let k = 0; k < tr.gaps.length; k += 2) if (t > tr.gaps[k] && t < tr.gaps[k + 1]) return tr.gaps[k];
    return null;
  }

  private inJump(tr: Track, t: number): boolean {
    for (let k = 0; k < tr.jumps.length; k += 2) if (t > tr.jumps[k] && t < tr.jumps[k + 1]) return true;
    return false;
  }

  /** Position at t, or null before the ship was first seen and during a jump in its data. `past` = beyond the last fix. */
  private pos(tr: Track, t: number): { lat: number; lon: number; past: boolean } | null {
    const P = tr.pts, last = P[P.length - 1];
    if (t < P[0].t || this.inJump(tr, t)) return null;
    if (t <= last.t) return { ...curveAt(P, t), past: false };
    if (tr.after && t <= tr.after[tr.after.length - 1].t) return { ...curveAt(tr.after, Math.max(t, tr.after[0].t)), past: true };
    return { lat: last.lat, lon: last.lon, past: true };
  }

  sample(mmsi: string, tMin: number): Sample | null {
    const tr = this.tracks.get(mmsi); if (!tr) return null;
    const p = this.pos(tr, tMin); if (!p) return null;
    const a = this.pos(tr, tMin + 2.5) ?? p, b = this.pos(tr, tMin - 2.5) ?? p;
    const dx = (a.lon - b.lon) * 60 * kAt(p.lat), dy = (a.lat - b.lat) * 60, d = Math.hypot(dx, dy);
    const moving = d / 5 > MOVING_NM_PER_MIN;
    const last = tr.pts[tr.pts.length - 1].t, gap = this.gapStart(tr, tMin);
    const age = p.past ? tMin - last : gap !== null ? tMin - gap : 0;
    return { lat: p.lat, lon: p.lon, heading: d > 0.02 ? Math.atan2(dy, dx) : 0, moving, estimated: moving && (p.past || gap !== null), age, tier: tr.tier };
  }

  pathAhead(mmsi: string, tMin: number, minutes: number, step: number): [number, number][] {
    const tr = this.tracks.get(mmsi);
    if (!tr?.after || tMin < tr.pts[tr.pts.length - 1].t) return [];
    const out: [number, number][] = [];
    for (let t = tMin; t <= tMin + minutes; t += step) { const s = this.sample(mmsi, t); if (!s || !s.moving) break; out.push([s.lon, s.lat]); }
    return out;
  }

  /** The last hour behind the ship at 3-min steps, flagged where it was estimated. */
  trailBehind(mmsi: string, tMin: number, minutes = 60): { lat: number; lon: number; estimated: boolean }[] {
    const tr = this.tracks.get(mmsi); if (!tr) return [];
    const out: { lat: number; lon: number; estimated: boolean }[] = [];
    for (let t = Math.max(tr.pts[0].t, tMin - minutes); t <= tMin; t += 3) {
      const p = this.pos(tr, t);
      // A jump breaks the wake: never draw a line across it.
      if (!p) { out.length = 0; continue; }
      out.push({ lat: p.lat, lon: p.lon, estimated: p.past || this.gapStart(tr, t) !== null });
    }
    return out;
  }

  /** Ships whose real data resumed (a gap or jump ended) in (t0, t1] — they ping as the replay passes. */
  resumedBetween(t0: number, t1: number): string[] {
    const out: string[] = [];
    if (t1 <= t0) return out;
    const hit = (ends: number[]) => { for (let k = 1; k < ends.length; k += 2) if (ends[k] > t0 && ends[k] <= t1) return true; return false; };
    for (const [m, tr] of this.tracks) if (hit(tr.gaps) || hit(tr.jumps)) out.push(m);
    return out;
  }
}
