export type InvestigationRegion = 'hormuz' | 'suez' | 'babel_mandeb' | 'gulf_of_aden';
export type InvestigationWindow = '24h' | '7d';
export type ClaimId = 'hormuz-stopped' | 'suez-disruption' | 'regional-activity';
export type ClaimStatus = 'activity_observed' | 'reduction_observed' | 'no_clear_reduction' | 'insufficient' | 'unsupported';

export interface ParsedClaim {
  id: ClaimId | null;
  normalized: string;
  supported: boolean;
  description: string;
}

const NORMALIZE_SPACE = /\s+/g;
const HORMUZ_STOPPED = /^(?:(?:has|did|is|was)\s+)?(?:the\s+)?(?:strait\s+of\s+)?hormuz\s+(?:(?:ship|vessel)\s+)?traffic\s+(?:stopped|ceased|halted|shut down)\??$/i;
const SUEZ_DISRUPTION = /^(?:(?:is there|is|was there|was)\s+)?(?:a\s+)?suez(?: canal)?\s+(?:traffic\s+)?(?:disruption|disrupted|slower|reduced|stopped)\??$/i;
const REGIONAL_ACTIVITY = /^(?:are vessels being observed(?: in this region)?|any vessels observed(?: in this region)?|is vessel traffic observed(?: here)?)\??$/i;

export function parseClaim(text: string): ParsedClaim {
  const normalized = text.trim().replace(NORMALIZE_SPACE, ' ');
  if (HORMUZ_STOPPED.test(normalized)) {
    return { id: 'hormuz-stopped', normalized, supported: true, description: 'Inspect AIS contacts and what they can establish about passage status in the Strait of Hormuz.' };
  }
  if (SUEZ_DISRUPTION.test(normalized)) {
    return { id: 'suez-disruption', normalized, supported: true, description: 'Compare completed AIS-observed Suez passages with the preceding period.' };
  }
  if (REGIONAL_ACTIVITY.test(normalized)) {
    return { id: 'regional-activity', normalized, supported: true, description: 'Check whether vessel contacts were observed in the selected region.' };
  }
  return { id: null, normalized, supported: false, description: 'This wording is not covered by the current checks.' };
}

export interface ActivityWindow {
  contacts: number;
  fixes: number | null;
  latestFix: string | null;
  startsAt: string;
  endsAt: string;
  label: string;
  observedDays: number | null;
  expectedDays: number | null;
}

export interface PassageWindow {
  completed: number;
  incomplete: number;
  waiting: number;
  daysWithData: number;
  daysExpected: number;
  latestComputedAt: string | null;
  label: string;
  startsAt: string;
  endsAt: string;
}

export interface ClaimEvaluation {
  status: ClaimStatus;
  headline: string;
  basis: string;
  observedQuantity: string;
}

export function evaluateClaim(
  claim: ParsedClaim,
  current: ActivityWindow,
  previous: ActivityWindow,
  quality: 'recent' | 'intermittent' | 'insufficient' | 'unavailable',
  passage?: { current: PassageWindow; previous: PassageWindow },
  historicalCoverage?: { currentDays: number; previousDays: number; expectedDays: number },
): ClaimEvaluation {
  if (!claim.supported || !claim.id) {
    return {
      status: 'unsupported',
      headline: 'Unsupported wording',
      basis: 'Only the listed, bounded checks are interpreted. Rephrase as one of the supported prompts.',
      observedQuantity: 'No evidence query run',
    };
  }

  if (claim.id === 'hormuz-stopped') {
    return {
      status: 'insufficient',
      headline: current.contacts > 0 ? 'AIS contacts were recorded; passage status is unverified' : 'No AIS contacts were recorded; closure status is unverified',
      basis: current.contacts > 0
        ? 'A vessel can transmit while anchored, so presence in the region does not prove that it passed through. This check has no validated Hormuz gate-to-gate passage model.'
        : `An empty AIS sample cannot establish that the strait is closed. Collection quality is ${quality}; a feed gap can look like silence.`,
      observedQuantity: `${current.contacts} distinct vessel contacts in ${current.label}`,
    };
  }

  if (claim.id === 'regional-activity') {
    if (current.contacts > 0) {
      return {
        status: 'activity_observed',
        headline: 'Vessel contacts were observed in this region',
        basis: 'This checks only whether AIS contacts were recorded in the selected region and time window. It does not count completed passages.',
        observedQuantity: `${current.contacts} distinct vessel contacts in ${current.label}`,
      };
    }
    return {
      status: 'insufficient',
      headline: 'No vessel contacts were observed in this window',
      basis: 'An empty AIS sample does not establish that vessels were absent. Check regional collection quality and feed recency.',
      observedQuantity: `0 distinct vessel contacts in ${current.label}`,
    };
  }

  if (!passage) {
    return {
      status: 'insufficient',
      headline: 'Passage comparison is unavailable',
      basis: 'The daily Suez crossing aggregate could not be read for this request.',
      observedQuantity: 'No passage comparison available',
    };
  }

  const { current: now, previous: before } = passage;
  const enoughDays = now.daysWithData === now.daysExpected &&
    before.daysWithData === before.daysExpected &&
    before.completed > 0 &&
    (now.daysExpected !== 7 || (
      historicalCoverage?.expectedDays === 7 &&
      historicalCoverage.currentDays === 7 &&
      historicalCoverage.previousDays === 7
    ));
  if (!enoughDays || quality === 'unavailable' || quality === 'insufficient') {
    return {
      status: 'insufficient',
      headline: 'Not enough complete records to assess a change',
      basis: 'Every expected UTC day needs a recorded crossing aggregate in both periods. Seven-day comparisons also require collection records for all seven days in each period. Missing days are not counted as zero; a zero baseline cannot show a relative reduction.',
      observedQuantity: `${now.completed} completed passages recorded in ${now.label}; ${before.completed} in ${before.label}`,
    };
  }

  const drop = before.completed > 0 ? (before.completed - now.completed) / before.completed : null;
  if (drop !== null && drop >= 0.4) {
    return {
      status: 'reduction_observed',
      headline: 'A reduction in recorded completed passages is visible',
      basis: 'A reduction means at least 40% fewer recorded crossings where both Suez gates were observed in order. It is an AIS-derived change signal, not a finding about cause, cargo volume, or canal operations.',
      observedQuantity: `${now.completed} completed passages recorded in ${now.label}, down ${Math.round(drop * 100)}% from ${before.completed} in ${before.label}`,
    };
  }
  return {
    status: 'no_clear_reduction',
    headline: 'No clear reduction appears in the available passage counts',
    basis: 'This compares recorded gate-to-gate AIS crossings; a reduction of at least 40% is the displayed signal threshold. It does not rule out delays or disruption outside the measured window.',
    observedQuantity: `${now.completed} completed passages recorded in ${now.label}; ${before.completed} in ${before.label}`,
  };
}
