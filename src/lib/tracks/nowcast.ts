/**
 * Client-side nowcast. Each /api/tracks payload is an epoch: the ship's last real state plus
 * an estimated path. When a new epoch arrives, the drawn position blends old → new with a
 * smoothstep weight, so position AND velocity stay continuous (projective blending, as in
 * networked-game dead reckoning). The blend lasts ~15 map-min per nm of correction (6–60);
 * heading turns no faster than 10°/map-min. Corrections over 5 nm snap rather than glide,
 * so a ship never slides across land to reach its new fix. Pure and framework-free.
 */
import { decodeSeries } from './codec';
import type { TrackPayload } from './types';

export interface Sample { lat: number; lon: number; heading: number; moving: boolean; estimated: boolean; age: number; tier: 0 | 1 | 2 }
interface Pt { t: number; lat: number; lon: number }
interface Epoch { avail: number; lastRealAt: number; lat: number; lon: number; cog: number; path: Pt[] | null; trail: Pt[]; B: number; BH: number; tier: 0 | 1 | 2; sig: string }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Corrections larger than this (nm) snap in SNAP_MIN map-minutes instead of blending. */
const SNAP_NM = 5, SNAP_MIN = 0.05;
const smooth = (u: number) => u * u * (3 - 2 * u);
const kAt = (lat: number) => Math.cos((lat * Math.PI) / 180);

function catmull(P: Pt[], t: number): { lat: number; lon: number } {
  const L = P.length - 1;
  if (t <= P[0].t) return P[0];
  if (t >= P[L].t) return P[L];
  const step = P[1].t - P[0].t, k = Math.min(L - 1, Math.floor((t - P[0].t) / step)), f = (t - P[k].t) / (P[k + 1].t - P[k].t);
  const p1 = P[k], p2 = P[k + 1];
  const p0 = k > 0 ? P[k - 1] : { t: 0, lat: 2 * p1.lat - p2.lat, lon: 2 * p1.lon - p2.lon };
  const p3 = k + 2 <= L ? P[k + 2] : { t: 0, lat: 2 * p2.lat - p1.lat, lon: 2 * p2.lon - p1.lon };
  const f2 = f * f, f3 = f2 * f;
  const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);
  return { lat: cr(p0.lat, p1.lat, p2.lat, p3.lat), lon: cr(p0.lon, p1.lon, p2.lon, p3.lon) };
}

export class Nowcaster {
  private epochs = new Map<string, Epoch[]>();

  ingest(payloads: TrackPayload[], nowMin: number) {
    for (const p of payloads) {
      const path = p.path ? decodeSeries(p.path).map(([t, lat, lon]) => ({ t, lat, lon })) : null;
      const trail = p.trail ? decodeSeries(p.trail).map(([t, lat, lon]) => ({ t, lat, lon })) : [];
      const origin = path?.[0] ?? trail[trail.length - 1];
      const sig = `${p.lastRealAt}|${p.path?.length ?? 0}|${p.method}`;
      const list = this.epochs.get(p.mmsi) ?? [];
      const prev = list[list.length - 1];
      if (prev && prev.sig === sig) { prev.tier = p.tier; continue; }
      const e: Epoch = {
        avail: prev ? nowMin : -Infinity, lastRealAt: p.lastRealAt, lat: origin?.lat ?? 0, lon: origin?.lon ?? 0,
        cog: p.cog, path: path && path.length > 1 && p.state === 'underway' ? path : null, trail, B: 6, BH: 6, tier: p.tier, sig,
      };
      if (!origin && prev) { e.lat = prev.lat; e.lon = prev.lon; }
      if (prev) {
        const a = this.at(list, list.length - 1, nowMin), b = this.base(e, nowMin);
        const off = Math.hypot((b.lon - a.lon) * 60 * kAt(a.lat), (b.lat - a.lat) * 60);
        // A big correction is not glided: the straight-ish mix of two paths can cut across a
        // headland. The ship moves to where the data puts it (the overlay pings it there).
        if (off > SNAP_NM) { e.B = e.BH = SNAP_MIN; } else {
          e.B = Math.max(6, Math.min(60, 15 * off));
          const hA = this.headingAt(list, list.length - 1, nowMin), hB = this.baseHeading(e, nowMin);
          e.BH = Math.max(e.B, (Math.abs(Math.atan2(Math.sin(hB - hA), Math.cos(hB - hA))) * 180) / Math.PI / 10);
        }
      }
      list.push(e);
      // Drop epochs whose successor's blend is long finished.
      while (list.length > 1 && nowMin > list[1].avail + list[1].BH + 1) list.shift();
      this.epochs.set(p.mmsi, list);
    }
  }

  has(mmsi: string) { return this.epochs.has(mmsi); }
  mmsis() { return [...this.epochs.keys()]; }

  private base(e: Epoch, t: number): { lat: number; lon: number } {
    if (!e.path || t <= e.path[0].t) return { lat: e.lat, lon: e.lon };
    const tEnd = e.path[e.path.length - 1].t, D = Math.min(10, (tEnd - e.path[0].t) / 2);
    let tp = t;
    if (t > tEnd - D) { const u = Math.min(1, (t - (tEnd - D)) / D); tp = tEnd - D + D * (u - (u * u) / 2); }
    return catmull(e.path, tp);
  }
  private baseHeading(e: Epoch, t: number): number {
    const a = this.base(e, t + 2), b = this.base(e, t - 2);
    const dx = (a.lon - b.lon) * 60 * kAt(a.lat), dy = (a.lat - b.lat) * 60;
    return Math.hypot(dx, dy) > 0.02 ? Math.atan2(dy, dx) : ((90 - e.cog) * Math.PI) / 180;
  }
  private at(list: Epoch[], k: number, t: number): { lat: number; lon: number } {
    const e = list[k];
    if (k === 0 || t >= e.avail + e.B) return this.base(e, t);
    const a = this.at(list, k - 1, t), b = this.base(e, t), w = smooth(clamp01((t - e.avail) / e.B));
    return { lat: a.lat + (b.lat - a.lat) * w, lon: a.lon + (b.lon - a.lon) * w };
  }
  private headingAt(list: Epoch[], k: number, t: number): number {
    const e = list[k], hNew = this.baseHeading(e, t);
    if (k === 0 || t >= e.avail + e.BH) return hNew;
    const hOld = this.headingAt(list, k - 1, t), w = smooth(clamp01((t - e.avail) / e.BH));
    return hOld + Math.atan2(Math.sin(hNew - hOld), Math.cos(hNew - hOld)) * w;
  }
  private index(list: Epoch[], t: number) { let k = 0; for (let j = 1; j < list.length; j++) if (list[j].avail <= t) k = j; return k; }

  sample(mmsi: string, tMin: number, withHeading = false): Sample | null {
    const list = this.epochs.get(mmsi); if (!list) return null;
    const k = this.index(list, tMin), e = list[k], pos = this.at(list, k, tMin);
    const moving = !!e.path && tMin < e.path[e.path.length - 1].t;
    return {
      lat: pos.lat, lon: pos.lon, heading: withHeading ? this.headingAt(list, k, tMin) : this.baseHeading(e, tMin),
      moving, estimated: moving && tMin - e.lastRealAt > 10, age: tMin - e.lastRealAt, tier: e.tier,
    };
  }
  isMotion(mmsi: string, tMin: number) { const s = this.sample(mmsi, tMin); return !!s && s.moving; }

  pathAhead(mmsi: string, tMin: number, minutes: number, step: number): [number, number][] {
    const out: [number, number][] = [];
    for (let t = tMin; t <= tMin + minutes; t += step) { const s = this.sample(mmsi, t); if (!s || !s.moving) break; out.push([s.lon, s.lat]); }
    return out;
  }
  /** Smoothed real history (trail) followed by the estimated stretch up to now. */
  trailBehind(mmsi: string, tMin: number): { lat: number; lon: number; estimated: boolean }[] {
    const list = this.epochs.get(mmsi); if (!list) return [];
    const e = list[this.index(list, tMin)], out = e.trail.filter((p) => p.t <= e.lastRealAt).map((p) => ({ lat: p.lat, lon: p.lon, estimated: false }));
    for (let t = Math.ceil(e.lastRealAt / 3) * 3; t <= tMin; t += 3) { const s = this.sample(mmsi, t); if (s) out.push({ lat: s.lat, lon: s.lon, estimated: true }); }
    const now = this.sample(mmsi, tMin); if (now) out.push({ lat: now.lat, lon: now.lon, estimated: now.estimated });
    return out;
  }
}
