/**
 * GET /api/vessels - Returns vessels with their latest positions and sanctions data.
 * Requirements: MAP-01, INTL-01
 */
import { NextResponse } from 'next/server';
import { getVesselsWithSanctions } from '@/lib/db/sanctions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tankersOnly = searchParams.get('tankersOnly') === 'true';

  try {
    // Use getVesselsWithSanctions which includes LEFT JOIN to vessel_sanctions
    const vessels = await getVesselsWithSanctions(tankersOnly);

    return NextResponse.json({
      vessels,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch vessels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vessels' },
      { status: 500 }
    );
  }
}
