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
    const dbStarted = performance.now();
    const stats = await getChokepointStats();
    const dbMs = performance.now() - dbStarted;
    const serializeStarted = performance.now();
    const response = NextResponse.json({ chokepoints: stats, generatedAt: new Date().toISOString() }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
    response.headers.set('Server-Timing', `db;dur=${dbMs.toFixed(1)}, serialize;dur=${(performance.now() - serializeStarted).toFixed(1)}`);
    return response;
  } catch (error) {
    console.error('Failed to fetch chokepoint stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chokepoint stats', chokepoints: [] },
      { status: 500 }
    );
  }
}
