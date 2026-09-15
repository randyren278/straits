/**
 * GET /api/chokepoints/[id]/crossings?range=7d|30d|90d[&day=YYYY-MM-DD]
 *
 * Daily observed crossings from the durable chokepoint_daily table, plus —
 * when `day` is given and its raw positions are still retained — the voyages
 * that were counted, recomputed on demand. Only Suez has a crossing model.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getChokepointDaily, loadSuezTracks } from '@/lib/db/crossings';
import { computeCrossings, crossingDay, type Crossing } from '@/lib/analytics/crossings';

export const dynamic = 'force-dynamic';

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? 7);

export interface VoyageRow {
  mmsi: string;
  direction: Crossing['direction'];
  status: Crossing['status'];
  gateInAt: string;
  gateOutAt: string | null;
  durationMinutes: number | null;
  reason: string | null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== 'suez') {
    return NextResponse.json({ error: 'No crossing model for this chokepoint', days: [] }, { status: 404 });
  }
  const range = request.nextUrl.searchParams.get('range') ?? '7d';
  const days = RANGE_DAYS[range];
  if (!days) return NextResponse.json({ error: 'range must be 7d, 30d or 90d', days: [] }, { status: 400 });
  const day = request.nextUrl.searchParams.get('day');
  if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: 'day must be YYYY-MM-DD', days: [] }, { status: 400 });
  }

  try {
    const daily = await getChokepointDaily('suez', days);
    let voyages: VoyageRow[] | null = null;
    let reason: string | null = null;
    if (day) {
      const ageDays = (Date.now() - Date.parse(`${day}T00:00:00Z`)) / 86_400_000;
      if (ageDays > RETENTION_DAYS) {
        reason = 'raw positions pruned';
      } else {
        // Load enough history for a passage that started the day before.
        const tracks = await loadSuezTracks(Math.min(RETENTION_DAYS, Math.ceil(ageDays) + 2));
        voyages = computeCrossings(tracks)
          .filter((c) => crossingDay(c) === day)
          .map((c) => ({
            mmsi: c.mmsi, direction: c.direction, status: c.status,
            gateInAt: c.gateInAt.toISOString(),
            gateOutAt: c.gateOutAt ? c.gateOutAt.toISOString() : null,
            durationMinutes: c.gateOutAt ? Math.round((c.gateOutAt.getTime() - c.gateInAt.getTime()) / 60_000) : null,
            reason: c.reason ?? null,
          }));
      }
    }
    return NextResponse.json({ chokepoint: 'suez', range, days: daily, day, voyages, reason });
  } catch (error) {
    console.error('Failed to load crossings:', error);
    return NextResponse.json({ error: 'Failed to load crossings', days: [] }, { status: 500 });
  }
}
