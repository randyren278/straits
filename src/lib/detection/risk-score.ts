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
 *   - repeat rendezvous:    5pts binary (>=2 rendezvous encounters in 90 days = 5, else 0)
 *
 * Requirements: RISK-01, RISK-02
 */
import { pool } from '../db';
import { upsertRiskScoresBatch } from '../db/risk-scores';
import type { RiskFactors } from '../db/risk-scores';

/**
 * How far back an anomaly can be and still pull a vessel into the seed set.
 * Vessels with a currently-active (unresolved) anomaly are always included
 * regardless of age.
 *
 * Without this bound, the seed CTE below is `SELECT DISTINCT imo FROM
 * vessel_anomalies` with no filter — every vessel that has EVER had any
 * anomaly, including ones resolved years ago, is rescored on every run
 * forever. That set only grows. 90 days matches the recency horizon this
 * same query already uses for the loitering and rendezvous factors, so a
 * vessel is "still relevant" for exactly as long its behavioral factors are.
 *
 * BEHAVIORAL CHANGE: a vessel whose only anomaly history is fully resolved
 * and older than 90 days stops being recomputed each run. Its last-computed
 * row in vessel_risk_scores is left as-is (not deleted, not zeroed) rather
 * than actively refreshed — in practice this is a no-op for such vessels,
 * since a resolved, 90+ day old anomaly wasn't changing their score run to
 * run anyway. Vessels with any activity in the last 90 days, or any
 * currently-active anomaly, are unaffected. Flagged for user review.
 */
const SEED_LOOKBACK_DAYS = 90;

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
  rendezvous_count: string;
}

/**
 * Compute dark fleet risk scores for all vessels that have at least one anomaly event
 * OR are sanctioned (risk_category 'sanction' or 'mare.shadow;poi'). Identity-first: a
 * clean-behaving sanctioned hull with zero anomalies is still scored and surfaced.
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
    WITH seed AS (
      SELECT DISTINCT imo FROM vessel_anomalies
      WHERE resolved_at IS NULL OR detected_at > NOW() - INTERVAL '${SEED_LOOKBACK_DAYS} days'
      UNION
      SELECT imo FROM vessel_sanctions WHERE risk_category IN ('sanction', 'mare.shadow;poi')
    )
    SELECT
      s.imo,
      v.flag,
      COUNT(*) FILTER (WHERE va.anomaly_type = 'going_dark') AS dark_count,
      COUNT(*) FILTER (WHERE va.anomaly_type = 'loitering' AND va.detected_at > NOW() - INTERVAL '90 days') AS loiter_count,
      COUNT(*) FILTER (WHERE va.anomaly_type = 'sts_transfer') AS sts_count,
      CASE WHEN vs.imo IS NOT NULL AND vs.risk_category IN ('sanction', 'mare.shadow;poi') THEN 1 ELSE 0 END AS is_sanctioned,
      (
        SELECT COUNT(*) FROM vessel_rendezvous rz
        WHERE (rz.imo_a = s.imo OR rz.imo_b = s.imo)
          AND rz.last_seen_at > NOW() - INTERVAL '90 days'
      ) AS rendezvous_count
    FROM seed s
    LEFT JOIN vessel_anomalies va ON va.imo = s.imo
    LEFT JOIN vessels v ON v.imo = s.imo
    LEFT JOIN vessel_sanctions vs ON vs.imo = s.imo
    GROUP BY s.imo, v.flag, vs.imo, vs.risk_category
  `);

  const scores = result.rows.map((row) => {
    const darkCount = parseInt(row.dark_count, 10);
    const loiterCount = parseInt(row.loiter_count, 10);
    const stsCount = parseInt(row.sts_count, 10);
    const isSanctioned = parseInt(row.is_sanctioned, 10) === 1;
    const rendezvousCount = parseInt(row.rendezvous_count, 10);

    const factors: RiskFactors = {
      goingDark: Math.min(darkCount * 8, 40),
      flagRisk: row.flag !== null && HIGH_RISK_FLAGS.includes(row.flag) ? 15 : 0,
      sanctions: isSanctioned ? 25 : 0,
      loitering: loiterCount > 0 ? 10 : 0,
      sts: stsCount > 0 ? 10 : 0,
      rendezvous: rendezvousCount >= 2 ? 5 : 0,
    };

    const score = factors.goingDark + factors.flagRisk + factors.sanctions + factors.loitering + factors.sts + factors.rendezvous;

    return { imo: row.imo, score, factors };
  });

  await upsertRiskScoresBatch(scores);
  return scores.length;
}
