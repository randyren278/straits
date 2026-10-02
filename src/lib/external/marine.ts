import { readBoundedJson } from './bounded-json';

export const MARINE_SOURCE = {
  id: 'open-meteo-marine',
  name: 'Open-Meteo Marine API',
  url: 'https://open-meteo.com/en/docs/marine-weather-api',
  attribution: 'Weather data by Open-Meteo.com',
  license: 'CC BY 4.0 for non-commercial use on the free API',
  licenseUrl: 'https://open-meteo.com/en/terms',
  expectedLag: 'Hourly forecast; valid time is included on each point.',
} as const;

export const MARINE_REGIONS = {
  hormuz: { latitude: 26.0, longitude: 56.0 },
  suez: { latitude: 30.5, longitude: 32.3 },
  babel_mandeb: { latitude: 12.6, longitude: 43.3 },
  gulf_of_aden: { latitude: 12.5, longitude: 48.5 },
} as const;

export type MarineRegion = keyof typeof MARINE_REGIONS;

export interface MarineForecastPoint {
  validAt: string;
  waveHeightM: number;
  currentVelocityKmh: number;
  currentDirectionDeg: number | null;
  forecast: true;
}

export interface MarineSnapshot {
  status: 'available';
  source: typeof MARINE_SOURCE;
  region: MarineRegion;
  point: typeof MARINE_REGIONS[MarineRegion];
  fetchedAt: string;
  forecast: MarineForecastPoint;
}

export class MarineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarineError';
  }
}

const MAX_RESPONSE_BYTES = 128 * 1024;
const MAX_FORECAST_DISTANCE_MS = 2 * 60 * 60 * 1000;
type Fetcher = typeof fetch;

interface MarineResponse {
  timezone?: unknown;
  hourly_units?: {
    time?: unknown;
    wave_height?: unknown;
    ocean_current_velocity?: unknown;
    ocean_current_direction?: unknown;
  };
  hourly?: {
    time?: unknown;
    wave_height?: unknown;
    ocean_current_velocity?: unknown;
    ocean_current_direction?: unknown;
  };
}

function parseNullableNumber(value: unknown, label: string, min: number, max = Number.POSITIVE_INFINITY): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new MarineError(`Open-Meteo marine returned invalid ${label}`);
  }
  return value;
}

/** Fetch hourly marine forecasts at one fixed, public-safe point per region. */
export async function fetchMarineForecast(
  region: MarineRegion,
  fetcher: Fetcher = fetch,
  now = new Date(),
): Promise<MarineSnapshot> {
  const point = MARINE_REGIONS[region];
  const url = new URL('https://marine-api.open-meteo.com/v1/marine');
  url.search = new URLSearchParams({
    latitude: String(point.latitude),
    longitude: String(point.longitude),
    hourly: 'wave_height,ocean_current_velocity,ocean_current_direction',
    forecast_days: '1',
    timezone: 'GMT',
  }).toString();

  let response: Response;
  try {
    response = await fetcher(url.toString(), {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 3_600 },
    });
  } catch {
    throw new MarineError('Open-Meteo marine request failed or timed out');
  }
  if (!response.ok) throw new MarineError(`Open-Meteo marine returned HTTP ${response.status}`);

  let payload: MarineResponse;
  try {
    const parsed = await readBoundedJson(response, MAX_RESPONSE_BYTES);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    payload = parsed as MarineResponse;
  } catch (error) {
    if (error instanceof Error && error.message === 'Upstream response exceeded the size limit') {
      throw new MarineError(error.message);
    }
    throw new MarineError('Open-Meteo marine returned invalid JSON');
  }

  const hourly = payload.hourly;
  const units = payload.hourly_units;
  if (payload.timezone !== 'GMT' || units?.time !== 'iso8601' || units.wave_height !== 'm' ||
      units.ocean_current_velocity !== 'km/h' || units.ocean_current_direction !== '°') {
    throw new MarineError('Open-Meteo marine returned unexpected timezone or units');
  }
  const times = hourly?.time;
  const waveHeights = hourly?.wave_height;
  const currentVelocities = hourly?.ocean_current_velocity;
  const currentDirections = hourly?.ocean_current_direction;
  if (!Array.isArray(times) || !Array.isArray(waveHeights) || !Array.isArray(currentVelocities) ||
      !Array.isArray(currentDirections) || times.length === 0 ||
      waveHeights.length !== times.length || currentVelocities.length !== times.length ||
      currentDirections.length !== times.length) {
    throw new MarineError('Open-Meteo marine response has invalid hourly arrays');
  }

  const nowMs = now.getTime();
  const candidates = times.flatMap((time, index) => {
    if (typeof time !== 'string') return [];
    const validAtMs = Date.parse(time.endsWith('Z') ? time : `${time}Z`);
    const waveHeightM = parseNullableNumber(waveHeights[index], 'wave height', 0);
    const currentVelocityKmh = parseNullableNumber(currentVelocities[index], 'current speed', 0);
    const currentDirectionDeg = parseNullableNumber(currentDirections[index], 'current direction', 0, 360);
    if (!Number.isFinite(validAtMs) || waveHeightM === null || currentVelocityKmh === null) return [];
    return [{
      validAt: new Date(validAtMs).toISOString(),
      validAtMs,
      waveHeightM,
      currentVelocityKmh,
      currentDirectionDeg,
    }];
  });
  candidates.sort((a, b) => Math.abs(a.validAtMs - nowMs) - Math.abs(b.validAtMs - nowMs));
  const nearest = candidates[0];
  if (!nearest) throw new MarineError('Open-Meteo marine has no valid wave/current forecast point');
  if (Math.abs(nearest.validAtMs - nowMs) > MAX_FORECAST_DISTANCE_MS) {
    throw new MarineError('Open-Meteo marine forecast is outside the 2-hour window');
  }

  return {
    status: 'available',
    source: MARINE_SOURCE,
    region,
    point,
    fetchedAt: now.toISOString(),
    forecast: {
      validAt: nearest.validAt,
      waveHeightM: nearest.waveHeightM,
      currentVelocityKmh: nearest.currentVelocityKmh,
      currentDirectionDeg: nearest.currentDirectionDeg,
      forecast: true,
    },
  };
}
