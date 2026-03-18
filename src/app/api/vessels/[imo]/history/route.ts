/** GET /api/vessels/[imo]/history - Returns full anomaly history and destination changes for a vessel. Requirements: PANL-01, PANL-03 */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ imo: string }> }
) {
  const { imo } = await params;

  try {
    const [anomalyResult, destResult] = await Promise.all([
      pool.query(
        `SELECT id, imo, anomaly_type as "anomalyType", confidence,
                detected_at as "detectedAt", resolved_at as "resolvedAt", details
         FROM vessel_anomalies
         WHERE imo = $1
         ORDER BY detected_at DESC`,
        [imo]
      ),
      pool.query(
        `SELECT id, previous_destination as "previousDestination",
                new_destination as "newDestination", changed_at as "changedAt"
         FROM vessel_destination_changes
         WHERE imo = $1
         ORDER BY changed_at DESC`,
        [imo]
      ),
    ]);

    return NextResponse.json({
      anomalies: anomalyResult.rows,
      destinationChanges: destResult.rows,
    });
  } catch (error) {
    console.error(`[API] Error fetching vessel history for ${imo}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch vessel history' },
      { status: 500 }
    );
  }
}
