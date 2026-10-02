import { NextRequest, NextResponse } from 'next/server';
import { isCanaryEnabled } from '@/lib/canary';
import { evaluateClaim, parseClaim, type InvestigationRegion, type InvestigationWindow } from '@/lib/investigations/claims';
import { loadInvestigationEvidence } from '@/lib/investigations/evidence';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REGIONS = new Set<InvestigationRegion>(['hormuz', 'suez', 'babel_mandeb', 'gulf_of_aden']);
const WINDOWS = new Set<InvestigationWindow>(['24h', '7d']);
const DEFAULT_PROMPT: Record<InvestigationRegion, string> = {
  hormuz: 'Hormuz traffic stopped',
  suez: 'Suez disruption',
  babel_mandeb: 'Are vessels being observed?',
  gulf_of_aden: 'Are vessels being observed?',
};

function regionMatchesClaim(region: InvestigationRegion, claimId: string | null): boolean {
  if (claimId === 'hormuz-stopped') return region === 'hormuz';
  if (claimId === 'suez-disruption') return region === 'suez';
  if (claimId === 'regional-activity') return true;
  return false;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ region: string }> }) {
  if (!isCanaryEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { region: rawRegion } = await params;
  if (!REGIONS.has(rawRegion as InvestigationRegion)) {
    return NextResponse.json({ error: 'Unknown investigation region' }, { status: 404 });
  }
  const region = rawRegion as InvestigationRegion;
  const rawWindow = request.nextUrl.searchParams.get('window') ?? '24h';
  if (!WINDOWS.has(rawWindow as InvestigationWindow)) {
    return NextResponse.json({ error: 'window must be 24h or 7d' }, { status: 400 });
  }
  const window = rawWindow as InvestigationWindow;
  const rawClaim = request.nextUrl.searchParams.get('claim') ?? DEFAULT_PROMPT[region];
  if (rawClaim.length > 180) {
    return NextResponse.json({ error: 'claim must be 180 characters or fewer' }, { status: 400 });
  }

  const claim = parseClaim(rawClaim);
  if (!claim.supported || !claim.id || !regionMatchesClaim(region, claim.id)) {
    const unsupported = claim.supported
      ? { ...claim, id: null, supported: false, description: 'That check is only available for its matching region.' }
      : claim;
    return NextResponse.json({
      region, window, claim: unsupported,
      evaluation: evaluateClaim(unsupported, {
        contacts: 0, fixes: null, latestFix: null, startsAt: '', endsAt: '', label: window,
        observedDays: null, expectedDays: null,
      }, {
        contacts: 0, fixes: null, latestFix: null, startsAt: '', endsAt: '', label: window,
        observedDays: null, expectedDays: null,
      }, 'unavailable'),
      evidence: null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const evidence = await loadInvestigationEvidence(region, window);
    const evaluation = evaluateClaim(
      claim,
      evidence.activity.current,
      evidence.activity.previous,
      evidence.coverage.quality,
      region === 'suez' ? evidence.passages ?? undefined : undefined,
      evidence.coverage.historicalDays ? {
        currentDays: evidence.coverage.historicalDays.current,
        previousDays: evidence.coverage.historicalDays.previous,
        expectedDays: evidence.coverage.historicalDays.expected,
      } : undefined,
    );
    return NextResponse.json({ region, window, claim, evaluation, evidence }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[investigations] evidence query failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Investigation evidence is temporarily unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
