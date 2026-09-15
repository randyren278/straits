/**
 * Suez crossing model — pure.
 *
 * Turns per-vessel position tracks into observed corridor movements:
 *
 *   complete    gate-in at one end, then gate-out at the other, in time order,
 *               no faster than a ship can physically make the passage
 *   incomplete  entered a gate and the canal, but the track ends (or 48 h
 *               pass) without the far gate being observed — a sampling gap,
 *               never an interpolated transit
 *   waiting     held essentially still inside an anchorage for ≥ 6 h
 *
 * A stationary contact never becomes a transit. A contact drifting across a
 * gate boundary is one visit, not several (hysteresis). Counts are of
 * observed contacts passing both gates — not cargo, not the canal
 * authority's transit ledger.
 */
import { haversineDistance } from '../geo/haversine';
import {
  SUEZ_GATES, SUEZ_CORRIDOR, SUEZ_WAITING_ZONES, inGateBox,
  type GateBox, type SuezGateId,
} from '../geo/suez-gates';

export interface TrackPoint {
  time: Date;
  latitude: number;
  longitude: number;
}

export type CrossingDirection = 'northbound' | 'southbound';
export type CrossingStatus = 'complete' | 'incomplete' | 'waiting';

export interface Crossing {
  mmsi: string;
  direction: CrossingDirection;
  status: CrossingStatus;
  /** Last fix inside the entry gate (complete/incomplete) or first fix of the dwell (waiting). */
  gateInAt: Date;
  /** First fix inside the exit gate; null unless complete. */
  gateOutAt: Date | null;
  /** Why an incomplete journey is incomplete. */
  reason?: string;
}

export interface CrossingOptions {
  gates?: Record<SuezGateId, GateBox>;
  corridor?: GateBox;
  waitingZones?: Record<string, GateBox>;
  /** Fastest plausible passage between the gates. */
  minTravelMinutes?: number;
  /** A contact must be this far outside a gate box before its visit closes. */
  hysteresisKm?: number;
  /** Give up on a gate-in without a gate-out after this long. */
  incompleteAfterHours?: number;
  /** Dwell length that makes an anchorage stay "waiting". */
  waitingMinHours?: number;
  /** Maximum drift from the first fix for the stay to count as still. */
  waitingMaxDriftKm?: number;
}

const DEFAULTS: Required<CrossingOptions> = {
  gates: SUEZ_GATES,
  corridor: SUEZ_CORRIDOR,
  waitingZones: SUEZ_WAITING_ZONES,
  minTravelMinutes: 600,
  hysteresisKm: 3,
  incompleteAfterHours: 48,
  waitingMinHours: 6,
  waitingMaxDriftKm: 2,
};

const OTHER: Record<SuezGateId, SuezGateId> = { port_said: 'suez', suez: 'port_said' };

/** Straight-line distance from a point to the nearest edge of a box (0 inside). */
function distanceOutsideKm(lat: number, lon: number, b: GateBox): number {
  if (inGateBox(lat, lon, b)) return 0;
  const cLat = Math.min(Math.max(lat, b.minLat), b.maxLat);
  const cLon = Math.min(Math.max(lon, b.minLon), b.maxLon);
  return haversineDistance(lat, lon, cLat, cLon);
}

interface Visit { gate: SuezGateId; entry: Date; exit: Date; exitIndex: number }

function gateVisits(track: TrackPoint[], o: Required<CrossingOptions>): Visit[] {
  const visits: Visit[] = [];
  let open: Visit | null = null;
  track.forEach((p, i) => {
    const inside = (Object.keys(o.gates) as SuezGateId[]).find((g) => inGateBox(p.latitude, p.longitude, o.gates[g])) ?? null;
    if (open) {
      if (inside === open.gate) { open.exit = p.time; open.exitIndex = i; return; }
      if (distanceOutsideKm(p.latitude, p.longitude, o.gates[open.gate]) < o.hysteresisKm && inside === null) return;
      visits.push(open);
      open = null;
    }
    if (inside) open = { gate: inside, entry: p.time, exit: p.time, exitIndex: i };
  });
  if (open) visits.push(open);
  return visits;
}

function enteredCorridorBetween(track: TrackPoint[], from: number, to: number, corridor: GateBox): boolean {
  for (let i = from + 1; i < to; i++) {
    if (inGateBox(track[i].latitude, track[i].longitude, corridor)) return true;
  }
  return false;
}

function waitingStays(mmsi: string, track: TrackPoint[], o: Required<CrossingOptions>): Crossing[] {
  const out: Crossing[] = [];
  for (const [zoneId, box] of Object.entries(o.waitingZones)) {
    let start: TrackPoint | null = null;
    let last: TrackPoint | null = null;
    const flush = () => {
      if (start && last && (last.time.getTime() - start.time.getTime()) >= o.waitingMinHours * 3_600_000) {
        out.push({
          mmsi, status: 'waiting', gateInAt: start.time, gateOutAt: null,
          direction: zoneId.startsWith('port_said') ? 'southbound' : 'northbound',
        });
      }
      start = null; last = null;
    };
    for (const p of track) {
      const inside = inGateBox(p.latitude, p.longitude, box);
      if (!inside) { flush(); continue; }
      if (!start) { start = p; last = p; continue; }
      if (haversineDistance(start.latitude, start.longitude, p.latitude, p.longitude) > o.waitingMaxDriftKm) {
        flush(); start = p; last = p; continue;
      }
      last = p;
    }
    flush();
  }
  return out;
}

export function computeCrossings(
  tracks: Map<string, TrackPoint[]>,
  options: CrossingOptions = {},
): Crossing[] {
  const o = { ...DEFAULTS, ...options };
  const crossings: Crossing[] = [];

  for (const [mmsi, raw] of tracks) {
    const track = [...raw].sort((a, b) => a.time.getTime() - b.time.getTime());
    if (track.length === 0) continue;
    const visits = gateVisits(track, o);
    const trackEnd = track[track.length - 1];

    let pending: Visit | null = null;
    const settlePending = (nextIndex: number, nextEntry: Date | null) => {
      if (!pending) return;
      const entered = enteredCorridorBetween(track, pending.exitIndex, nextIndex, o.corridor);
      if (!entered) return;
      const horizon = nextEntry ?? trackEnd.time;
      const elapsedH = (horizon.getTime() - pending.exit.getTime()) / 3_600_000;
      crossings.push({
        mmsi, status: 'incomplete', gateInAt: pending.exit, gateOutAt: null,
        direction: pending.gate === 'port_said' ? 'southbound' : 'northbound',
        reason: elapsedH >= o.incompleteAfterHours
          ? `no far-gate fix within ${o.incompleteAfterHours}h`
          : 'track ended before the far gate',
      });
    };

    for (const v of visits) {
      if (pending && v.gate === OTHER[pending.gate]) {
        const travelMin = (v.entry.getTime() - pending.exit.getTime()) / 60_000;
        if (travelMin >= o.minTravelMinutes) {
          crossings.push({
            mmsi, status: 'complete', gateInAt: pending.exit, gateOutAt: v.entry,
            direction: pending.gate === 'port_said' ? 'southbound' : 'northbound',
          });
          pending = v;
          continue;
        }
        // Too fast to be a passage: the entry visit is not a transit start.
        settlePending(v.exitIndex, v.entry);
        pending = v;
        continue;
      }
      if (pending) settlePending(v.exitIndex, v.entry);
      pending = v;
    }
    settlePending(track.length, null);

    crossings.push(...waitingStays(mmsi, track, o));
  }

  return crossings.sort((a, b) => a.gateInAt.getTime() - b.gateInAt.getTime());
}

export interface DailyCrossingCounts {
  day: string;
  northbound: number;
  southbound: number;
  waiting: number;
  incomplete: number;
  distinctMmsi: number;
}

/** Day a crossing belongs to: gate-out for completes, dwell/gate-in start otherwise. UTC. */
export function crossingDay(c: Crossing): string {
  return (c.gateOutAt ?? c.gateInAt).toISOString().slice(0, 10);
}

export function aggregateDaily(crossings: readonly Crossing[]): DailyCrossingCounts[] {
  const days = new Map<string, DailyCrossingCounts & { mmsi: Set<string> }>();
  for (const c of crossings) {
    const day = crossingDay(c);
    let d = days.get(day);
    if (!d) { d = { day, northbound: 0, southbound: 0, waiting: 0, incomplete: 0, distinctMmsi: 0, mmsi: new Set() }; days.set(day, d); }
    if (c.status === 'complete') d[c.direction]++;
    else d[c.status]++;
    d.mmsi.add(c.mmsi);
  }
  return [...days.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map(({ mmsi, ...rest }) => ({ ...rest, distinctMmsi: mmsi.size }));
}
