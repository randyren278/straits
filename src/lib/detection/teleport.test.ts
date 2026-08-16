/**
 * Teleport (Spoofed Position) Detection Tests
 *
 * Verifies the kinematic teleport detector flags physically impossible
 * implied speeds (>50 knots) and leaves normal transits untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
import {
  detectTeleport,
  impliedSpeedKnots,
  detectSpoofedPositions,
  type TimedPosition,
} from './teleport';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockUpsertAnomaliesBatch = upsertAnomaliesBatch as ReturnType<typeof vi.fn>;

describe('impliedSpeedKnots', () => {
  it('returns 0 for non-positive time delta', () => {
    const a: TimedPosition = { lat: 25, lon: 55, time: new Date('2026-01-01T00:00:00Z') };
    const b: TimedPosition = { lat: 26, lon: 56, time: new Date('2026-01-01T00:00:00Z') };
    expect(impliedSpeedKnots(a, b)).toBe(0);
  });
});

describe('detectTeleport', () => {
  it('flags a >50kt implied-speed jump as spoofed_position', () => {
    // ~111 km north (1 deg latitude) in 6 minutes → ~600 kn implied speed
    const positions: TimedPosition[] = [
      { lat: 25.0, lon: 55.0, time: new Date('2026-01-01T00:00:00Z') },
      { lat: 26.0, lon: 55.0, time: new Date('2026-01-01T00:06:00Z') },
    ];
    const result = detectTeleport(positions);
    expect(result).not.toBeNull();
    expect(result!.impliedSpeedKnots).toBeGreaterThan(50);
    expect(result!.from).toEqual({ lat: 25.0, lon: 55.0 });
    expect(result!.to).toEqual({ lat: 26.0, lon: 55.0 });
  });

  it('does not flag a normal 12kt transit', () => {
    // 12 kn for 1 hour ≈ 22.2 km ≈ 0.2 deg latitude
    const positions: TimedPosition[] = [
      { lat: 25.0, lon: 55.0, time: new Date('2026-01-01T00:00:00Z') },
      { lat: 25.2, lon: 55.0, time: new Date('2026-01-01T01:00:00Z') },
    ];
    const result = detectTeleport(positions);
    expect(result).toBeNull();
  });

  it('returns null for fewer than two positions', () => {
    const positions: TimedPosition[] = [
      { lat: 25.0, lon: 55.0, time: new Date('2026-01-01T00:00:00Z') },
    ];
    expect(detectTeleport(positions)).toBeNull();
  });

  it('reports the worst jump across multiple pairs', () => {
    const positions: TimedPosition[] = [
      { lat: 25.0, lon: 55.0, time: new Date('2026-01-01T00:00:00Z') },
      { lat: 25.1, lon: 55.0, time: new Date('2026-01-01T00:30:00Z') }, // normal
      { lat: 30.0, lon: 55.0, time: new Date('2026-01-01T00:36:00Z') }, // teleport
    ];
    const result = detectTeleport(positions);
    expect(result).not.toBeNull();
    expect(result!.to).toEqual({ lat: 30.0, lon: 55.0 });
  });
});

describe('detectSpoofedPositions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const teleportRow = (imo: string) => ({
    imo,
    positions: [
      { lat: 25.0, lon: 55.0, time: '2026-01-01T00:00:00Z' },
      { lat: 26.0, lon: 55.0, time: '2026-01-01T00:06:00Z' }, // ~600kn jump
    ],
  });

  const normalRow = (imo: string) => ({
    imo,
    positions: [
      { lat: 25.0, lon: 55.0, time: '2026-01-01T00:00:00Z' },
      { lat: 25.2, lon: 55.0, time: '2026-01-01T01:00:00Z' }, // ~12kn, normal
    ],
  });

  it('does nothing and upserts an empty batch when no vessel teleports', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [normalRow('1111111')] });

    const count = await detectSpoofedPositions();

    expect(count).toBe(0);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledWith([]);
  });

  it('batches all teleporting vessels into a single upsertAnomaliesBatch call, not one per vessel', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [teleportRow('1111111'), normalRow('2222222'), teleportRow('3333333')],
    });

    const count = await detectSpoofedPositions();

    expect(count).toBe(2);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledTimes(1);
    const batch = mockUpsertAnomaliesBatch.mock.calls[0][0];
    expect(batch).toHaveLength(2);
    expect(batch).toEqual([
      expect.objectContaining({ imo: '1111111', anomalyType: 'spoofed_position' }),
      expect.objectContaining({ imo: '3333333', anomalyType: 'spoofed_position' }),
    ]);
  });
});
