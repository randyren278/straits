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
 * Factor weights (see the header). The SQL below is built from these, so the
 * scoring rule lives in one place.
 */
const WEIGHTS = {
  goingDarkPerEvent: 8,
  goingDarkMax: 40,
  flagRisk: 15,
  sanctions: 25,
  loitering: 10,
  sts: 10,
  rendezvous: 5,
  rendezvousMinEncounters: 2,
};

/**
 * Compute dark fleet risk scores for all vessels that have at least one anomaly event
 * OR are sanctioned (risk_category 'sanction' or 'mare.shadow;poi'). Identity-first: a
 * clean-behaving sanctioned hull with zero anomalies is still scored and surfaced.
 *
 * One statement aggregates across vessel_anomalies, vessels, vessel_sanctions and
 * vessel_rendezvous, scores, and upserts into vessel_risk_scores inside Postgres.
 * The client-side version downloaded every vessel's aggregates each harvest
 * (~0.2 MB of Supabase egress) only to write the scores straight back; the
 * stored scores and factors are identical (see risk-score.test.ts).
 *
 * M005-S02: Only risk categories 'sanction' and 'mare.shadow;poi' contribute to the
 * sanctions factor. Port state detentions (mare.detained) are informational only.
 *
 * @returns Number of vessels scored
 */
export async function computeRiskScores(): Promise<number> {
  const w = WEIGHTS;
  const result = await pool.query(`
    WITH seed AS (
      SELECT DISTINCT imo FROM vessel_anomalies
      WHERE resolved_at IS NULL OR detected_at > NOW() - INTERVAL '${SEED_LOOKBACK_DAYS} days'
      UNION
      SELECT imo FROM vessel_sanctions WHERE risk_category IN ('sanction', 'mare.shadow;poi')
    ),
    agg AS (
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
    ),
    factors AS (
      SELECT
        imo,
        LEAST(dark_count * ${w.goingDarkPerEvent}, ${w.goingDarkMax}) AS going_dark,
        CASE WHEN flag = ANY($1::text[]) THEN ${w.flagRisk} ELSE 0 END AS flag_risk,
        CASE WHEN is_sanctioned = 1 THEN ${w.sanctions} ELSE 0 END AS sanctions,
        CASE WHEN loiter_count > 0 THEN ${w.loitering} ELSE 0 END AS loitering,
        CASE WHEN sts_count > 0 THEN ${w.sts} ELSE 0 END AS sts,
        CASE WHEN rendezvous_count >= ${w.rendezvousMinEncounters} THEN ${w.rendezvous} ELSE 0 END AS rendezvous
      FROM agg
    )
    INSERT INTO vessel_risk_scores (imo, score, factors, computed_at)
    SELECT
      imo,
      going_dark + flag_risk + sanctions + loitering + sts + rendezvous,
      jsonb_build_object(
        'goingDark', going_dark, 'flagRisk', flag_risk, 'sanctions', sanctions,
        'loitering', loitering, 'sts', sts, 'rendezvous', rendezvous),
      NOW()
    FROM factors
    ON CONFLICT (imo) DO UPDATE SET
      score = EXCLUDED.score,
      factors = EXCLUDED.factors,
      computed_at = NOW()
  `, [HIGH_RISK_FLAGS]);
  return result.rowCount ?? 0;
}
