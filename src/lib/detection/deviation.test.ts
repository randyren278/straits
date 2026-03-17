/**
 * Deviation and Speed Anomaly Detection Tests
 *
 * Tests for route deviation and speed anomaly detection.
 * Speed anomaly = tanker moving <3 knots outside anchorage.
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
}));

import { pool } from '../db';
import { upsertAnomaly } from '../db/anomalies';
import {
  detectSpeedAnomaly,
  isSpeedAnomaly,
  detectDeviation,
} from './deviation';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockUpsertAnomaly = upsertAnomaly as ReturnType<typeof vi.fn>;

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

describe('detectDeviation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 (stub for v1 - destination parsing needed)', async () => {
    const count = await detectDeviation();
    expect(count).toBe(0);
  });
});
