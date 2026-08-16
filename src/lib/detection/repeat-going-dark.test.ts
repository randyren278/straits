/**
 * Repeat Going Dark Detection Tests
 *
 * Tests the batching fix: detectRepeatGoingDark used to call upsertAnomaly
 * once per qualifying vessel (the same N+1 anti-pattern as the other
 * detectors); it now collects rows and flushes via upsertAnomaliesBatch.
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
import { detectRepeatGoingDark } from './repeat-going-dark';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockUpsertAnomaliesBatch = upsertAnomaliesBatch as ReturnType<typeof vi.fn>;

const makeRow = (imo: string, count = 3) => ({
  imo,
  dark_count: String(count),
  recent_events: [{ detectedAt: '2026-03-01T00:00:00Z', resolvedAt: null }],
});

describe('detectRepeatGoingDark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing and upserts an empty batch when no vessel qualifies', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // auto-resolve query

    const count = await detectRepeatGoingDark();

    expect(count).toBe(0);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledWith([]);
  });

  it('batches all qualifying vessels into a single upsertAnomaliesBatch call, not one per vessel', async () => {
    const rows = [makeRow('1111111'), makeRow('2222222'), makeRow('3333333')];
    mockQuery.mockResolvedValueOnce({ rows });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // auto-resolve query

    const count = await detectRepeatGoingDark();

    expect(count).toBe(3);
    expect(mockUpsertAnomaliesBatch).toHaveBeenCalledTimes(1);
    const batch = mockUpsertAnomaliesBatch.mock.calls[0][0];
    expect(batch).toHaveLength(3);
    expect(batch).toEqual([
      expect.objectContaining({ imo: '1111111', anomalyType: 'repeat_going_dark' }),
      expect.objectContaining({ imo: '2222222', anomalyType: 'repeat_going_dark' }),
      expect.objectContaining({ imo: '3333333', anomalyType: 'repeat_going_dark' }),
    ]);
  });

  it('still issues the auto-resolve query for vessels that dropped below threshold', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await detectRepeatGoingDark();

    const resolveSql = mockQuery.mock.calls[1][0];
    expect(resolveSql).toContain('resolved_at = NOW()');
    expect(resolveSql).toContain('repeat_going_dark');
  });
});
