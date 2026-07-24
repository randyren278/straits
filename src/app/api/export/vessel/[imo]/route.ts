/**
 * GET /api/export/vessel/[imo] — Dark-Fleet Dossier export.
 *
 * Aggregates a single vessel's identity, sanctions, risk factor breakdown,
 * full anomaly history (with type-specific detail numbers), and recent track
 * into one structured JSON object, returned as a downloadable attachment.
 *
 * Mirrors the download-header style of /api/export (Content-Disposition).
 * Fans out to the same underlying db/lib functions used by the per-vessel
 * risk + history endpoints rather than HTTP-fetching our own API.
 *
 * Requirements: RISK-01, PANL-01, M005-S03 (dossier export)
 */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getVessel } from '@/lib/db/vessels';
import { getSanction } from '@/lib/db/sanctions';
import { getRiskScore } from '@/lib/db/risk-scores';
import { getPositionHistory } from '@/lib/db/positions';
import { formatAnomalyDetails } from '@/lib/anomaly/format-details';
import type { AnomalyType } from '@/types/anomaly';

interface AnomalyRow {
  id: number;
  imo: string;
  anomalyType: AnomalyType;
  confidence: string;
  detectedAt: Date;
  resolvedAt: Date | null;
  details: Record<string, unknown>;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ imo: string }> }
) {
  const { imo } = await params;

  try {
    const vessel = await getVessel(imo);

    const [sanction, risk, anomalyResult] = await Promise.all([
      getSanction(imo),
      getRiskScore(imo),
      pool.query<AnomalyRow>(
        `SELECT id, imo, anomaly_type as "anomalyType", confidence,
                detected_at as "detectedAt", resolved_at as "resolvedAt", details
         FROM vessel_anomalies
         WHERE imo = $1
         ORDER BY detected_at DESC`,
        [imo]
      ),
    ]);

    // Recent track keyed by MMSI (positions hypertable is MMSI-indexed).
    const track = vessel?.mmsi
      ? await getPositionHistory(vessel.mmsi, 24)
      : [];

    const anomalies = anomalyResult.rows.map((a) => ({
      id: a.id,
      type: a.anomalyType,
      confidence: a.confidence,
      detectedAt: a.detectedAt,
      resolvedAt: a.resolvedAt,
      details: a.details,
      summary: formatAnomalyDetails(a.anomalyType, a.details),
    }));

    const dossier = {
      exportedAt: new Date().toISOString(),
      identity: {
        imo,
        mmsi: vessel?.mmsi ?? null,
        name: vessel?.name ?? null,
        flag: vessel?.flag ?? null,
        shipType: vessel?.shipType ?? null,
        destination: vessel?.destination ?? null,
        lastSeen: vessel?.lastSeen ?? null,
      },
      risk: {
        score: risk.score,
        factors: risk.factors,
        computedAt: risk.computedAt,
      },
      sanctions: sanction
        ? {
            sanctioningAuthority: sanction.sanctioningAuthority,
            riskCategory: sanction.riskCategory,
            datasets: sanction.datasets,
            flag: sanction.flag,
            aliases: sanction.aliases,
            opensanctionsUrl: sanction.opensanctionsUrl,
            vesselType: sanction.vesselType,
          }
        : null,
      anomalies,
      track,
    };

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(dossier, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="dossier-${imo}-${stamp}.json"`,
      },
    });
  } catch (error) {
    console.error(`[API] Failed to export dossier for ${imo}:`, error);
    return NextResponse.json({ error: 'Failed to export vessel dossier' }, { status: 500 });
  }
}
