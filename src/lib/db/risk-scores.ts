/**
 * Risk Score DB Operations
 *
 * CRUD operations for the vessel_risk_scores table.
 * Stores per-vessel composite dark fleet risk scores with factor breakdown.
 *
 * Requirements: RISK-01
 */
import { pool } from './index';

/**
 * Factor breakdown for a vessel's risk score.
 * Each factor has an individual cap; together they sum to at most 100.
 */
export interface RiskFactors {
  goingDark: number;   // max 40
  flagRisk: number;    // max 15
  sanctions: number;   // max 25
  loitering: number;   // max 10
  sts: number;         // max 10
}

/**
 * Insert or update a vessel's risk score.
 * If a row already exists for this IMO, update score, factors, and computed_at.
 *
 * @param imo - Vessel IMO number
 * @param score - Composite risk score (0–100)
 * @param factors - Factor breakdown object
 */
export async function upsertRiskScore(
  imo: string,
  score: number,
  factors: RiskFactors
): Promise<void> {
  await pool.query(
    `INSERT INTO vessel_risk_scores (imo, score, factors, computed_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (imo) DO UPDATE SET
       score = EXCLUDED.score,
       factors = EXCLUDED.factors,
       computed_at = NOW()`,
    [imo, score, JSON.stringify(factors)]
  );
}

/**
 * Retrieve the risk score for a vessel.
 * Returns a zero-score default for vessels with no anomaly history (not stored in the table).
 *
 * @param imo - Vessel IMO number
 * @returns Risk score object with factor breakdown and computation timestamp
 */
export async function getRiskScore(
  imo: string
): Promise<{ score: number; factors: RiskFactors; computedAt: string | null }> {
  const result = await pool.query<{
    score: number;
    factors: RiskFactors;
    computed_at: Date;
  }>(
    `SELECT score, factors, computed_at FROM vessel_risk_scores WHERE imo = $1`,
    [imo]
  );

  if (result.rows.length === 0) {
    return {
      score: 0,
      factors: { goingDark: 0, flagRisk: 0, sanctions: 0, loitering: 0, sts: 0 },
      computedAt: null,
    };
  }

  const row = result.rows[0];
  return {
    score: row.score,
    factors: row.factors,
    computedAt: row.computed_at.toISOString(),
  };
}
