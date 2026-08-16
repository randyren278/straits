/**
 * Destination-Flip Sequence Detector Tests
 *
 * Verifies that a destination flip followed by an evasion anomaly within the
 * window produces a composite_diversion, that a lone routine flip (no following
 * evasion → no joined rows) produces nothing, and that junk-destination
 * detection works.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database pool
vi.mock('@/lib/db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

// Mock anomaly upsert so we can assert what gets written
vi.mock('@/lib/db/anomalies', () => ({
  upsertAnomaliesBatch: vi.fn(),
}));

describe('isJunkDestination', () => {
  it('flags blank, generic, and non-alpha destinations', async () => {
    const { isJunkDestination } = await import('./destination-flip');
    expect(isJunkDestination(null)).toBe(true);
    expect(isJunkDestination('')).toBe(true);
    expect(isJunkDestination('   ')).toBe(true);
    expect(isJunkDestination('FOR ORDERS')).toBe(true);
    expect(isJunkDestination('UNKNOWN')).toBe(true);
    expect(isJunkDestination('---')).toBe(true);
    expect(isJunkDestination('12345')).toBe(true);
  });

  it('accepts real port names', async () => {
    const { isJunkDestination } = await import('./destination-flip');
    expect(isJunkDestination('Fujairah')).toBe(false);
    expect(isJunkDestination('Rotterdam')).toBe(false);
    expect(isJunkDestination('Singapore')).toBe(false);
  });
});

describe('detectCompositeDiversions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes composite_diversion when a flip is followed by going_dark', async () => {
    const { pool } = await import('@/lib/db');
    const { upsertAnomaliesBatch } = await import('@/lib/db/anomalies');

    const changedAt = new Date('2026-01-01T00:00:00Z');
    const followedAt = new Date('2026-01-01T06:00:00Z');

    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          imo: '9111111',
          previous_destination: 'Fujairah',
          new_destination: 'FOR ORDERS',
          changed_at: changedAt,
          followed_by: 'going_dark',
          followed_at: followedAt,
          evasion_count: '1',
        },
      ],
    } as never);

    const { detectCompositeDiversions } = await import('./destination-flip');
    const count = await detectCompositeDiversions();

    expect(count).toBe(1);
    expect(upsertAnomaliesBatch).toHaveBeenCalledTimes(1);
    const batch = vi.mocked(upsertAnomaliesBatch).mock.calls[0][0];
    expect(batch).toHaveLength(1);
    const arg = batch[0];
    expect(arg.imo).toBe('9111111');
    expect(arg.anomalyType).toBe('composite_diversion');
    // Junk destination ("FOR ORDERS") + evasion → confirmed
    expect(arg.confidence).toBe('confirmed');
    const details = arg.details as import('../../types/anomaly').CompositeDiversionDetails;
    expect(details.followedBy).toBe('going_dark');
    expect(details.gapHours).toBeCloseTo(6, 6);
    expect(details.junkDestination).toBe(true);
  });

  it('writes nothing for a lone routine flip with no following evasion', async () => {
    const { pool } = await import('@/lib/db');
    const { upsertAnomaliesBatch } = await import('@/lib/db/anomalies');

    // The SQL JOIN yields no rows when no evasion followed the flip.
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const { detectCompositeDiversions } = await import('./destination-flip');
    const count = await detectCompositeDiversions();

    expect(count).toBe(0);
    expect(upsertAnomaliesBatch).toHaveBeenCalledWith([]);
  });

  it('marks a real-port flip as suspected (not junk)', async () => {
    const { pool } = await import('@/lib/db');
    const { upsertAnomaliesBatch } = await import('@/lib/db/anomalies');

    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          imo: '9222222',
          previous_destination: 'Singapore',
          new_destination: 'Rotterdam',
          changed_at: new Date('2026-01-01T00:00:00Z'),
          followed_by: 'deviation',
          followed_at: new Date('2026-01-01T10:00:00Z'),
          evasion_count: '1',
        },
      ],
    } as never);

    const { detectCompositeDiversions } = await import('./destination-flip');
    await detectCompositeDiversions();

    const arg = vi.mocked(upsertAnomaliesBatch).mock.calls[0][0][0];
    expect(arg.confidence).toBe('suspected');
    const details = arg.details as import('../../types/anomaly').CompositeDiversionDetails;
    expect(details.junkDestination).toBe(false);
  });

  it('batches multiple qualifying vessels into a single upsertAnomaliesBatch call, not one per vessel', async () => {
    const { pool } = await import('@/lib/db');
    const { upsertAnomaliesBatch } = await import('@/lib/db/anomalies');

    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          imo: '9111111',
          previous_destination: 'Fujairah',
          new_destination: 'FOR ORDERS',
          changed_at: new Date('2026-01-01T00:00:00Z'),
          followed_by: 'going_dark',
          followed_at: new Date('2026-01-01T06:00:00Z'),
          evasion_count: '1',
        },
        {
          imo: '9222222',
          previous_destination: 'Singapore',
          new_destination: 'Rotterdam',
          changed_at: new Date('2026-01-01T00:00:00Z'),
          followed_by: 'deviation',
          followed_at: new Date('2026-01-01T10:00:00Z'),
          evasion_count: '1',
        },
      ],
    } as never);

    const { detectCompositeDiversions } = await import('./destination-flip');
    const count = await detectCompositeDiversions();

    expect(count).toBe(2);
    expect(upsertAnomaliesBatch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(upsertAnomaliesBatch).mock.calls[0][0]).toHaveLength(2);
  });
});
