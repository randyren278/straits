/**
 * Deviation and Speed Anomaly Detection Tests
 *
 * Tests for route deviation and speed anomaly detection.
 * Speed anomaly = tanker moving <3 knots outside anchorage.
 * Route deviation = vessel heading >45° from declared destination for 2+ hours.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isInAnchorage } from '../geo/anchorages';

// Mock the database pool and anomaly functions
vi.mock('../db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../db/anomalies', () => ({
  upsertAnomaliesBatch: vi.fn(),
  resolveAnomaliesBatch: vi.fn(),
}));

vi.mock('../geo/haversine', () => ({
  calculateBearing: vi.fn().mockReturnValue(90), // East
}));

import { pool } from '../db';
import { upsertAnomaliesBatch, resolveAnomaliesBatch } from '../db/anomalies';
import {
  detectSpeedAnomaly,
  isSpeedAnomaly,
  detectDeviation,
  geocodeDestination,
  isDeviating,
} from './deviation';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockUpsertAnomaliesBatch = upsertAnomaliesBatch as ReturnType<typeof vi.fn>;
const mockResolveAnomaliesBatch = resolveAnomaliesBatch as ReturnType<typeof vi.fn>;

describe('isSpeedAnomaly', () => {
  it('returns true for tanker <3 knots outside anchorage', () => {
    // Outside anchorage, very slow
    expect(isSpeedAnomaly(2.5, 20.0, 60.0)).toBe(true);
  });

  it('returns false for tanker <3 knots inside anchorage', () => {
    // Fujairah anchorage - slow is normal
    expect(isSpeedAnomaly(2.5, 25.2, 56.4)).toBe(false);
  });

  it('returns false for tanker >= 3 knots anywhere', () => {
    // Normal speed
    expect(isSpeedAnomaly(5.0, 20.0, 60.0)).toBe(false);
    expect(isSpeedAnomaly(10.0, 25.2, 56.4)).toBe(false);
  });

  it('returns true for tanker at 0 knots outside anchorage', () => {
    // Dead in water
    expect(isSpeedAnomaly(0, 20.0, 60.0)).toBe(true);
  });
});

describe('detectSpeedAnomaly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries all vessels with recent positions (no ship_type filter)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await detectSpeedAnomaly();

    expect(mockQuery).toHaveBeenCalled();
    const query = mockQuery.mock.calls[0][0];
    expect(query).not.toContain('ship_type BETWEEN 80 AND 89');
  });

  it('does NOT exclude non-tanker vessel (ship_type 72 cargo) from query', async () => {
    // A cargo vessel moving slowly outside anchorage should be detected
    const mockCargoVessel = {
      imo: '7777777',
      speed: 1.5,
      latitude: 20.0,
      longitude: 60.0,
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockCargoVessel] });

    const count = await detectSpeedAnomaly();

    expect(count).toBe(1);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        imo: '7777777',
        anomalyType: 'speed',
        details: expect.objectContaining({
          speedKnots: 1.5,
        }),
      }),
    ]);
  });

  it('creates speed anomaly for slow tanker outside anchorage', async () => {
    const mockVessel = {
      imo: '1234567',
      speed: 1.5,
      latitude: 20.0,
      longitude: 60.0,
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockVessel] });

    const count = await detectSpeedAnomaly();

    expect(count).toBe(1);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        imo: '1234567',
        anomalyType: 'speed',
        details: expect.objectContaining({
          speedKnots: 1.5,
        }),
      }),
    ]);
  });

  it('does NOT flag slow tanker in anchorage', async () => {
    const mockVessel = {
      imo: '7654321',
      speed: 1.0,
      latitude: 25.2, // Fujairah anchorage
      longitude: 56.4,
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockVessel] });

    const count = await detectSpeedAnomaly();

    expect(count).toBe(0);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledWith([]);
  });

  it('does NOT flag normal speed tanker', async () => {
    const mockVessel = {
      imo: '9999999',
      speed: 12.0,
      latitude: 20.0,
      longitude: 60.0,
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockVessel] });

    const count = await detectSpeedAnomaly();

    expect(count).toBe(0);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledWith([]);
  });

  it('returns count of speed anomalies detected', async () => {
    const mockVessels = [
      { imo: '1111111', speed: 2.0, latitude: 20.0, longitude: 60.0 },
      { imo: '2222222', speed: 1.0, latitude: 21.0, longitude: 61.0 },
      { imo: '3333333', speed: 15.0, latitude: 22.0, longitude: 62.0 }, // normal speed
    ];

    mockQuery.mockResolvedValueOnce({ rows: mockVessels });

    const count = await detectSpeedAnomaly();

    expect(count).toBe(2);
    // N candidates -> 1 batch call, not N individual upsert calls
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledTimes(1);
    expect(mockUpsertAnomaliesBatch.mock.calls[0][0]).toHaveLength(2);
  });
});

describe('isDeviating', () => {
  it('returns true when heading is >45 degrees off expected', () => {
    expect(isDeviating(180, 10)).toBe(true); // 170 degrees apart
    expect(isDeviating(0, 90)).toBe(true);   // 90 degrees apart
  });

  it('returns false when heading is within 45 degrees of expected', () => {
    expect(isDeviating(30, 10)).toBe(false);  // 20 degrees apart
    expect(isDeviating(90, 90)).toBe(false);  // same heading
  });

  it('handles 0/360 wrap-around correctly', () => {
    // 10 and 350 are only 20 degrees apart via shortest arc
    expect(isDeviating(10, 350)).toBe(false);
    // 10 and 200 are 170 degrees apart
    expect(isDeviating(10, 200)).toBe(true);
  });
});

describe('geocodeDestination', () => {
  it('returns null for empty or whitespace-only strings', () => {
    expect(geocodeDestination('')).toBeNull();
    expect(geocodeDestination('   ')).toBeNull();
  });

  it('resolves offline from the port gazetteer — no network', () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn() as unknown as typeof fetch;
    expect(geocodeDestination('EGPSD')).toEqual({ lat: 31.26, lon: 32.3 });
    expect(geocodeDestination('FOR ORDERS')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});

describe('detectDeviation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when no vessels with recent positions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const count = await detectDeviation();
    expect(count).toBe(0);
  });

  it('resolves anomaly when vessel heading corrects (not all positions deviating)', async () => {
    // calculateBearing mocked to return 90 (east)
    // heading 80 is within 45 degrees of 90 — not deviating
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          imo: '1234567',
          destination: 'SEISMIC GUARD VESSEL',
          positions: [
            { heading: 80, latitude: 25.0, longitude: 57.0, time: '2026-03-18T00:00:00Z' },
            { heading: 85, latitude: 25.1, longitude: 57.1, time: '2026-03-18T01:00:00Z' },
          ],
        },
      ],
    });

    // An unresolvable destination skips the vessel entirely.
    const count = await detectDeviation();
    expect(count).toBe(0);
  });

  it('batches upserts and resolves instead of calling per-vessel', async () => {
    // calculateBearing mocked to always return 90 (east); heading 200 is
    // >45deg off — this vessel should be flagged as deviating.
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          imo: '2234567',
          destination: 'FUJAIRAH',
          positions: [
            { heading: 200, latitude: 25.0, longitude: 57.0, time: '2026-03-18T00:00:00Z' },
            { heading: 205, latitude: 25.1, longitude: 57.1, time: '2026-03-18T01:00:00Z' },
          ],
        },
      ],
    });

    const count = await detectDeviation();

    expect(count).toBe(1);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledTimes(1);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledWith([
      expect.objectContaining({ imo: '2234567', anomalyType: 'deviation' }),
    ]);
    expect(mockResolveAnomaliesBatch).toHaveBeenCalledTimes(1);
    expect(mockResolveAnomaliesBatch).toHaveBeenCalledWith([]);
  });

  it('collects corrected vessels into one resolveAnomaliesBatch call, not one resolveAnomaly per vessel', async () => {

    // heading 80/85 stay within 45deg of the mocked 90deg bearing — corrected.
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          imo: '3234567',
          destination: 'FUJAIRAH',
          positions: [
            { heading: 80, latitude: 25.0, longitude: 57.0, time: '2026-03-18T00:00:00Z' },
            { heading: 85, latitude: 25.1, longitude: 57.1, time: '2026-03-18T01:00:00Z' },
          ],
        },
        {
          imo: '4234567',
          destination: 'JEBEL ALI',
          positions: [
            { heading: 88, latitude: 26.0, longitude: 58.0, time: '2026-03-18T00:00:00Z' },
            { heading: 92, latitude: 26.1, longitude: 58.1, time: '2026-03-18T01:00:00Z' },
          ],
        },
      ],
    });

    const count = await detectDeviation();

    expect(count).toBe(0);
    expect(mockResolveAnomaliesBatch).toHaveBeenCalledTimes(1);
    expect(mockResolveAnomaliesBatch).toHaveBeenCalledWith([
      { imo: '3234567', anomalyType: 'deviation' },
      { imo: '4234567', anomalyType: 'deviation' },
    ]);
  });
});
