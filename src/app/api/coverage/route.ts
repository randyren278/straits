/**
 * GET /api/coverage
 * Per-chokepoint observation quality — whether Straits is *observing* a region,
 * derived from collection_buckets history. Separate from traffic counts on purpose.
 *
 * @returns { chokepoints: ChokepointQuality[] }
 */
import { NextResponse } from 'next/server';
import { getChokepointQuality } from '@/lib/db/coverage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const chokepoints = await getChokepointQuality();
    return NextResponse.json({ chokepoints });
  } catch (error) {
    console.error('Failed to compute coverage quality:', error);
    return NextResponse.json(
      { error: 'Failed to compute coverage quality', chokepoints: [] },
      { status: 500 },
    );
  }
}
