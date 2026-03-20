/**
 * GET /api/vessels/[imo]/risk - Returns dark fleet risk score and sanctions detail for a vessel.
 * Requirements: RISK-01, M005-S03
 */
import { NextResponse } from 'next/server';
import { getRiskScore } from '@/lib/db/risk-scores';
import { getSanction } from '@/lib/db/sanctions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ imo: string }> }
) {
  const { imo } = await params;

  try {
    const [risk, sanction] = await Promise.all([
      getRiskScore(imo),
      getSanction(imo),
    ]);

    return NextResponse.json({
      ...risk,
      sanction: sanction
        ? {
            authority: sanction.sanctioningAuthority,
            riskCategory: sanction.riskCategory,
            datasets: sanction.datasets,
            flag: sanction.flag,
            aliases: sanction.aliases,
            opensanctionsUrl: sanction.opensanctionsUrl,
            vesselType: sanction.vesselType,
            name: sanction.reason,  // name from sanctions list stored in name column
          }
        : null,
    });
  } catch (error) {
    console.error(`[API] Error fetching risk score for ${imo}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch risk score' },
      { status: 500 }
    );
  }
}
