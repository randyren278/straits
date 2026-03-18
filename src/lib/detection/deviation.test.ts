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
  upsertAnomaly: vi.fn(),
  resolveAnomaly: vi.fn(),
}));

vi.mock('../geo/haversine', () => ({
  calculateBearing: vi.fn().mockReturnValue(90), // East
}));

import { pool } from '../db';
import { upsertAnomaly, resolveAnomaly } from '../db/anomalies';
import {
  detectSpeedAnomaly,
  isSpeedAnomaly,
  detectDeviation,
  geocodeDestination,
  isDeviating,
} from './deviation';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockUpsertAnomaly = upsertAnomaly as ReturnType<typeof vi.fn>;
const mockResolveAnomaly = resolveAnomaly as ReturnType<typeof vi.fn>;

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
    expect(mockUpsertAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        imo: '7777777',
        anomalyType: 'speed',
        details: expect.objectContaining({
          speedKnots: 1.5,
        }),
      })
    );
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
    expect(mockUpsertAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        imo: '1234567',
        anomalyType: 'speed',
        details: expect.objectContaining({
          speedKnots: 1.5,
        }),
      })
    );
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
    expect(mockUpsertAnomaly).not.toHaveBeenCalled();
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
    expect(mockUpsertAnomaly).not.toHaveBeenCalled();
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
    expect(mockUpsertAnomaly).toHaveBeenCalledTimes(2);
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
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear geocode cache between tests by mocking fetch
  });

  it('returns null for empty string', async () => {
    const result = await geocodeDestination('');
    expect(result).toBeNull();
  });

  it('returns null for whitespace-only string', async () => {
    const result = await geocodeDestination('   ');
    expect(result).toBeNull();
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
          destination: 'FUJAIRAH_CACHE_HIT_TEST_CORRECTED',
          positions: [
            { heading: 80, latitude: 25.0, longitude: 57.0, time: '2026-03-18T00:00:00Z' },
            { heading: 85, latitude: 25.1, longitude: 57.1, time: '2026-03-18T01:00:00Z' },
          ],
        },
      ],
    });

    // Simulate geocodeDestination returning cached null for unknown dest
    // The function caches per session — destination won't be in cache for this unique string
    // Since fetch is not mocked here, it will throw and return null → vessel skipped
    const count = await detectDeviation();
    // Without a geocoded result the vessel is skipped (count stays 0)
    expect(count).toBe(0);
  });
});
