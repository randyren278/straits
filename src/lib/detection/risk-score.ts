/**
 * Dark Fleet Risk Score Computation
 *
 * Aggregates all evasion signals per vessel into a single composite risk score (0–100).
 * Factor weights:
 *   - going_dark frequency: 8pts/event, capped at 5 events = 40pts max
 *   - flag state risk:      15pts if high-risk flag, else 0
 *   - sanctions:            25pts if vessel is sanctioned, else 0
 *   - loitering (90 days):  10pts binary (any loitering = 10, none = 0)
 *   - STS transfers:        10pts binary (any STS = 10, none = 0)
 *
 * Requirements: RISK-01, RISK-02
 */
import { pool } from '../db';
import { upsertRiskScore } from '../db/risk-scores';
import type { RiskFactors } from '../db/risk-scores';

/**
 * High-risk flag states associated with sanctions evasion, dark fleet operations,
 * or state-sponsored oil smuggling.
 */
const HIGH_RISK_FLAGS = ['IR', 'RU', 'VE', 'KP', 'PA', 'CM', 'KM'];

/**
 * Row returned from the aggregation query.
 */
interface RiskAggRow {
  imo: string;
  flag: string | null;
  dark_count: string;
  loiter_count: string;
  sts_count: string;
  is_sanctioned: string;
}

/**
 * Compute dark fleet risk scores for all vessels with at least one anomaly event.
 *
 * Uses a single aggregation query across vessel_anomalies, vessels, and vessel_sanctions
 * to avoid N+1 per-vessel queries. Scores are upserted into vessel_risk_scores.
 *
 * M005-S02: Only risk categories 'sanction' and 'mare.shadow;poi' contribute to the
 * sanctions factor. Port state detentions (mare.detained) are informational only.
 *
 * @returns Number of vessels scored
 */
export async function computeRiskScores(): Promise<number> {
  const result = await pool.query<RiskAggRow>(`
    SELECT
      va.imo,
      v.flag,
      COUNT(*) FILTER (WHERE va.anomaly_type = 'going_dark') AS dark_count,
      COUNT(*) FILTER (WHERE va.anomaly_type = 'loitering' AND va.detected_at > NOW() - INTERVAL '90 days') AS loiter_count,
      COUNT(*) FILTER (WHERE va.anomaly_type = 'sts_transfer') AS sts_count,
      CASE WHEN vs.imo IS NOT NULL AND vs.risk_category IN ('sanction', 'mare.shadow;poi') THEN 1 ELSE 0 END AS is_sanctioned
    FROM vessel_anomalies va
    LEFT JOIN vessels v ON v.imo = va.imo
    LEFT JOIN vessel_sanctions vs ON vs.imo = va.imo
    GROUP BY va.imo, v.flag, vs.imo, vs.risk_category
  `);

  let count = 0;

  for (const row of result.rows) {
    const darkCount = parseInt(row.dark_count, 10);
    const loiterCount = parseInt(row.loiter_count, 10);
    const stsCount = parseInt(row.sts_count, 10);
    const isSanctioned = parseInt(row.is_sanctioned, 10) === 1;

    const factors: RiskFactors = {
      goingDark: Math.min(darkCount * 8, 40),
      flagRisk: row.flag !== null && HIGH_RISK_FLAGS.includes(row.flag) ? 15 : 0,
      sanctions: isSanctioned ? 25 : 0,
      loitering: loiterCount > 0 ? 10 : 0,
      sts: stsCount > 0 ? 10 : 0,
    };

    const score = factors.goingDark + factors.flagRisk + factors.sanctions + factors.loitering + factors.sts;

    await upsertRiskScore(row.imo, score, factors);
    count++;
  }

  return count;
}
