/** GET /api/tracks/replay — the last 24 h of smoothed tracks, for the rewind control. */
import { NextResponse } from 'next/server';
import { getReplay } from '@/lib/db/tracks-read';

export async function GET() {
  try {
    const body = await getReplay();
    if (!body) return NextResponse.json({ error: 'No replay yet' }, { status: 404 });
    return NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch (error) {
    console.error('Failed to fetch replay:', error);
    return NextResponse.json({ error: 'Failed to fetch replay' }, { status: 500 });
  }
}
