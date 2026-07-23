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

    return NextResponse.json(
      {
        vessels,
        timestamp: new Date().toISOString(),
      },
      {
        // Positions refresh on a multi-minute cadence; serve a cached copy for
        // 30s and revalidate in the background to cut DB load under fan-out.
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch vessels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vessels' },
      { status: 500 }
    );
  }
}
