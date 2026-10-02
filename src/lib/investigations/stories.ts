import { evaluateClaim, parseClaim } from '@/lib/investigations/claims';
import { loadInvestigationEvidence } from '@/lib/investigations/evidence';
import type { StoryRequestInput, InvestigationStorySnapshot } from './story-model';
import { StoryRequestError } from './story-model';

function claimMatchesRegion(region: StoryRequestInput['region'], claimId: string | null): boolean {
  if (claimId === 'hormuz-stopped') return region === 'hormuz';
  if (claimId === 'suez-disruption') return region === 'suez';
  return claimId === 'regional-activity';
}

export async function buildStorySnapshot(input: StoryRequestInput): Promise<InvestigationStorySnapshot> {
  const claim = parseClaim(input.claimText);
  if (!claim.supported || !claim.id || !claimMatchesRegion(input.region, claim.id)) {
    throw new StoryRequestError('Use a supported claim for the selected region.');
  }
  const evidence = await loadInvestigationEvidence(input.region, input.window);
  const evaluation = evaluateClaim(
    claim,
    evidence.activity.current,
    evidence.activity.previous,
    evidence.coverage.quality,
    input.region === 'suez' ? evidence.passages ?? undefined : undefined,
    evidence.coverage.historicalDays ? {
      currentDays: evidence.coverage.historicalDays.current,
      previousDays: evidence.coverage.historicalDays.previous,
      expectedDays: evidence.coverage.historicalDays.expected,
    } : undefined,
  );
  const sources: InvestigationStorySnapshot['sources'] = [
    {
      name: 'Straits AIS observations',
      records: input.window === '24h'
        ? 'Position records in the selected region during the current and previous 24-hour windows.'
        : 'Distinct MMSIs by UTC day in the selected region, with latest position records for the current seven complete days.',
      timestamp: evidence.generatedAt,
    },
    {
      name: 'Collection quality',
      records: 'Regional collection buckets used to describe recency and continuity; gaps are not treated as vessel absence.',
      timestamp: evidence.coverage.latestFix,
    },
  ];

  if (input.region === 'suez') {
    sources.push({
      name: 'Suez crossing aggregate',
      records: 'Recorded gate-to-gate AIS crossings. Missing daily aggregates are not counted as zero.',
      timestamp: evidence.passages?.current.latestComputedAt ?? null,
    });
  }

  const portwatch = evidence.context?.sources.portwatch;
  if (portwatch) {
    const records = 'rows' in portwatch
      ? `${portwatch.status}: ${portwatch.rows?.length ?? 0} daily rows from ${portwatch.source.name}.`
      : `${portwatch.status}: ${portwatch.reason}`;
    sources.push({
      name: portwatch.source.name,
      records,
      timestamp: 'latestSourceDate' in portwatch ? portwatch.latestSourceDate : portwatch.attemptedAt,
      url: portwatch.source.url,
      attribution: portwatch.source.attribution,
      licenseUrl: portwatch.source.licenseUrl,
    });
  }

  const marine = evidence.context?.sources.marine;
  if (marine) {
    const records = 'forecast' in marine && marine.forecast
      ? `Point forecast: ${marine.forecast.waveHeightM} m wave height and ${marine.forecast.currentVelocityKmh} km/h current.`
      : `${marine.status}: no valid point forecast in this snapshot.`;
    const timestamp = 'forecast' in marine && marine.forecast
      ? marine.forecast.validAt
      : 'fetchedAt' in marine && typeof marine.fetchedAt === 'string'
        ? marine.fetchedAt
        : 'attemptedAt' in marine && typeof marine.attemptedAt === 'string'
          ? marine.attemptedAt
          : null;
    sources.push({
      name: marine.source.name,
      records,
      timestamp,
      url: marine.source.url,
      attribution: marine.source.attribution,
      licenseUrl: marine.source.licenseUrl,
    });
  }

  return {
    version: 1,
    region: input.region,
    window: input.window,
    claim: { id: claim.id, text: input.claimText, normalized: claim.normalized, description: claim.description },
    annotation: input.annotation,
    evaluation,
    evidence,
    sources,
  };
}
