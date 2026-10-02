import { parseClaim } from '@/lib/investigations/claims';
import type { ClaimEvaluation, InvestigationRegion, InvestigationWindow } from '@/lib/investigations/claims';
import type { InvestigationEvidence } from '@/lib/investigations/evidence';

export interface StoryRequestInput {
  region: InvestigationRegion;
  window: InvestigationWindow;
  claimText: string;
  annotation: string;
}

export interface InvestigationStorySnapshot {
  version: 1;
  region: InvestigationRegion;
  window: InvestigationWindow;
  claim: { id: string; text: string; normalized: string; description: string };
  annotation: string;
  evaluation: ClaimEvaluation;
  evidence: InvestigationEvidence;
  sources: Array<{ name: string; records: string; timestamp: string | null; url?: string | null; attribution?: string | null; licenseUrl?: string | null }>;
}

export interface InvestigationStoryRecord {
  id: string;
  createdAt: string;
  snapshot: InvestigationStorySnapshot;
}

export class StoryRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryRequestError';
  }
}

const REGIONS = new Set<InvestigationRegion>(['hormuz', 'suez', 'babel_mandeb', 'gulf_of_aden']);
const WINDOWS = new Set<InvestigationWindow>(['24h', '7d']);
const ALLOWED_FIELDS = new Set(['region', 'window', 'claim', 'annotation']);

function claimMatchesRegion(region: InvestigationRegion, claimId: string | null): boolean {
  if (claimId === 'hormuz-stopped') return region === 'hormuz';
  if (claimId === 'suez-disruption') return region === 'suez';
  return claimId === 'regional-activity';
}

export function parseStoryRequest(input: unknown): StoryRequestInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new StoryRequestError('Request body must be an object.');
  }
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !ALLOWED_FIELDS.has(key))) {
    throw new StoryRequestError('Only region, window, claim, and annotation are accepted.');
  }
  if (typeof value.region !== 'string' || !REGIONS.has(value.region as InvestigationRegion)) {
    throw new StoryRequestError('Choose a supported region.');
  }
  if (typeof value.window !== 'string' || !WINDOWS.has(value.window as InvestigationWindow)) {
    throw new StoryRequestError('Window must be 24h or 7d.');
  }
  if (typeof value.claim !== 'string' || value.claim.trim().length < 1 || value.claim.length > 180) {
    throw new StoryRequestError('Claim must contain 1 to 180 characters.');
  }
  if (value.annotation !== undefined && (typeof value.annotation !== 'string' || value.annotation.length > 500)) {
    throw new StoryRequestError('Annotation must be 500 characters or fewer.');
  }
  const region = value.region as InvestigationRegion;
  const window = value.window as InvestigationWindow;
  const claim = parseClaim(value.claim);
  if (!claim.supported || !claim.id || !claimMatchesRegion(region, claim.id)) {
    throw new StoryRequestError('Use a supported claim for the selected region.');
  }
  return {
    region,
    window,
    claimText: claim.normalized,
    annotation: typeof value.annotation === 'string' ? value.annotation.trim() : '',
  };
}

export function isValidStoryId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export interface FollowBaseline {
  status: ClaimEvaluation['status'];
  contacts: number;
  completedPassages: number | null;
  coverage: InvestigationEvidence['coverage']['quality'];
}

export interface InvestigationFollow {
  key: string;
  region: InvestigationRegion;
  window: InvestigationWindow;
  claimText: string;
  baseline: FollowBaseline;
  savedAt: string;
}

export function followKey(region: InvestigationRegion, window: InvestigationWindow, claimText: string): string {
  return `${region}:${window}:${claimText.trim().toLowerCase()}`;
}

export function parseFollowList(value: string | null): InvestigationFollow[] {
  if (!value) return [];
  try {
    const entries: unknown = JSON.parse(value);
    if (!Array.isArray(entries)) return [];
    return entries.filter(isInvestigationFollow).slice(0, 50);
  } catch {
    return [];
  }
}

function isInvestigationFollow(value: unknown): value is InvestigationFollow {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<InvestigationFollow>;
  return REGIONS.has(entry.region as InvestigationRegion) &&
    WINDOWS.has(entry.window as InvestigationWindow) &&
    typeof entry.claimText === 'string' && entry.claimText.length > 0 && entry.claimText.length <= 180 &&
    typeof entry.key === 'string' && entry.key === followKey(entry.region as InvestigationRegion, entry.window as InvestigationWindow, entry.claimText) &&
    typeof entry.savedAt === 'string' &&
    !!entry.baseline && typeof entry.baseline === 'object' &&
    typeof entry.baseline.contacts === 'number' && Number.isFinite(entry.baseline.contacts) &&
    (entry.baseline.completedPassages === null || (typeof entry.baseline.completedPassages === 'number' && Number.isFinite(entry.baseline.completedPassages))) &&
    ['activity_observed', 'reduction_observed', 'no_clear_reduction', 'insufficient', 'unsupported'].includes(entry.baseline.status) &&
    ['recent', 'intermittent', 'insufficient', 'unavailable'].includes(entry.baseline.coverage);
}

export function getFollowBaseline(snapshot: Pick<InvestigationStorySnapshot, 'evaluation' | 'evidence'>): FollowBaseline {
  return {
    status: snapshot.evaluation.status,
    contacts: snapshot.evidence.activity.current.contacts,
    completedPassages: snapshot.evidence.passages?.current.completed ?? null,
    coverage: snapshot.evidence.coverage.quality,
  };
}

export function compareFollowBaseline(
  baseline: FollowBaseline,
  current: Pick<InvestigationStorySnapshot, 'evaluation' | 'evidence'>,
): { material: boolean; reasons: string[] } {
  const now = getFollowBaseline(current);
  const reasons: string[] = [];
  if (now.status !== baseline.status) reasons.push(`Assessment changed from ${baseline.status} to ${now.status}.`);
  if (now.coverage !== baseline.coverage) reasons.push(`Collection quality changed from ${baseline.coverage} to ${now.coverage}.`);
  if (isMaterialCountChange(baseline.contacts, now.contacts)) {
    reasons.push(`Observed contacts changed from ${baseline.contacts} to ${now.contacts}.`);
  }
  if (baseline.completedPassages !== null && now.completedPassages !== null && isMaterialCountChange(baseline.completedPassages, now.completedPassages)) {
    reasons.push(`Recorded completed passages changed from ${baseline.completedPassages} to ${now.completedPassages}.`);
  }
  return { material: reasons.length > 0, reasons };
}

function isMaterialCountChange(before: number, after: number): boolean {
  return before !== after && Math.abs(after - before) >= Math.max(3, Math.ceil(Math.abs(before) * 0.25));
}
