import { NextResponse } from 'next/server';
import { isCanaryEnabled } from '@/lib/canary';
import { loadRegionContext } from '@/lib/context/region';

export const dynamic = 'force-dynamic';

const SUPPORTED_REGIONS = new Set(['hormuz', 'suez', 'babel_mandeb', 'gulf_of_aden']);
export async function GET(_request: Request, context: { params: Promise<{ region: string }> }) {
  if (!isCanaryEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const { region } = await context.params;
  if (!SUPPORTED_REGIONS.has(region)) {
    return NextResponse.json({ error: 'Unknown region' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const contextData = await loadRegionContext(region as 'hormuz' | 'suez' | 'babel_mandeb' | 'gulf_of_aden');

  return NextResponse.json(contextData, { headers: { 'Cache-Control': 'no-store' } });
}
