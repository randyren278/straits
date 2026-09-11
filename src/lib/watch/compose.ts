/**
 * Current watch — pure composition.
 *
 * Takes raw facts (newest events, per-zone traffic, per-zone freshness) and
 * picks the three observations most worth a visitor's first twenty seconds:
 *   1. a contact with a newly detected event
 *   2. a region whose traffic moved meaningfully
 *   3. a coverage gap that should temper the other two
 *
 * No I/O here; the DB side lives in current-watch.ts so this can be tested
 * against hand-built inputs.
 */
import { ANOMALY_TYPE_LABELS, type AnomalyType } from '@/types/anomaly';
import { riskCategoryLabel } from '@/lib/sanctions/labels';

export type WatchKind = 'event' | 'traffic' | 'coverage';

export interface WatchTarget {
  lat: number;
  lon: number;
  zoom: number;
  /** When set, the dashboard also opens this vessel's dossier. */
  imo?: string | null;
  /** Chokepoint id, when the observation is about a zone. */
  chokepoint?: string;
}

export interface WatchItem {
  kind: WatchKind;
  title: string;
  detail: string;
  /** The observed number(s) the claim rests on, in the reader's units. */
  evidence: string;
  at: string;
  target: WatchTarget | null;
  tone: 'alert' | 'warn' | 'info';
}

export interface EventFact {
  imo: string;
  mmsi: string | null;
  name: string | null;
  anomalyType: string;
  confidence: string;
  detectedAt: Date;
  isSanctioned: boolean;
  sanctionRiskCategory: string | null;
  riskScore: number | null;
  lat: number | null;
  lon: number | null;
}

export interface ZoneTrafficFact {
  chokepoint: string;
  name: string;
  center: { lat: number; lon: number };
  /** Distinct vessels observed in the latest 24h. */
  recent: number;
  /** Distinct vessels observed in the 24h before that. */
  previous: number;
  /** SPC z-score of today's throughput vs the 30d baseline, when available. */
  z: number | null;
}

export interface ZoneCoverageFact {
  chokepoint: string;
  name: string;
  center: { lat: number; lon: number };
  /** Newest fix in the zone within the staleness window, or null. */
  lastFix: Date | null;
}

export interface WatchInput {
  now: Date;
  events: EventFact[];
  traffic: ZoneTrafficFact[];
  coverage: ZoneCoverageFact[];
  /** Newest fix anywhere in the feed. */
  feedLastFix: Date | null;
}

/** Minimum baseline before a percentage change is worth reporting. */
const MIN_BASELINE = 10;
/** Relative change that counts as "meaningful". */
const MIN_CHANGE = 0.25;
/** Zone silence that counts as a gap. Matches /api/status "degraded". */
const GAP_MINUTES = 60;

function ageLabel(from: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/**
 * Rank events: sanctioned hulls first, then confirmed over suspected, then
 * newest. A contact with identity *and* activity is the strongest lead.
 */
export function pickEvent(events: EventFact[], now: Date): WatchItem | null {
  if (events.length === 0) return null;
  const score = (e: EventFact) =>
    (e.isSanctioned ? 100 : 0) +
    (e.confidence === 'confirmed' ? 50 : e.confidence === 'suspected' ? 20 : 0) +
    Math.min(30, (e.riskScore ?? 0) / 3) -
    Math.min(40, (now.getTime() - e.detectedAt.getTime()) / 3_600_000);
  const best = [...events].sort((a, b) => score(b) - score(a))[0];

  const label = ANOMALY_TYPE_LABELS[best.anomalyType as AnomalyType] ?? best.anomalyType.replace(/_/g, ' ');
  const identity = best.isSanctioned ? `${riskCategoryLabel(best.sanctionRiskCategory).label} hull · ` : '';
  const conf = best.confidence === 'confirmed' || best.confidence === 'suspected' ? best.confidence : 'unconfirmed';

  return {
    kind: 'event',
    title: `${best.name ?? `IMO ${best.imo}`} — ${label.toLowerCase()}`,
    detail: `${identity}${conf} · detected ${ageLabel(best.detectedAt, now)} ago`,
    evidence: best.riskScore !== null ? `risk ${best.riskScore}` : `IMO ${best.imo}`,
    at: best.detectedAt.toISOString(),
    target: best.lat !== null && best.lon !== null
      ? { lat: best.lat, lon: best.lon, zoom: 9, imo: best.imo }
      : { lat: 0, lon: 0, zoom: 0, imo: best.imo },
    tone: best.isSanctioned || best.confidence === 'confirmed' ? 'alert' : 'warn',
  };
}

/** Largest meaningful 24h-over-24h change; SPC z reported when available. */
export function pickTraffic(traffic: ZoneTrafficFact[], now: Date): WatchItem | null {
  let best: { zone: ZoneTrafficFact; change: number } | null = null;
  for (const zone of traffic) {
    if (zone.previous < MIN_BASELINE && zone.recent < MIN_BASELINE) continue;
    // A percentage increase from zero is undefined. Give an emerged stream a
    // bounded ranking value and describe it with counts below instead of
    // manufacturing a 3,100% headline from 0 → 31 contacts.
    const change = zone.previous === 0 ? 1 : (zone.recent - zone.previous) / zone.previous;
    if (Math.abs(change) < MIN_CHANGE) continue;
    if (!best || Math.abs(change) > Math.abs(best.change)) best = { zone, change };
  }
  if (!best) return null;

  const pct = Math.round(best.change * 100);
  const dir = pct > 0 ? 'up' : 'down';
  const z = best.zone.z !== null ? ` · SPC z ${best.zone.z >= 0 ? '+' : ''}${best.zone.z.toFixed(1)}` : '';
  const title = best.zone.previous === 0
    ? `${best.zone.name} — traffic emerged`
    : `${best.zone.name} — traffic ${dir} ${Math.abs(pct)}%`;
  return {
    kind: 'traffic',
    title,
    detail: `${best.zone.recent} vessels in the last 24h vs ${best.zone.previous} the day before${z}`,
    evidence: `${best.zone.previous} → ${best.zone.recent}`,
    at: now.toISOString(),
    target: { lat: best.zone.center.lat, lon: best.zone.center.lon, zoom: 8, chokepoint: best.zone.chokepoint },
    tone: best.zone.z !== null && best.zone.z <= -2 ? 'alert' : 'warn',
  };
}

/** The most serious silence: whole feed first, then the stalest zone. */
export function pickCoverage(coverage: ZoneCoverageFact[], feedLastFix: Date | null, now: Date): WatchItem | null {
  const feedAge = feedLastFix ? (now.getTime() - feedLastFix.getTime()) / 60000 : Infinity;
  if (feedAge > GAP_MINUTES) {
    return {
      kind: 'coverage',
      title: 'AIS feed silent',
      detail: feedLastFix
        ? `No fixes received for ${ageLabel(feedLastFix, now)}. Positions on the map are last-known, not live.`
        : 'No fixes received. Positions on the map are last-known, not live.',
      evidence: feedLastFix ? `last fix ${feedLastFix.toISOString().slice(11, 16)}Z` : 'no fixes',
      at: (feedLastFix ?? now).toISOString(),
      target: null,
      tone: 'alert',
    };
  }

  let stalest: ZoneCoverageFact | null = null;
  for (const zone of coverage) {
    const age = zone.lastFix ? (now.getTime() - zone.lastFix.getTime()) / 60000 : Infinity;
    if (age <= GAP_MINUTES) continue;
    const bestAge = stalest?.lastFix ? (now.getTime() - stalest.lastFix.getTime()) / 60000 : stalest ? Infinity : -1;
    if (!stalest || age > bestAge) stalest = zone;
  }
  if (!stalest) return null;

  return {
    kind: 'coverage',
    title: `${stalest.name} — no recent contacts`,
    detail: stalest.lastFix
      ? `Last fix in the zone ${ageLabel(stalest.lastFix, now)} ago while the feed is live elsewhere. Treat counts here as stale.`
      : 'No fixes in the zone this week while the feed is live elsewhere. Treat "no traffic" here as "not observed".',
    evidence: stalest.lastFix ? `last fix ${ageLabel(stalest.lastFix, now)} ago` : 'no fixes · 7d',
    at: (stalest.lastFix ?? now).toISOString(),
    target: { lat: stalest.center.lat, lon: stalest.center.lon, zoom: 8, chokepoint: stalest.chokepoint },
    tone: 'warn',
  };
}

export function composeWatch(input: WatchInput): WatchItem[] {
  const items: WatchItem[] = [];
  const event = pickEvent(input.events, input.now);
  const traffic = pickTraffic(input.traffic, input.now);
  const coverage = pickCoverage(input.coverage, input.feedLastFix, input.now);
  if (event) items.push(event);
  if (traffic) items.push(traffic);
  if (coverage) items.push(coverage);
  return items;
}
