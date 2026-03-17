import { NextRequest, NextResponse } from 'next/server';
import { getVesselsInChokepoint } from '@/lib/geo/chokepoints';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vessels = await getVesselsInChokepoint(id);

    if (vessels === null) {
      return NextResponse.json({ error: 'Unknown chokepoint' }, { status: 404 });
    }

    return NextResponse.json({ vessels });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch vessels', vessels: [] },
      { status: 500 }
    );
  }
}
