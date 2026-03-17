/**
 * GET /api/anomalies - Returns active (unresolved) anomalies.
 * Supports optional ?shipType=tanker|cargo|other filter (server-side, display only).
 * Requirements: ANOM-01, ANOM-02, ANOM-06
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const imo = request.nextUrl.searchParams.get('imo');
  const shipType = request.nextUrl.searchParams.get('shipType');

  // Determine ship type clause (safe: controlled switch, not raw user input)
  let shipTypeClause = '';
  const needsJoin = shipType && shipType !== 'all';
  if (shipType === 'tanker') {
    shipTypeClause = 'AND v.ship_type BETWEEN 80 AND 89';
  } else if (shipType === 'cargo') {
    shipTypeClause = 'AND v.ship_type BETWEEN 70 AND 79';
  } else if (shipType === 'other') {
    shipTypeClause = 'AND (v.ship_type IS NULL OR v.ship_type < 70 OR v.ship_type > 89)';
  }

  try {
    let query: string;
    if (needsJoin) {
      query = `
        SELECT va.id, va.imo, va.anomaly_type as "anomalyType", va.confidence,
               va.detected_at as "detectedAt", va.resolved_at as "resolvedAt", va.details
        FROM vessel_anomalies va
        LEFT JOIN vessels v ON v.imo = va.imo
        WHERE va.resolved_at IS NULL
        ${shipTypeClause}
      `;
    } else {
      query = `
        SELECT id, imo, anomaly_type as "anomalyType", confidence,
               detected_at as "detectedAt", resolved_at as "resolvedAt", details
        FROM vessel_anomalies
        WHERE resolved_at IS NULL
      `;
    }

    const params: string[] = [];

    if (imo) {
      const paramNum = params.length + 1;
      query += ` AND ${needsJoin ? 'va.' : ''}imo = $${paramNum}`;
      params.push(imo);
    }

    query += ` ORDER BY ${needsJoin ? 'va.' : ''}detected_at DESC`;

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
