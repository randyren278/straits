import { NextResponse } from 'next/server';
import { isCanaryEnabled } from '@/lib/canary';
import { isValidEncounterId, isValidEncounterImo, loadEncounterCase } from '@/lib/investigations/encounters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ imo: string }> }) {
  if (!isCanaryEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { imo } = await params;
  if (!isValidEncounterImo(imo)) return NextResponse.json({ error: 'Vessel not found' }, { status: 404 });
  const event = new URL(request.url).searchParams.get('event');
  if (event !== null && !isValidEncounterId(event)) {
    return NextResponse.json({ error: 'Invalid encounter event' }, { status: 400 });
  }

  try {
    const result = await loadEncounterCase(imo, event ?? undefined);
    if (result.kind !== 'found') {
      return NextResponse.json({ error: result.kind === 'vessel_not_found' ? 'Vessel not found' : 'Encounter not found' }, { status: 404 });
    }
    return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[investigation-encounters] evidence query failed', typeof error === 'object' && error !== null && 'code' in error ? error.code : 'unknown');
    return NextResponse.json({ error: 'Encounter evidence is temporarily unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
