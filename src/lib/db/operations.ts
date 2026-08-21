import { pool } from './index';

export interface RiskScoreFreshness {
  totalScores: number;
  staleScores: number;
  latestComputedAt: string | null;
  oldestComputedAt: string | null;
}

/**
 * Aggregate materialized risk-score freshness for operational diagnostics.
 * A stale score is one older than the detector cycle SLO (default 60 minutes).
 */
export async function getRiskScoreFreshness(staleAfterMinutes = 60): Promise<RiskScoreFreshness> {
  const minutes = Number.isFinite(staleAfterMinutes) && staleAfterMinutes > 0
    ? staleAfterMinutes
    : 60;
  const result = await pool.query<{
    total_scores: number;
    stale_scores: number;
    latest_computed_at: Date | null;
    oldest_computed_at: Date | null;
  }>(
    `SELECT
       COUNT(*)::int AS total_scores,
       COUNT(*) FILTER (
         WHERE computed_at < NOW() - ($1::double precision * INTERVAL '1 minute')
       )::int AS stale_scores,
       MAX(computed_at) AS latest_computed_at,
       MIN(computed_at) AS oldest_computed_at
     FROM vessel_risk_scores`,
    [minutes]
  );
  const row = result.rows[0];
  return {
    totalScores: Number(row?.total_scores ?? 0),
    staleScores: Number(row?.stale_scores ?? 0),
    latestComputedAt: row?.latest_computed_at?.toISOString() ?? null,
    oldestComputedAt: row?.oldest_computed_at?.toISOString() ?? null,
  };
}
