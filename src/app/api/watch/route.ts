/**
 * GET /api/watch — Current watch.
 *
 * Up to three evidence-backed observations for the first screen: a contact
 * with a new event, a region whose traffic moved, and a coverage gap. Each
 * carries a map target so the dashboard can take the visitor straight to
 * the supporting view. Composition rules live in src/lib/watch/compose.ts.
 */
import { NextResponse } from 'next/server';
import { getCurrentWatch } from '@/lib/watch/current-watch';

export async function GET() {
  try {
    const watch = await getCurrentWatch();
    return NextResponse.json(watch, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('[API] Failed to compose current watch:', error);
    return NextResponse.json({ error: 'Failed to compose current watch', items: [] }, { status: 500 });
  }
}
