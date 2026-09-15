/**
 * GET /api/coverage/history?hours=24|168
 * Hourly collection record per chokepoint — what the observation heatmaps draw.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCoverageHistory } from '@/lib/db/coverage';

export const dynamic = 'force-dynamic';

const MAX_HOURS = 24 * 90;

export async function GET(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get('hours') ?? 168);
  const hours = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), MAX_HOURS) : 168;
  try {
    const regions = await getCoverageHistory(hours);
    return NextResponse.json({ hours, generatedAt: new Date().toISOString(), regions });
  } catch (error) {
    console.error('Failed to load coverage history:', error);
    return NextResponse.json({ error: 'Failed to load coverage history', regions: [] }, { status: 500 });
  }
}
