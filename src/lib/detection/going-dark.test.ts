/**
 * Going Dark Detection Tests
 *
 * Tests for the AIS gap detection logic.
 * Going dark = vessel stops transmitting in a coverage zone for >2h.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isInCoverageZone, getCoverageZone } from './coverage-zones';

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

// Import after mocks are set up
import { pool } from '../db';
import { upsertAnomaly, resolveAnomaly } from '../db/anomalies';
import {
  detectGoingDark,
  determineConfidence,
  shouldFlagAsGoingDark,
  type GapCandidate,
} from './going-dark';

describe('determineConfidence', () => {
  it('returns "suspected" for gap between 120-240 minutes', () => {
    expect(determineConfidence(120)).toBe('suspected');
    expect(determineConfidence(180)).toBe('suspected');
    expect(determineConfidence(239)).toBe('suspected');
  });

  it('returns "confirmed" for gap >= 240 minutes (4 hours)', () => {
    expect(determineConfidence(240)).toBe('confirmed');
    expect(determineConfidence(300)).toBe('confirmed');
    expect(determineConfidence(480)).toBe('confirmed');
  });
});

describe('shouldFlagAsGoingDark', () => {
  it('returns true for vessel in coverage zone with gap >= 120 min', () => {
    // Persian Gulf coordinates
    const result = shouldFlagAsGoingDark(26.0, 51.0, 150);
    expect(result).toBe(true);
  });

  it('returns false for vessel outside coverage zone', () => {
    // Open ocean - Arabian Sea
    const result = shouldFlagAsGoingDark(15.0, 60.0, 300);
    expect(result).toBe(false);
  });

  it('returns false for vessel with gap < 120 min even in coverage zone', () => {
    // Persian Gulf coordinates but short gap
    const result = shouldFlagAsGoingDark(26.0, 51.0, 90);
    expect(result).toBe(false);
  });
});

describe('detectGoingDark', () => {
  const mockQuery = pool.query as ReturnType<typeof vi.fn>;
  const mockUpsertAnomaly = upsertAnomaly as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries vessels with >2h gap that are tankers', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // resolve query

    await detectGoingDark();

    expect(mockQuery).toHaveBeenCalled();
    const query = mockQuery.mock.calls[0][0];
    expect(query).toContain('INTERVAL');
    expect(query).toContain('2 hours');
    expect(query).toContain('ship_type BETWEEN 80 AND 89');
  });

  it('creates suspected anomaly for vessel with 2-4h gap in coverage zone', async () => {
    const mockVessel: GapCandidate = {
      imo: '1234567',
      lastSeen: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      lastLat: 26.0, // Persian Gulf
      lastLon: 51.0,
      gapMinutes: 180,
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockVessel] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // resolve query

    const count = await detectGoingDark();

    expect(count).toBe(1);
    expect(mockUpsertAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        imo: '1234567',
        anomalyType: 'going_dark',
        confidence: 'suspected',
        details: expect.objectContaining({
          gapMinutes: 180,
          coverageZone: 'persian_gulf',
        }),
      })
    );
  });

  it('creates confirmed anomaly for vessel with >4h gap in coverage zone', async () => {
    const mockVessel: GapCandidate = {
      imo: '7654321',
      lastSeen: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      lastLat: 27.0, // Red Sea North
      lastLon: 35.0,
      gapMinutes: 300,
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockVessel] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // resolve query

    const count = await detectGoingDark();

    expect(count).toBe(1);
    expect(mockUpsertAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        imo: '7654321',
        anomalyType: 'going_dark',
        confidence: 'confirmed',
      })
    );
  });

  it('does NOT flag vessel outside coverage zone even with large gap', async () => {
    const mockVessel: GapCandidate = {
      imo: '9999999',
      lastSeen: new Date(Date.now() - 10 * 60 * 60 * 1000), // 10 hours ago
      lastLat: 10.0, // Arabian Sea - outside coverage
      lastLon: 65.0,
      gapMinutes: 600,
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockVessel] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // resolve query

    const count = await detectGoingDark();

    expect(count).toBe(0);
    expect(mockUpsertAnomaly).not.toHaveBeenCalled();
  });

  it('resolves anomalies for vessels that have reported back recently', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // resolve query

    await detectGoingDark();

    // Second query should be the resolve anomalies update
    const resolveQuery = mockQuery.mock.calls[1][0];
    expect(resolveQuery).toContain('resolved_at = NOW()');
    expect(resolveQuery).toContain('going_dark');
    expect(resolveQuery).toContain('30 minutes');
  });

  it('returns count of anomalies detected', async () => {
    const mockVessels: GapCandidate[] = [
      { imo: '1111111', lastSeen: new Date(), lastLat: 26.0, lastLon: 51.0, gapMinutes: 150 },
      { imo: '2222222', lastSeen: new Date(), lastLat: 27.0, lastLon: 52.0, gapMinutes: 200 },
      { imo: '3333333', lastSeen: new Date(), lastLat: 10.0, lastLon: 65.0, gapMinutes: 300 }, // outside coverage
    ];

    mockQuery.mockResolvedValueOnce({ rows: mockVessels });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // resolve query

    const count = await detectGoingDark();

    expect(count).toBe(2); // 2 in coverage zone, 1 outside
  });
});

// Coverage zone integration tests (use actual coverage-zones module)
describe('coverage zone integration', () => {
  it('correctly identifies Persian Gulf as coverage zone', () => {
    expect(isInCoverageZone(26.0, 51.0)).toBe(true);
    expect(getCoverageZone(26.0, 51.0)?.id).toBe('persian_gulf');
  });

  it('correctly identifies Red Sea North as coverage zone', () => {
    expect(isInCoverageZone(25.0, 36.0)).toBe(true);
    expect(getCoverageZone(25.0, 36.0)?.id).toBe('red_sea_north');
  });

  it('returns null for open ocean outside coverage zones', () => {
    expect(isInCoverageZone(10.0, 65.0)).toBe(false);
    expect(getCoverageZone(10.0, 65.0)).toBeNull();
  });
});
