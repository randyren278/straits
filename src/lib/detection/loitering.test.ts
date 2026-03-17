/**
 * Loitering Detection Tests
 *
 * Tests for the loitering anomaly detection logic.
 * Loitering = vessel stays within 5nm radius for >6h outside anchorages.
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
  detectLoitering,
  calculateCentroid,
  isLoiteringBehavior,
  type Position,
} from './loitering';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockUpsertAnomaly = upsertAnomaly as ReturnType<typeof vi.fn>;

describe('calculateCentroid', () => {
  it('returns correct average for single position', () => {
    const positions: Position[] = [
      { lat: 25.0, lon: 55.0, time: new Date() },
    ];
    const centroid = calculateCentroid(positions);
    expect(centroid.lat).toBe(25.0);
    expect(centroid.lon).toBe(55.0);
  });

  it('returns correct average for multiple positions', () => {
    const positions: Position[] = [
      { lat: 25.0, lon: 55.0, time: new Date() },
      { lat: 26.0, lon: 56.0, time: new Date() },
      { lat: 27.0, lon: 57.0, time: new Date() },
    ];
    const centroid = calculateCentroid(positions);
    expect(centroid.lat).toBe(26.0);
    expect(centroid.lon).toBe(56.0);
  });

  it('handles negative coordinates correctly', () => {
    const positions: Position[] = [
      { lat: -10.0, lon: -20.0, time: new Date() },
      { lat: -20.0, lon: -40.0, time: new Date() },
    ];
    const centroid = calculateCentroid(positions);
    expect(centroid.lat).toBe(-15.0);
    expect(centroid.lon).toBe(-30.0);
  });
});

describe('isLoiteringBehavior', () => {
  it('returns true for positions within 5nm radius', () => {
    // 5nm = ~9.26km, these positions are close together
    const positions: Position[] = [
      { lat: 25.0, lon: 55.0, time: new Date() },
      { lat: 25.01, lon: 55.01, time: new Date() }, // ~1.5km away
      { lat: 25.02, lon: 55.02, time: new Date() }, // ~3km away
    ];
    expect(isLoiteringBehavior(positions)).toBe(true);
  });

  it('returns false for positions spread over large area', () => {
    // These positions span > 9.26km
    const positions: Position[] = [
      { lat: 25.0, lon: 55.0, time: new Date() },
      { lat: 25.5, lon: 55.5, time: new Date() }, // ~70km away
      { lat: 26.0, lon: 56.0, time: new Date() },
    ];
    expect(isLoiteringBehavior(positions)).toBe(false);
  });

  it('returns false for fewer than 3 positions', () => {
    const positions: Position[] = [
      { lat: 25.0, lon: 55.0, time: new Date() },
      { lat: 25.01, lon: 55.01, time: new Date() },
    ];
    expect(isLoiteringBehavior(positions)).toBe(false);
  });
});

describe('detectLoitering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries positions from last 6 hours for all vessels (no ship_type filter)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await detectLoitering();

    expect(mockQuery).toHaveBeenCalled();
    const query = mockQuery.mock.calls[0][0];
    expect(query).toContain("INTERVAL '6 hours'");
    expect(query).not.toContain('ship_type BETWEEN 80 AND 89');
  });

  it('does NOT exclude non-tanker vessel (ship_type 72 cargo) from query', async () => {
    // A cargo vessel (ship_type 72) loitering outside anchorage should be detected
    const mockCargoVessel = {
      imo: '6666666',
      mmsi: '666666666',
      positions: [
        { lat: 20.0, lon: 60.0, time: new Date() },
        { lat: 20.01, lon: 60.01, time: new Date() },
        { lat: 20.02, lon: 60.02, time: new Date() },
      ],
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockCargoVessel] });

    const count = await detectLoitering();

    expect(count).toBe(1);
    expect(mockUpsertAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        imo: '6666666',
        anomalyType: 'loitering',
      })
    );
  });

  it('creates loitering anomaly for vessel within 5nm radius outside anchorage', async () => {
    // Position outside any anchorage, clustered together
    const mockVessel = {
      imo: '1234567',
      mmsi: '123456789',
      positions: [
        { lat: 20.0, lon: 60.0, time: new Date() },
        { lat: 20.01, lon: 60.01, time: new Date() },
        { lat: 20.02, lon: 60.02, time: new Date() },
      ],
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockVessel] });

    const count = await detectLoitering();

    expect(count).toBe(1);
    expect(mockUpsertAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        imo: '1234567',
        anomalyType: 'loitering',
        confidence: 'confirmed',
        details: expect.objectContaining({
          durationHours: 6,
        }),
      })
    );
  });

  it('does NOT flag vessel in known anchorage area', async () => {
    // Position inside Fujairah anchorage (25.0-25.4, 56.2-56.7)
    const mockVessel = {
      imo: '7654321',
      mmsi: '987654321',
      positions: [
        { lat: 25.2, lon: 56.4, time: new Date() },
        { lat: 25.21, lon: 56.41, time: new Date() },
        { lat: 25.22, lon: 56.42, time: new Date() },
      ],
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockVessel] });

    const count = await detectLoitering();

    expect(count).toBe(0);
    expect(mockUpsertAnomaly).not.toHaveBeenCalled();
  });

  it('does NOT flag vessel with spread-out positions', async () => {
    // Positions spanning > 9.26km (not loitering)
    const mockVessel = {
      imo: '1111111',
      mmsi: '111111111',
      positions: [
        { lat: 20.0, lon: 60.0, time: new Date() },
        { lat: 20.5, lon: 60.5, time: new Date() },
        { lat: 21.0, lon: 61.0, time: new Date() },
      ],
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockVessel] });

    const count = await detectLoitering();

    expect(count).toBe(0);
    expect(mockUpsertAnomaly).not.toHaveBeenCalled();
  });

  it('skips vessels with fewer than 3 positions', async () => {
    const mockVessel = {
      imo: '2222222',
      mmsi: '222222222',
      positions: [
        { lat: 20.0, lon: 60.0, time: new Date() },
        { lat: 20.01, lon: 60.01, time: new Date() },
      ],
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockVessel] });

    const count = await detectLoitering();

    expect(count).toBe(0);
    expect(mockUpsertAnomaly).not.toHaveBeenCalled();
  });

  it('returns count of loitering anomalies detected', async () => {
    const mockVessels = [
      {
        imo: '1111111',
        mmsi: '111111111',
        positions: [
          { lat: 20.0, lon: 60.0, time: new Date() },
          { lat: 20.01, lon: 60.01, time: new Date() },
          { lat: 20.02, lon: 60.02, time: new Date() },
        ],
      },
      {
        imo: '2222222',
        mmsi: '222222222',
        positions: [
          { lat: 21.0, lon: 61.0, time: new Date() },
          { lat: 21.01, lon: 61.01, time: new Date() },
          { lat: 21.02, lon: 61.02, time: new Date() },
        ],
      },
    ];

    mockQuery.mockResolvedValueOnce({ rows: mockVessels });

    const count = await detectLoitering();

    expect(count).toBe(2);
    expect(mockUpsertAnomaly).toHaveBeenCalledTimes(2);
  });
});

// Anchorage integration tests
describe('anchorage integration', () => {
  it('correctly identifies Fujairah as anchorage', () => {
    expect(isInAnchorage(25.2, 56.4)).toBe(true);
  });

  it('correctly identifies Kharg Island as anchorage', () => {
    expect(isInAnchorage(29.25, 50.3)).toBe(true);
  });

  it('returns false for open water outside anchorages', () => {
    expect(isInAnchorage(20.0, 60.0)).toBe(false);
  });
});
