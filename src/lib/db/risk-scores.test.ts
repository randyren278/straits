/**
 * Risk Score DB Operations Tests
 *
 * Tests for risk score database operations with mocked pool.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database pool
vi.mock('./index', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from './index';
import { upsertRiskScore, upsertRiskScoresBatch, getRiskScore } from './risk-scores';
import type { RiskFactors } from './risk-scores';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

const makeFactors = (): RiskFactors => ({
  goingDark: 8,
  flagRisk: 0,
  sanctions: 0,
  loitering: 0,
  sts: 0,
  rendezvous: 0,
});

describe('upsertRiskScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts a single score', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await upsertRiskScore('1234567', 8, makeFactors());

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO vessel_risk_scores');
    expect(sql).toContain('ON CONFLICT (imo) DO UPDATE');
    expect(params[0]).toBe('1234567');
    expect(params[1]).toBe(8);
  });
});

describe('upsertRiskScoresBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing and issues no query for an empty array', async () => {
    await upsertRiskScoresBatch([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('issues exactly one query for many vessels within the chunk size', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const scores = Array.from({ length: 300 }, (_, i) => ({
      imo: String(1000000 + i),
      score: 8,
      factors: makeFactors(),
    }));
    await upsertRiskScoresBatch(scores);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO vessel_risk_scores');
    expect(sql).toContain('ON CONFLICT (imo) DO UPDATE');
    expect(params).toHaveLength(300 * 3);
  });

  it('chunks into multiple round-trips beyond 500 vessels (N candidates -> ceil(N/500) queries)', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const scores = Array.from({ length: 1200 }, (_, i) => ({
      imo: String(1000000 + i),
      score: 8,
      factors: makeFactors(),
    }));
    await upsertRiskScoresBatch(scores);

    // ceil(1200 / 500) = 3
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });
});

describe('getRiskScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a zero-score default when no row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getRiskScore('9999999');

    expect(result.score).toBe(0);
    expect(result.computedAt).toBeNull();
  });

  it('returns the stored score and factors', async () => {
    const computedAt = new Date('2026-03-12T00:00:00Z');
    mockQuery.mockResolvedValueOnce({
      rows: [{ score: 40, factors: makeFactors(), computed_at: computedAt }],
    });

    const result = await getRiskScore('1234567');

    expect(result.score).toBe(40);
    expect(result.computedAt).toBe(computedAt.toISOString());
  });
});
