/**
 * Dark Fleet Risk Score Tests
 *
 * Verifies the identity-first aggregation: sanctioned vessels are scored even with
 * zero anomalies, and anomalous non-sanctioned vessels retain their behavioral factors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database pool
vi.mock('@/lib/db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

// Mock the upsert so we can assert on the computed score/factors
vi.mock('@/lib/db/risk-scores', () => ({
  upsertRiskScoresBatch: vi.fn(),
}));

describe('computeRiskScores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scores a sanctioned, zero-anomaly vessel (sanctions=25, flagRisk=15)', async () => {
    const { pool } = await import('@/lib/db');
    const { upsertRiskScoresBatch } = await import('@/lib/db/risk-scores');

    vi.mocked(pool.query).mockResolvedValue({
      rows: [
        {
          imo: '9111111',
          flag: 'IR',
          dark_count: '0',
          loiter_count: '0',
          sts_count: '0',
          is_sanctioned: '1',
          rendezvous_count: '0',
        },
      ],
    } as any);

    const { computeRiskScores } = await import('./risk-score');
    const count = await computeRiskScores();

    expect(count).toBe(1);
    expect(upsertRiskScoresBatch).toHaveBeenCalledTimes(1);

    const [{ imo, score, factors }] = vi.mocked(upsertRiskScoresBatch).mock.calls[0][0];
    expect(imo).toBe('9111111');
    expect(factors.sanctions).toBe(25);
    expect(factors.flagRisk).toBe(15);
    expect(factors.goingDark).toBe(0);
    expect(factors.loitering).toBe(0);
    expect(factors.sts).toBe(0);
    expect(factors.rendezvous).toBe(0);
    expect(score).toBeGreaterThanOrEqual(25);
    expect(score).toBe(40);
  });

  it('scores an anomalous, non-sanctioned vessel with 2 going_dark events (goingDark=16, sanctions=0)', async () => {
    const { pool } = await import('@/lib/db');
    const { upsertRiskScoresBatch } = await import('@/lib/db/risk-scores');

    vi.mocked(pool.query).mockResolvedValue({
      rows: [
        {
          imo: '9222222',
          flag: 'MH',
          dark_count: '2',
          loiter_count: '0',
          sts_count: '0',
          is_sanctioned: '0',
          rendezvous_count: '0',
        },
      ],
    } as any);

    const { computeRiskScores } = await import('./risk-score');
    const count = await computeRiskScores();

    expect(count).toBe(1);
    expect(upsertRiskScoresBatch).toHaveBeenCalledTimes(1);

    const [{ imo, score, factors }] = vi.mocked(upsertRiskScoresBatch).mock.calls[0][0];
    expect(imo).toBe('9222222');
    expect(factors.goingDark).toBe(16);
    expect(factors.sanctions).toBe(0);
    expect(factors.flagRisk).toBe(0);
    expect(score).toBe(16);
  });

  it('adds rendezvous factor (+5) for a repeat-partner vessel (>=2 encounters/90d)', async () => {
    const { pool } = await import('@/lib/db');
    const { upsertRiskScoresBatch } = await import('@/lib/db/risk-scores');

    vi.mocked(pool.query).mockResolvedValue({
      rows: [
        {
          imo: '9333333',
          flag: 'MH',
          dark_count: '0',
          loiter_count: '0',
          sts_count: '0',
          is_sanctioned: '0',
          rendezvous_count: '3',
        },
      ],
    } as any);

    const { computeRiskScores } = await import('./risk-score');
    await computeRiskScores();

    const [{ score, factors }] = vi.mocked(upsertRiskScoresBatch).mock.calls[0][0];
    expect(factors.rendezvous).toBe(5);
    expect(score).toBe(5);
  });

  it('batches all vessels into a single upsertRiskScoresBatch call, not one per vessel', async () => {
    const { pool } = await import('@/lib/db');
    const { upsertRiskScoresBatch } = await import('@/lib/db/risk-scores');

    vi.mocked(pool.query).mockResolvedValue({
      rows: [
        { imo: '9111111', flag: 'MH', dark_count: '0', loiter_count: '0', sts_count: '0', is_sanctioned: '0', rendezvous_count: '0' },
        { imo: '9222222', flag: 'MH', dark_count: '0', loiter_count: '0', sts_count: '0', is_sanctioned: '0', rendezvous_count: '0' },
        { imo: '9333333', flag: 'MH', dark_count: '0', loiter_count: '0', sts_count: '0', is_sanctioned: '0', rendezvous_count: '0' },
      ],
    } as any);

    const { computeRiskScores } = await import('./risk-score');
    const count = await computeRiskScores();

    expect(count).toBe(3);
    // N candidates -> 1 batch call, not N individual upsert calls
    expect(upsertRiskScoresBatch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(upsertRiskScoresBatch).mock.calls[0][0]).toHaveLength(3);
  });

  it('bounds the seed query to active anomalies or the 90-day lookback, so a resolved-anomaly-only vessel history cannot grow the seed set forever', async () => {
    const { pool } = await import('@/lib/db');

    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as any);

    const { computeRiskScores } = await import('./risk-score');
    await computeRiskScores();

    const sql = vi.mocked(pool.query).mock.calls[0][0] as string;
    expect(sql).toContain('resolved_at IS NULL');
    expect(sql).toContain("90 days");
  });
});
