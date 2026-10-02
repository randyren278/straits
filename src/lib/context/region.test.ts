import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRegionContext, RegionContextDisabledError } from './region';

vi.mock('@/lib/external/portwatch', () => ({
  fetchPortWatch: vi.fn(),
  PORTWATCH_CHOKEPOINT_IDS: { hormuz: 'chokepoint6', suez: 'chokepoint1', babel_mandeb: 'chokepoint4' },
  PORTWATCH_SOURCE: {
    id: 'imf-portwatch', name: 'IMF PortWatch', url: 'https://portwatch.imf.org/',
    attribution: 'Sources: UN Global Platform; IMF PortWatch (portwatch.imf.org).',
    licenseUrl: 'https://www.imf.org/external/terms.htm', staleAfterDays: 7,
  },
}));
vi.mock('@/lib/external/marine', () => ({
  fetchMarineForecast: vi.fn(),
  MARINE_REGIONS: {
    hormuz: { latitude: 26, longitude: 56 }, suez: { latitude: 30.5, longitude: 32.3 },
    babel_mandeb: { latitude: 12.6, longitude: 43.3 }, gulf_of_aden: { latitude: 12.5, longitude: 48.5 },
  },
  MARINE_SOURCE: {
    id: 'open-meteo-marine', name: 'Open-Meteo Marine API',
    url: 'https://open-meteo.com/en/docs/marine-weather-api', attribution: 'Weather data by Open-Meteo.com',
    license: 'CC BY 4.0 for non-commercial use on the free API', licenseUrl: 'https://open-meteo.com/en/terms',
    expectedLag: 'Hourly forecast; valid time is included on each point.',
  },
}));

describe('loadRegionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRAITS_CANARY', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('retains independent source results and provenance when one source fails', async () => {
    const { fetchPortWatch } = await import('@/lib/external/portwatch');
    const { fetchMarineForecast } = await import('@/lib/external/marine');
    vi.mocked(fetchPortWatch).mockRejectedValue(new Error('request timed out'));
    vi.mocked(fetchMarineForecast).mockResolvedValue({
      status: 'available', source: { id: 'open-meteo-marine' }, region: 'hormuz',
    } as never);

    const result = await loadRegionContext('hormuz');

    expect(result.sources.portwatch).toMatchObject({
      status: 'unavailable', source: { id: 'imf-portwatch', licenseUrl: 'https://www.imf.org/external/terms.htm' },
      latestSourceDate: null, rows: null, attemptedAt: result.generatedAt, error: 'IMF PortWatch: request timed out',
    });
    expect(result.sources.marine.status).toBe('available');
  });

  it('preserves a valid empty PortWatch result and marks Gulf of Aden not applicable', async () => {
    const { fetchPortWatch } = await import('@/lib/external/portwatch');
    const { fetchMarineForecast } = await import('@/lib/external/marine');
    vi.mocked(fetchPortWatch).mockResolvedValue({ status: 'empty', rows: [] } as never);
    vi.mocked(fetchMarineForecast).mockResolvedValue({ status: 'available' } as never);

    const hormuz = await loadRegionContext('hormuz');
    expect(hormuz.sources.portwatch.status).toBe('empty');

    const gulf = await loadRegionContext('gulf_of_aden');
    expect(gulf.sources.portwatch).toMatchObject({
      status: 'not_applicable', source: { id: 'imf-portwatch', licenseUrl: 'https://www.imf.org/external/terms.htm' },
      region: 'gulf_of_aden',
    });
    expect(fetchPortWatch).toHaveBeenCalledTimes(1);
    expect(fetchMarineForecast).toHaveBeenCalledWith('hormuz');
    expect(fetchMarineForecast).toHaveBeenLastCalledWith('gulf_of_aden');
  });

  it('blocks server-side use outside canary even when directly imported', async () => {
    vi.stubEnv('STRAITS_CANARY', '0');
    await expect(loadRegionContext('hormuz')).rejects.toBeInstanceOf(RegionContextDisabledError);
  });
});
