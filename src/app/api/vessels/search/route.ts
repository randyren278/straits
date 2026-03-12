/**
 * Vessel search API endpoint.
 * Provides autocomplete search for vessel name, IMO, or MMSI.
 * Requirements: MAP-06
 */
import { NextResponse } from 'next/server';
import { searchVessels } from '@/lib/db/search';

/**
 * GET /api/vessels/search?q=<query>
 * Search vessels by name, IMO, or MMSI.
 *
 * @param q - Search query (min 2 characters)
 * @returns { results: VesselSearchResult[] }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    const results = await searchVessels(q);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search failed:', error);
    return NextResponse.json(
      { error: 'Search failed', results: [] },
      { status: 500 }
    );
  }
}
