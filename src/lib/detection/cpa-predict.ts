/**
 * STS CPA Prediction (forward-looking rendezvous nowcast)
 *
 * Dead-reckons two vessel tracks to their closest-point-of-approach (CPA) and
 * predicts a ship-to-ship (STS) rendezvous when ALL of the following hold:
 *   1. Projected CPA distance < STS_CPA_THRESHOLD_KM within CPA_HORIZON_MINUTES.
 *   2. Both vessels are decelerating INTO the STS transfer speed band (~1–5 kt)
 *      — i.e. current speed is trending toward the band, not accelerating away.
 *   3. At least one party is sanctioned / high-risk.
 *
 * Pure kinematics — no ML libraries. Each vessel's velocity is taken from its
 * two most-recent positions (great-circle displacement over elapsed time),
 * projected in a local flat-earth (equirectangular) frame around the pair
 * centroid, and the CPA is solved analytically from the relative
 * position/velocity vectors (closing velocity).
 *
 * CRITICAL: live `sts_predicted` alert emission is GATED OFF by
 * STS_PREDICTION_ALERT_ENABLED (default FALSE) — there is not yet enough
 * ground-truth history to fire in production. The detector computes and can be
 * backtested (backtestAgainstRendezvous) without ever emitting an alert.
 */
import { haversineDistance } from '../geo/haversine';

/**
 * MASTER SWITCH — leave FALSE until the CPA predictor is validated against
 * enough vessel_rendezvous ground truth. While false, predictAllPairs computes
 * predictions but no alert is ever emitted.
 */
export const STS_PREDICTION_ALERT_ENABLED = false;

/** CPA distance threshold (km). Aligned with the STS proximity band (0.5nm ≈ 0.926 km), padded for projection error. */
export const STS_CPA_THRESHOLD_KM = 2;

/** How far ahead we project (minutes). Short horizon keeps linear dead-reckoning valid. */
export const CPA_HORIZON_MINUTES = 60;

/** Transfer speed band lower/upper bounds (knots). Vessels rafting for STS slow into this range. */
export const STS_BAND_MIN_KNOTS = 1;
export const STS_BAND_MAX_KNOTS = 5;

const KM_PER_NM = 1.852;
const KM_PER_DEG_LAT = 111.32;

/** A single timestamped position sample for one vessel. */
export interface TrackPoint {
  time: Date;
  lat: number;
  lon: number;
  /** Speed over ground in knots (optional; derived from displacement if absent). */
  sog?: number;
  /** Course over ground in degrees (optional; unused in the linear solve). */
  cog?: number;
}

/** A vessel track plus identity + risk context for a prediction candidate. */
export interface VesselTrack {
  imo: string;
  name: string;
  track: TrackPoint[];
  /** Whether this vessel is sanctioned / high-risk. */
  sanctioned: boolean;
}

/** A predicted rendezvous between two vessels. */
export interface CpaPrediction {
  imoA: string;
  imoB: string;
  nameA: string;
  nameB: string;
  /** Projected closest-point-of-approach distance (km). */
  cpaDistanceKm: number;
  /** Minutes until the projected CPA. */
  timeToCpaMinutes: number;
  /** Closing speed of the pair at prediction time (knots). */
  closingSpeedKnots: number;
  /** Whether at least one party is sanctioned / high-risk. */
  sanctionedParty: boolean;
}

/** Local ENU-ish velocity in km and km/min around a reference latitude. */
interface Kinematic {
  /** East (km) offset of the latest position from the reference. */
  x: number;
  /** North (km) offset of the latest position from the reference. */
  y: number;
  /** East velocity (km/min). */
  vx: number;
  /** North velocity (km/min). */
  vy: number;
  /** Ground speed (knots) derived from the two most-recent samples. */
  speedKnots: number;
  /** Speed (knots) one sample earlier — used to test deceleration. */
  prevSpeedKnots: number;
}

/**
 * Project a lat/lon to local east/north km offsets from a reference point
 * using an equirectangular approximation (valid over the small pair region).
 */
function toLocalXY(lat: number, lon: number, refLat: number, refLon: number): { x: number; y: number } {
  const x = (lon - refLon) * KM_PER_DEG_LAT * Math.cos((refLat * Math.PI) / 180);
  const y = (lat - refLat) * KM_PER_DEG_LAT;
  return { x, y };
}

/**
 * Derive local kinematics (position + velocity) for a vessel from its two most
 * recent track points, relative to a shared reference point. Returns null if
 * the track is too short or the samples are not time-ordered.
 */
function deriveKinematic(track: TrackPoint[], refLat: number, refLon: number): Kinematic | null {
  if (track.length < 2) return null;

  // Use the last two points for the current velocity vector.
  const p1 = track[track.length - 2];
  const p2 = track[track.length - 1];
  const dtMin = (p2.time.getTime() - p1.time.getTime()) / 60000;
  if (dtMin <= 0) return null;

  const a = toLocalXY(p1.lat, p1.lon, refLat, refLon);
  const b = toLocalXY(p2.lat, p2.lon, refLat, refLon);

  const vx = (b.x - a.x) / dtMin;
  const vy = (b.y - a.y) / dtMin;

  // Ground speed from displacement (knots), preferring reported sog when present.
  const segKm = haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
  const derivedKnots = (segKm / dtMin) * (60 / KM_PER_NM);
  const speedKnots = typeof p2.sog === 'number' ? p2.sog : derivedKnots;

  // Prior-segment speed (for deceleration test): use reported sog when available,
  // else the displacement of the segment before, else the current speed.
  let prevSpeedKnots = speedKnots;
  if (typeof p1.sog === 'number') {
    prevSpeedKnots = p1.sog;
  } else if (track.length >= 3) {
    const p0 = track[track.length - 3];
    const dt0 = (p1.time.getTime() - p0.time.getTime()) / 60000;
    if (dt0 > 0) {
      prevSpeedKnots = (haversineDistance(p0.lat, p0.lon, p1.lat, p1.lon) / dt0) * (60 / KM_PER_NM);
    }
  }

  return { x: b.x, y: b.y, vx, vy, speedKnots, prevSpeedKnots };
}

/**
 * Whether a vessel is decelerating toward the STS transfer band: its speed is
 * not increasing and it is at or approaching the ~1–5 kt band from above.
 */
function deceleratingIntoBand(k: Kinematic): boolean {
  const decelerating = k.speedKnots <= k.prevSpeedKnots + 0.1; // allow tiny noise
  const nearBand = k.speedKnots <= STS_BAND_MAX_KNOTS + 3 && k.speedKnots >= STS_BAND_MIN_KNOTS - 0.5;
  return decelerating && nearBand;
}

/**
 * Predict a CPA rendezvous for a single pair of vessel tracks.
 * Returns null when the pair does not meet all prediction criteria.
 */
export function predictPairCpa(a: VesselTrack, b: VesselTrack): CpaPrediction | null {
  const lastA = a.track[a.track.length - 1];
  const lastB = b.track[b.track.length - 1];
  if (!lastA || !lastB) return null;

  // Shared local frame anchored at the pair midpoint.
  const refLat = (lastA.lat + lastB.lat) / 2;
  const refLon = (lastA.lon + lastB.lon) / 2;

  const ka = deriveKinematic(a.track, refLat, refLon);
  const kb = deriveKinematic(b.track, refLat, refLon);
  if (!ka || !kb) return null;

  // Criterion 3: at least one sanctioned/high-risk party.
  const sanctionedParty = a.sanctioned || b.sanctioned;
  if (!sanctionedParty) return null;

  // Criterion 2: both decelerating into the transfer band.
  if (!deceleratingIntoBand(ka) || !deceleratingIntoBand(kb)) return null;

  // Relative position/velocity (A relative to B).
  const rx = ka.x - kb.x;
  const ry = ka.y - kb.y;
  const rvx = ka.vx - kb.vx;
  const rvy = ka.vy - kb.vy;

  const relSpeedSq = rvx * rvx + rvy * rvy;

  // Time (minutes) to CPA: t* = -(r · v) / |v|^2, clamped to the horizon.
  let tCpa: number;
  if (relSpeedSq < 1e-9) {
    tCpa = 0; // parallel / stationary relative motion — CPA is now
  } else {
    tCpa = -(rx * rvx + ry * rvy) / relSpeedSq;
  }
  if (tCpa < 0) tCpa = 0; // already at/past closest approach — evaluate now
  if (tCpa > CPA_HORIZON_MINUTES) return null; // CPA outside the short horizon

  // Projected separation at CPA.
  const cx = rx + rvx * tCpa;
  const cy = ry + rvy * tCpa;
  const cpaDistanceKm = Math.sqrt(cx * cx + cy * cy);

  // Criterion 1: CPA inside the STS threshold.
  if (cpaDistanceKm >= STS_CPA_THRESHOLD_KM) return null;

  // Closing speed (knots): magnitude of the relative velocity vector.
  const closingSpeedKnots = Math.sqrt(relSpeedSq) * (60 / KM_PER_NM);

  return {
    imoA: a.imo,
    imoB: b.imo,
    nameA: a.name,
    nameB: b.name,
    cpaDistanceKm,
    timeToCpaMinutes: tCpa,
    closingSpeedKnots,
    sanctionedParty,
  };
}

/**
 * Predict rendezvous across all unordered pairs of the supplied vessel tracks.
 * Pure computation — never emits alerts.
 */
export function predictAllPairs(vessels: VesselTrack[]): CpaPrediction[] {
  const predictions: CpaPrediction[] = [];
  for (let i = 0; i < vessels.length; i++) {
    for (let j = i + 1; j < vessels.length; j++) {
      const pred = predictPairCpa(vessels[i], vessels[j]);
      if (pred) predictions.push(pred);
    }
  }
  return predictions;
}

/** A confirmed rendezvous from the vessel_rendezvous ledger (ground truth). */
export interface RendezvousGroundTruth {
  imoA: string;
  imoB: string;
}

/** Precision/recall scorecard for a backtest run. */
export interface BacktestScore {
  predicted: number;
  actual: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
}

/** Order-independent pair key. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Score a set of CPA predictions against confirmed rendezvous (the reason the
 * vessel_rendezvous ledger exists). Matches on unordered IMO pairs and reports
 * precision/recall. This is the offline evaluation harness — it does not read
 * the DB itself; the caller supplies both sides so it stays pure and testable.
 *
 * @param predictions - Predicted rendezvous pairs from predictAllPairs
 * @param groundTruth - Confirmed rendezvous pairs from vessel_rendezvous
 * @returns Precision/recall scorecard
 */
export function backtestAgainstRendezvous(
  predictions: CpaPrediction[],
  groundTruth: RendezvousGroundTruth[]
): BacktestScore {
  const predictedKeys = new Set(predictions.map((p) => pairKey(p.imoA, p.imoB)));
  const truthKeys = new Set(groundTruth.map((g) => pairKey(g.imoA, g.imoB)));

  let truePositives = 0;
  for (const k of predictedKeys) {
    if (truthKeys.has(k)) truePositives++;
  }
  const falsePositives = predictedKeys.size - truePositives;
  const falseNegatives = truthKeys.size - truePositives;

  const precision = predictedKeys.size > 0 ? truePositives / predictedKeys.size : 0;
  const recall = truthKeys.size > 0 ? truePositives / truthKeys.size : 0;

  return {
    predicted: predictedKeys.size,
    actual: truthKeys.size,
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
  };
}
