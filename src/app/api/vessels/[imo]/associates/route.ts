/**
 * GET /api/vessels/[imo]/associates - Returns Known Associates (rendezvous partners)
 * for a vessel from the vessel_rendezvous ledger, aggregated across both sides of the pair.
 * Requirements: RISK-01
 */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

interface AssociateRow {
  partnerImo: string;
  partnerName: string | null;
  encounterCount: string;
  lastSeenAt: Date;
  minDistanceKm: number | null;
  partnerSanctioned: boolean;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ imo: string }> }
) {
  const { imo } = await params;

  try {
    // Normalize each rendezvous row so the queried vessel is always "self" and the
    // counterpart is "partner", regardless of which side it was stored on. Then
    // aggregate repeat encounters per partner.
    const result = await pool.query<AssociateRow>(
      `WITH pairs AS (
         SELECT
           CASE WHEN imo_a = $1 THEN imo_b ELSE imo_a END AS partner_imo,
           CASE WHEN imo_a = $1 THEN b_sanctioned ELSE a_sanctioned END AS partner_sanctioned,
           last_seen_at,
           min_distance_km
         FROM vessel_rendezvous
         WHERE imo_a = $1 OR imo_b = $1
       )
       SELECT
         p.partner_imo AS "partnerImo",
         v.name AS "partnerName",
         COUNT(*) AS "encounterCount",
         MAX(p.last_seen_at) AS "lastSeenAt",
         MIN(p.min_distance_km) AS "minDistanceKm",
         BOOL_OR(COALESCE(p.partner_sanctioned, FALSE)) AS "partnerSanctioned"
       FROM pairs p
       LEFT JOIN vessels v ON v.imo = p.partner_imo
       GROUP BY p.partner_imo, v.name
       ORDER BY "encounterCount" DESC, "lastSeenAt" DESC`,
      [imo]
    );

    return NextResponse.json({ associates: result.rows });
  } catch (error) {
    console.error(`[API] Error fetching associates for ${imo}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch associates' },
      { status: 500 }
    );
  }
}
