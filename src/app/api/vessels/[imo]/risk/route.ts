/**
 * GET /api/vessels/[imo]/risk - Returns dark fleet risk score for a vessel.
 * Requirements: RISK-01
 */
import { NextResponse } from 'next/server';
import { getRiskScore } from '@/lib/db/risk-scores';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ imo: string }> }
) {
  const { imo } = await params;

  try {
    const risk = await getRiskScore(imo);
    return NextResponse.json(risk);
  } catch (error) {
    console.error(`[API] Error fetching risk score for ${imo}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch risk score' },
      { status: 500 }
    );
  }
}
