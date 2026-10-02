import { isCanaryEnabled } from '@/lib/canary';
import { fetchMarineForecast, MARINE_REGIONS, MARINE_SOURCE, type MarineRegion, type MarineSnapshot } from '@/lib/external/marine';
import { fetchPortWatch, PORTWATCH_CHOKEPOINT_IDS, PORTWATCH_SOURCE, type PortWatchRegion, type PortWatchSnapshot } from '@/lib/external/portwatch';

export type ContextRegion = MarineRegion;

export interface PortWatchUnavailable {
  status: 'unavailable';
  source: typeof PORTWATCH_SOURCE;
  region: PortWatchRegion;
  chokepointId: string;
  attemptedAt: string;
  latestSourceDate: null;
  sourceLagDays: null;
  stale: null;
  rows: null;
  error: string;
}

export interface PortWatchNotApplicable {
  status: 'not_applicable';
  source: typeof PORTWATCH_SOURCE;
  region: 'gulf_of_aden';
  attemptedAt: string;
  reason: string;
}

export interface MarineUnavailable {
  status: 'unavailable';
  source: typeof MARINE_SOURCE;
  region: MarineRegion;
  point: typeof MARINE_REGIONS[MarineRegion];
  attemptedAt: string;
  forecast: null;
  error: string;
}

export interface RegionContext {
  region: ContextRegion;
  generatedAt: string;
  sources: {
    portwatch: PortWatchSnapshot | PortWatchUnavailable | PortWatchNotApplicable;
    marine: MarineSnapshot | MarineUnavailable;
  };
}

export class RegionContextDisabledError extends Error {
  constructor() {
    super('Region context is available only on canary deployments');
    this.name = 'RegionContextDisabledError';
  }
}

const PORTWATCH_REGIONS = new Set<PortWatchRegion>(['hormuz', 'suez', 'babel_mandeb']);

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'request failed';
}

/** Load optional regional sources without allowing one failure to hide the other. */
export async function loadRegionContext(region: ContextRegion): Promise<RegionContext> {
  if (!isCanaryEnabled()) throw new RegionContextDisabledError();

  const generatedAt = new Date().toISOString();
  const portWatchRegion = PORTWATCH_REGIONS.has(region as PortWatchRegion)
    ? (region as PortWatchRegion)
    : null;

  const [portwatch, marine] = await Promise.all([
    portWatchRegion
      ? fetchPortWatch(portWatchRegion).catch((error): PortWatchUnavailable => ({
          status: 'unavailable',
          source: PORTWATCH_SOURCE,
          region: portWatchRegion,
          chokepointId: PORTWATCH_CHOKEPOINT_IDS[portWatchRegion],
          attemptedAt: generatedAt,
          latestSourceDate: null,
          sourceLagDays: null,
          stale: null,
          rows: null,
          error: `IMF PortWatch: ${errorText(error)}`,
        }))
      : Promise.resolve<PortWatchNotApplicable>({
          status: 'not_applicable',
          source: PORTWATCH_SOURCE,
          region: 'gulf_of_aden',
          attemptedAt: generatedAt,
          reason: 'No separate PortWatch chokepoint series for Gulf of Aden.',
        }),
    fetchMarineForecast(region).catch((error): MarineUnavailable => ({
      status: 'unavailable',
      source: MARINE_SOURCE,
      region,
      point: MARINE_REGIONS[region],
      attemptedAt: generatedAt,
      forecast: null,
      error: `Open-Meteo marine: ${errorText(error)}`,
    })),
  ]);

  return { region, generatedAt, sources: { portwatch, marine } };
}
