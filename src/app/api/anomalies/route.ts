/**
 * GET /api/anomalies - Returns active (unresolved) anomalies.
 * Requirements: ANOM-01, ANOM-02
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const imo = request.nextUrl.searchParams.get('imo');

  try {
    let query = `
      SELECT id, imo, anomaly_type as "anomalyType", confidence,
             detected_at as "detectedAt", resolved_at as "resolvedAt", details
      FROM vessel_anomalies
      WHERE resolved_at IS NULL
    `;
    const params: string[] = [];

    if (imo) {
      query += ` AND imo = $1`;
      params.push(imo);
    }

    query += ` ORDER BY detected_at DESC`;

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
