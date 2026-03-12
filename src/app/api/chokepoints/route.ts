/**
 * Chokepoints API endpoint.
 * Returns vessel counts for critical maritime chokepoints.
 * Requirements: MAP-07
 */
import { NextResponse } from 'next/server';
import { getChokepointStats } from '@/lib/geo/chokepoints';

/**
 * GET /api/chokepoints
 * Get vessel counts for all three chokepoints.
 *
 * @returns { chokepoints: ChokepointStats[] }
 */
export async function GET() {
  try {
    const stats = await getChokepointStats();
    return NextResponse.json({ chokepoints: stats });
  } catch (error) {
    console.error('Failed to fetch chokepoint stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chokepoint stats', chokepoints: [] },
      { status: 500 }
    );
  }
}
