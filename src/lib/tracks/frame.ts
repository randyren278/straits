/** Pure frame builder: what the motion overlay draws this frame. */
import type { MapVessel } from '@/lib/map/map-vessel';
import { ACTIVITY_COLORS, REST_GREYS } from '@/lib/map/marker-style';
import type { MotionSource } from './replay';
import type { TrackPayload } from './types';

type XY = { x: number; y: number };
export interface Frame {
  glow: XY[]; glowMix: number;
  tails: { pts: XY[]; est: boolean[]; tier: number }[];
  ahead: { pts: XY[]; tier: number }[];
  rings: { x: number; y: number; r: number }[];
  ships: { mmsi: string; name: string | null; x: number; y: number; heading: number; estimated: boolean; age: number; tier: number; color: string }[];
  /** Ships at rest, drawn by the overlay only in replay (live, the map's dot layer has them). */
  dots: { mmsi: string; x: number; y: number; tier: number; color: string }[];
  /** Where the selected / hovered ship is drawn (estimated position for moving ships). */
  sel: XY | null; selMoving: boolean;
  hov: XY | null;
}
const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const anomalyColor = (v: MapVessel) => {
  const a = v.anomalyType;
  if (!a) return null;
  if (a === 'going_dark') return v.anomalyConfidence === 'confirmed' ? ACTIVITY_COLORS.goingDarkConfirmed : ACTIVITY_COLORS.goingDarkSuspected;
  if (a === 'repeat_going_dark') return ACTIVITY_COLORS.goingDarkConfirmed;
  if (a === 'loitering') return ACTIVITY_COLORS.loitering;
  if (a === 'sts_transfer') return ACTIVITY_COLORS.stsTransfer;
  if (a === 'speed' || a === 'speed_anomaly') return ACTIVITY_COLORS.speed;
  if (a === 'deviation' || a === 'route_deviation') return ACTIVITY_COLORS.deviation;
  return ACTIVITY_COLORS.spoofed;
};

export function buildFrame(input: {
  vessels: MapVessel[]; nc: MotionSource; byMmsi: Map<string, TrackPayload>; tMin: number; zoom: number;
  project: (lon: number, lat: number) => XY; selected: string | null; hovered?: string | null;
  /** Replay: draw ships at rest too, and hide ships not yet seen at tMin. */
  replay?: { has: (mmsi: string) => boolean };
}): Frame {
  const { vessels, nc, byMmsi, tMin, zoom, project, selected, hovered = null, replay } = input;
  const f: Frame = { glow: [], glowMix: 1 - smoothstep(8.2, 9.2, zoom), tails: [], ahead: [], rings: [], ships: [], dots: [], sel: null, selMoving: false, hov: null };
  const focus = (mmsi: string, p: XY, moving: boolean) => {
    if (mmsi === selected) { f.sel = p; f.selMoving = moving; }
    if (mmsi === hovered) f.hov = p;
  };
  const pxPerNm = project(0, 0).y - project(0, 1 / 60).y;
  for (const v of vessels) {
    const s = nc.sample(v.mmsi, tMin, true);
    const tier = byMmsi.get(v.mmsi)?.tier ?? 3;
    if (!s || !s.moving) {
      if (replay) {
        // Tracked ships exist in the replay only once seen; untracked ones sit at their last fix.
        if (!s && replay.has(v.mmsi)) continue;
        const p = s ? project(s.lon, s.lat) : project(v.position.longitude, v.position.latitude);
        f.dots.push({ mmsi: v.mmsi, x: p.x, y: p.y, tier, color: anomalyColor(v) ?? REST_GREYS[Math.min(3, tier)] });
        focus(v.mmsi, p, false);
        if (tier <= 2 && !v.anomalyType && !v.isSanctioned) f.glow.push(p);
      } else {
        const glows = tier <= 2 && !v.anomalyType && !v.isSanctioned;
        if (!glows && v.mmsi !== selected && v.mmsi !== hovered) continue;   // most ships: nothing to project
        const p = project(v.position.longitude, v.position.latitude);
        focus(v.mmsi, p, false);
        if (glows) f.glow.push(p);
      }
      continue;
    }
    const p = project(s.lon, s.lat);
    focus(v.mmsi, p, true);
    f.ships.push({ mmsi: v.mmsi, name: v.name, x: p.x, y: p.y, heading: s.heading, estimated: s.estimated, age: s.age, tier: s.tier,
      color: anomalyColor(v) ?? (s.tier === 0 ? '#fff6e3' : '#d8dbe0') });
    if (s.tier <= 1 || v.mmsi === selected || replay) {
      const t = nc.trailBehind(v.mmsi, tMin).filter((_, k, a) => k >= a.length - 42);
      f.tails.push({ pts: t.map((q) => project(q.lon, q.lat)), est: t.map((q) => q.estimated), tier: s.tier });
    }
    f.ahead.push({ pts: nc.pathAhead(v.mmsi, tMin, 45, 3).map(([lon, lat]) => project(lon, lat)), tier: s.tier });
    const u = byMmsi.get(v.mmsi)?.uncert ?? 0.03, r = (0.15 + u * s.age) * pxPerNm;
    if (s.estimated && s.tier <= 1 && r > 3 && r < 40) f.rings.push({ x: p.x, y: p.y, r });
  }
  return f;
}
