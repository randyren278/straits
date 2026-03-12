/**
 * GET /api/positions/[mmsi] - Returns position history for a vessel.
 * Requirements: MAP-04
 */
import { NextResponse } from 'next/server';
import { getPositionHistory } from '@/lib/db/positions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mmsi: string }> }
) {
  const { mmsi } = await params;
  const { searchParams } = new URL(request.url);
  const hours = parseInt(searchParams.get('hours') || '24', 10);

  try {
    const positions = await getPositionHistory(mmsi, hours);
    return NextResponse.json({ positions });
  } catch (error) {
    console.error(`Failed to fetch positions for ${mmsi}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}
