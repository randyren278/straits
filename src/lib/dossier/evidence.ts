/**
 * Dossier evidence — pure helpers that turn a vessel's scattered records into
 * one chronological trail, plus a one-line statement of why the contact
 * matters. Client-safe; no I/O.
 *
 * The trail keeps three things visibly distinct:
 *   observed  — a fact from the AIS feed (a fix, a destination change)
 *   detector  — a conclusion a detector drew (an anomaly, with its confidence)
 *   reference — an external listing (a sanctions designation)
 */
import { ANOMALY_TYPE_LABELS, type AnomalyType, type Confidence } from '@/types/anomaly';
import { formatAnomalyDetails } from '@/lib/anomaly/format-details';
import { riskCategoryLabel } from '@/lib/sanctions/labels';

export type EvidenceSource = 'observed' | 'detector' | 'reference';

export interface EvidenceEvent {
  id: string;
  at: Date;
  source: EvidenceSource;
  title: string;
  detail: string | null;
  /** Detector confidence, when the event is a detector conclusion. */
  confidence?: Confidence;
  /** Map focus for this event when the record carries a position. */
  location: { lat: number; lon: number } | null;
  /** Anomaly type for badge rendering. */
  anomalyType?: AnomalyType;
  resolvedAt?: Date | null;
}

export interface AnomalyRecord {
  id: number;
  anomalyType: string;
  confidence: string;
  detectedAt: string | Date;
  resolvedAt: string | Date | null;
  details: Record<string, unknown> | null;
}

export interface DestinationChangeRecord {
  id: number;
  previousDestination: string;
  newDestination: string;
  changedAt: string | Date;
}

export interface SanctionSummary {
  authority: string | null;
  riskCategory: string | null;
  listDate?: string | Date | null;
}

export interface EvidenceInput {
  anomalies: AnomalyRecord[];
  destinationChanges: DestinationChangeRecord[];
  sanction: SanctionSummary | null;
  latestFix: { time: Date | string | null; lat: number; lon: number } | null;
}

/** Pull a map focus out of an anomaly's details JSON where one exists. */
export function anomalyLocation(
  type: string,
  details: Record<string, unknown> | null | undefined,
): { lat: number; lon: number } | null {
  if (!details) return null;
  const d = details as Record<string, unknown>;
  const pick = (v: unknown) => {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.lat === 'number' && typeof o.lon === 'number') return { lat: o.lat, lon: o.lon };
    }
    return null;
  };
  // Older and demo records store the latest position as flat fields. They are
  // still observed coordinates and should remain focusable in the evidence
  // trail even though current detectors use the typed shapes below.
  const legacy = typeof d.lastLat === 'number' && typeof d.lastLon === 'number'
    ? { lat: d.lastLat, lon: d.lastLon }
    : null;
  switch (type) {
    case 'going_dark':
    case 'speed':
    case 'repeat_going_dark':
      return pick(d.lastPosition) ?? legacy;
    case 'loitering':
      return pick(d.centroid) ?? legacy;
    case 'sts_transfer':
    case 'sts_predicted':
      return typeof d.lat === 'number' && typeof d.lon === 'number' ? { lat: d.lat, lon: d.lon } : null;
    case 'spoofed_position':
      return pick(d.to) ?? pick(d.lastPosition) ?? legacy;
    default:
      return legacy;
  }
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Build the chronological trail, newest first. */
export function buildEvidenceTrail(input: EvidenceInput): EvidenceEvent[] {
  const events: EvidenceEvent[] = [];

  if (input.latestFix) {
    const at = toDate(input.latestFix.time);
    if (at) {
      events.push({
        id: 'fix',
        at,
        source: 'observed',
        title: 'Latest AIS fix',
        detail: `${input.latestFix.lat.toFixed(3)}, ${input.latestFix.lon.toFixed(3)}`,
        location: { lat: input.latestFix.lat, lon: input.latestFix.lon },
      });
    }
  }

  for (const a of input.anomalies) {
    const at = toDate(a.detectedAt);
    if (!at) continue;
    const type = a.anomalyType as AnomalyType;
    events.push({
      id: `anomaly-${a.id}`,
      at,
      source: 'detector',
      title: ANOMALY_TYPE_LABELS[type] ?? a.anomalyType.replace(/_/g, ' '),
      detail: formatAnomalyDetails(type, a.details),
      confidence: (a.confidence as Confidence) || 'unknown',
      location: anomalyLocation(a.anomalyType, a.details),
      anomalyType: type,
      resolvedAt: toDate(a.resolvedAt),
    });
  }

  for (const dc of input.destinationChanges) {
    const at = toDate(dc.changedAt);
    if (!at) continue;
    events.push({
      id: `dest-${dc.id}`,
      at,
      source: 'observed',
      title: 'Destination changed',
      detail: `${dc.previousDestination || '—'} → ${dc.newDestination || '—'}`,
      location: null,
    });
  }

  if (input.sanction) {
    const at = toDate(input.sanction.listDate);
    if (at) {
      const cat = riskCategoryLabel(input.sanction.riskCategory);
      events.push({
        id: 'sanction',
        at,
        source: 'reference',
        title: `${cat.label} listing`,
        detail: input.sanction.authority ?? cat.meaning,
        location: null,
      });
    }
  }

  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export interface WhyInput {
  isSanctioned: boolean;
  sanctionRiskCategory: string | null;
  anomalyType: string | null;
  anomalyConfidence: string | null;
  riskScore: number | null;
  activeAnomalyCount: number;
  associateCount: number;
  sanctionedAssociateCount: number;
  fixAgeHours: number | null;
}

/**
 * One or two clauses, most important first. Returns null when there is
 * nothing to say — an unremarkable contact should not get invented drama.
 */
export function whyItMatters(w: WhyInput): string | null {
  const clauses: string[] = [];

  if (w.isSanctioned) {
    const cat = riskCategoryLabel(w.sanctionRiskCategory);
    clauses.push(cat.label === 'Listed' ? 'On a maritime watch list' : `${cat.label} hull`);
  }

  if (w.anomalyType) {
    const label = ANOMALY_TYPE_LABELS[w.anomalyType as AnomalyType] ?? w.anomalyType.replace(/_/g, ' ');
    const conf = w.anomalyConfidence === 'confirmed' ? 'confirmed' : w.anomalyConfidence === 'suspected' ? 'suspected' : null;
    const extra = w.activeAnomalyCount > 1 ? ` (+${w.activeAnomalyCount - 1} more active)` : '';
    clauses.push(`${label.toLowerCase()}${conf ? ` · ${conf}` : ''}${extra}`);
  }

  if (w.sanctionedAssociateCount > 0) {
    clauses.push(`met ${w.sanctionedAssociateCount} sanctioned vessel${w.sanctionedAssociateCount === 1 ? '' : 's'} at sea`);
  } else if (w.associateCount > 0 && clauses.length === 0) {
    clauses.push(`${w.associateCount} recorded rendezvous`);
  }

  if (w.riskScore !== null && w.riskScore >= 40 && clauses.length === 0) {
    clauses.push(`risk score ${w.riskScore}`);
  }

  if (w.fixAgeHours !== null && w.fixAgeHours >= 24 && clauses.length > 0) {
    clauses.push(`last seen ${Math.round(w.fixAgeHours / 24)}d ago`);
  }

  if (clauses.length === 0) return null;
  const s = clauses.slice(0, 3).join(' · ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
