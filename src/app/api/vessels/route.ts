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

    // `timestamp` is when this response was assembled. `latestObservation` is
    // the newest AIS fix in the set — the number that actually says how
    // current the picture is. Rows are ordered by p.time DESC, so it's row 0.
    const latestObservation = vessels[0]?.position?.time ?? null;

    return NextResponse.json(
      {
        vessels,
        timestamp: new Date().toISOString(),
        latestObservation: latestObservation ? new Date(latestObservation).toISOString() : null,
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
