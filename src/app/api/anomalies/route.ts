/**
 * GET /api/anomalies - Returns active (unresolved) anomalies.
 * Supports optional ?shipType=tanker|cargo|other filter (server-side, display only).
 * M005-S03: Includes sanctions status for each anomaly vessel.
 * Requirements: ANOM-01, ANOM-02, ANOM-06
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const imo = request.nextUrl.searchParams.get('imo');
  const shipType = request.nextUrl.searchParams.get('shipType');

  // Determine ship type clause (safe: controlled switch, not raw user input)
  let shipTypeClause = '';
  if (shipType === 'tanker') {
    shipTypeClause = 'AND v.ship_type BETWEEN 80 AND 89';
  } else if (shipType === 'cargo') {
    shipTypeClause = 'AND v.ship_type BETWEEN 70 AND 79';
  } else if (shipType === 'other') {
    shipTypeClause = 'AND (v.ship_type IS NULL OR v.ship_type < 70 OR v.ship_type > 89)';
  }

  try {
    // Always JOIN vessels for sanctions data; ship type filter also requires the join
    let query = `
      SELECT va.id, va.imo, va.anomaly_type as "anomalyType", va.confidence,
             va.detected_at as "detectedAt", va.resolved_at as "resolvedAt", va.details,
             CASE WHEN vs.imo IS NOT NULL THEN true ELSE false END AS "isSanctioned",
             vs.risk_category AS "sanctionRiskCategory",
             v.name AS "vesselName", v.flag,
             vrs.score AS "riskScore",
             CASE WHEN v.ship_type BETWEEN 80 AND 89 THEN 'tanker'
                  WHEN v.ship_type BETWEEN 70 AND 79 THEN 'cargo'
                  ELSE 'other'
             END AS "shipCategory"
      FROM vessel_anomalies va
      LEFT JOIN vessels v ON v.imo = va.imo
      LEFT JOIN vessel_sanctions vs ON vs.imo = va.imo
      LEFT JOIN vessel_risk_scores vrs ON vrs.imo = va.imo
      WHERE va.resolved_at IS NULL
      ${shipTypeClause}
    `;

    const params: string[] = [];

    if (imo) {
      const paramNum = params.length + 1;
      query += ` AND va.imo = $${paramNum}`;
      params.push(imo);
    }

    query += ` ORDER BY va.detected_at DESC`;

    const result = await pool.query(query, params);
    return NextResponse.json({ anomalies: result.rows });
  } catch (error) {
    console.error('Failed to fetch anomalies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anomalies' },
      { status: 500 }
    );
  }
}
