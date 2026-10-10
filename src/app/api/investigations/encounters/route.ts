import { NextResponse } from 'next/server';
import { isCanaryEnabled } from '@/lib/canary';
import { loadRecentEncounterLeads } from '@/lib/investigations/encounters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  if (!isCanaryEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const leads = await loadRecentEncounterLeads();
    return NextResponse.json({ leads }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('[investigation-encounters] lead query failed', typeof error === 'object' && error !== null && 'code' in error ? error.code : 'unknown');
    return NextResponse.json({ error: 'Encounter leads are temporarily unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
