/**
 * Nav-Status Suppression Tests
 *
 * Verifies that a FRESH declared "at anchor" (1) or "moored" (5) nav_status
 * suppresses loitering false positives, while a null or stale status does not.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database pool and anomaly functions
vi.mock('../db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../db/anomalies', () => ({
  upsertAnomaliesBatch: vi.fn(),
}));

import { pool } from '../db';
import { upsertAnomaliesBatch } from '../db/anomalies';
import { detectLoitering, shouldSuppressForNavStatus } from './loitering';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockUpsertAnomaliesBatch = upsertAnomaliesBatch as ReturnType<typeof vi.fn>;

// A tight cluster of positions well away from any anchorage (open water in the
// central Arabian Sea) that would normally trigger loitering.
const OPEN_WATER = { lat: 15.0, lon: 62.0 };
const loiteringPositions = [
  { lat: OPEN_WATER.lat, lon: OPEN_WATER.lon, time: new Date() },
  { lat: OPEN_WATER.lat + 0.001, lon: OPEN_WATER.lon, time: new Date() },
  { lat: OPEN_WATER.lat, lon: OPEN_WATER.lon + 0.001, time: new Date() },
];

function rows(latestNavStatus: number | null, latestTime: Date) {
  return {
    rows: [
      {
        imo: '1234567',
        mmsi: '999000111',
        positions: loiteringPositions,
        latestNavStatus,
        latestTime: latestTime.toISOString(),
      },
    ],
  };
}

describe('shouldSuppressForNavStatus', () => {
  it('suppresses fresh at-anchor status', () => {
    expect(shouldSuppressForNavStatus(1, 5)).toBe(true);
  });

  it('suppresses fresh moored status', () => {
    expect(shouldSuppressForNavStatus(5, 0)).toBe(true);
  });

  it('does not suppress when status is null', () => {
    expect(shouldSuppressForNavStatus(null, 1)).toBe(false);
  });

  it('does not suppress stale anchored status', () => {
    expect(shouldSuppressForNavStatus(1, 60)).toBe(false);
  });

  it('does not suppress under-way status', () => {
    expect(shouldSuppressForNavStatus(0, 1)).toBe(false);
  });
});

describe('detectLoitering nav_status suppression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT flag loitering when vessel is at anchor with a FRESH position', async () => {
    mockQuery.mockResolvedValue(rows(1, new Date())); // nav_status 1, fresh
    const count = await detectLoitering();
    expect(count).toBe(0);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledWith([]);
  });

  it('DOES flag loitering when nav_status is null', async () => {
    mockQuery.mockResolvedValue(rows(null, new Date()));
    const count = await detectLoitering();
    expect(count).toBe(1);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledWith([
      expect.objectContaining({ anomalyType: 'loitering' }),
    ]);
  });

  it('DOES flag loitering when anchored status is stale', async () => {
    const staleTime = new Date(Date.now() - 60 * 60 * 1000); // 60 minutes old
    mockQuery.mockResolvedValue(rows(1, staleTime));
    const count = await detectLoitering();
    expect(count).toBe(1);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledWith([
      expect.objectContaining({ anomalyType: 'loitering' }),
    ]);
  });
});
