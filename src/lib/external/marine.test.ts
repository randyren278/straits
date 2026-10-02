import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMarineForecast, MARINE_REGIONS, MARINE_SOURCE } from './marine';

const NOW = new Date('2026-10-02T05:39:20.000Z');

function response(hourly: Record<string, unknown>): Response {
  return new Response(JSON.stringify({
    timezone: 'GMT',
    hourly_units: {
      time: 'iso8601',
      wave_height: 'm',
      ocean_current_velocity: 'km/h',
      ocean_current_direction: '°',
    },
    hourly,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchMarineForecast', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses fixed coordinates and returns the nearest valid point explicitly labeled as forecast', async () => {
    fetchMock.mockResolvedValue(response({
      time: ['2026-10-02T04:00', '2026-10-02T06:00', '2026-10-02T07:00'],
      wave_height: [0.7, 0.4, null],
      ocean_current_velocity: [2.0, 1.2, 0.8],
      ocean_current_direction: [180, 220, 240],
    }));

    const result = await fetchMarineForecast('hormuz', fetchMock, NOW);

    expect(result).toEqual({
      status: 'available',
      source: MARINE_SOURCE,
      region: 'hormuz',
      point: MARINE_REGIONS.hormuz,
      fetchedAt: NOW.toISOString(),
      forecast: {
        validAt: '2026-10-02T06:00:00.000Z',
        waveHeightM: 0.4,
        currentVelocityKmh: 1.2,
        currentDirectionDeg: 220,
        forecast: true,
      },
    });

    const [requestUrl, init] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(requestUrl as string);
    expect(parsedUrl.searchParams.get('latitude')).toBe('26');
    expect(parsedUrl.searchParams.get('longitude')).toBe('56');
    expect(parsedUrl.searchParams.get('forecast_days')).toBe('1');
    expect(parsedUrl.searchParams.get('timezone')).toBe('GMT');
    expect(parsedUrl.searchParams.get('hourly')).toContain('wave_height');
    expect((init as RequestInit & { next: { revalidate: number } }).next.revalidate).toBe(3600);
  });

  it('supports the Gulf of Aden marine point and chooses a point with real wave and current values', async () => {
    fetchMock.mockResolvedValue(response({
      time: ['2026-10-02T05:00', '2026-10-02T06:00'],
      wave_height: [null, 0.5],
      ocean_current_velocity: [1.1, 0.9],
      ocean_current_direction: [null, null],
    }));

    await expect(fetchMarineForecast('gulf_of_aden', fetchMock, NOW)).resolves.toMatchObject({
      region: 'gulf_of_aden',
      point: MARINE_REGIONS.gulf_of_aden,
      forecast: { validAt: '2026-10-02T06:00:00.000Z', currentDirectionDeg: null, forecast: true },
    });
  });

  it('rejects invalid arrays and responses with no valid forecast point', async () => {
    fetchMock.mockResolvedValue(response({ time: ['2026-10-02T05:00'], wave_height: [0.4] }));
    await expect(fetchMarineForecast('suez', fetchMock, NOW)).rejects.toThrow('invalid hourly arrays');

    fetchMock.mockResolvedValue(response({
      time: ['2026-10-02T05:00'], wave_height: [null], ocean_current_velocity: [0.3], ocean_current_direction: [0],
    }));
    await expect(fetchMarineForecast('suez', fetchMock, NOW)).rejects.toThrow('no valid wave/current');
  });

  it('rejects stale forecasts, unexpected units, and invalid physical ranges', async () => {
    fetchMock.mockResolvedValue(response({
      time: ['2026-10-02T09:00'],
      wave_height: [0.4],
      ocean_current_velocity: [0.3],
      ocean_current_direction: [0],
    }));
    await expect(fetchMarineForecast('suez', fetchMock, NOW)).rejects.toThrow('outside the 2-hour window');

    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      timezone: 'GMT',
      hourly_units: { time: 'iso8601', wave_height: 'ft', ocean_current_velocity: 'km/h', ocean_current_direction: '°' },
      hourly: { time: ['2026-10-02T06:00'], wave_height: [0.4], ocean_current_velocity: [0.3], ocean_current_direction: [0] },
    })));
    await expect(fetchMarineForecast('suez', fetchMock, NOW)).rejects.toThrow('unexpected timezone or units');

    for (const [wave, speed, direction] of [[-0.1, 0.3, 0], [0.1, -0.1, 0], [0.1, 0.3, 361]]) {
      fetchMock.mockResolvedValue(response({
        time: ['2026-10-02T06:00'], wave_height: [wave],
        ocean_current_velocity: [speed], ocean_current_direction: [direction],
      }));
      await expect(fetchMarineForecast('suez', fetchMock, NOW)).rejects.toThrow('invalid');
    }
  });

  it('rejects oversized, malformed, and non-success responses', async () => {
    fetchMock.mockResolvedValue(new Response(' '.repeat(128 * 1024 + 1)));
    await expect(fetchMarineForecast('suez', fetchMock, NOW)).rejects.toThrow('exceeded the size limit');

    fetchMock.mockResolvedValue(new Response('not json'));
    await expect(fetchMarineForecast('suez', fetchMock, NOW)).rejects.toThrow('invalid JSON');

    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(fetchMarineForecast('suez', fetchMock, NOW)).rejects.toThrow('HTTP 503');
  });
});
