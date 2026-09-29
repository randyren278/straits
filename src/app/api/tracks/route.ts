/** GET /api/tracks — track-engine output for the motion overlay. */
import { NextResponse } from 'next/server';
import { getTracks } from '@/lib/db/tracks';

export async function GET() {
  try {
    const started = performance.now();
    const body = await getTracks();
    const res = NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
    res.headers.set('Server-Timing', `db;dur=${(performance.now() - started).toFixed(1)}`);
    return res;
  } catch (error) {
    console.error('Failed to fetch tracks:', error);
    return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
  }
}
