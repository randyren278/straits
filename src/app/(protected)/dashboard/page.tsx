/**
 * Dashboard page entry — server component.
 * Picks the initial map view server-side: whichever chokepoint currently
 * has the most live vessels, so the map paints once already centered on
 * the busiest region instead of a fixed default.
 * Requirements: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, MAP-07, MAP-08, INTL-02, INTL-03, ANOM-01, HIST-02
 */
import { getChokepointStats } from '@/lib/geo/chokepoints';
import type { MapCenter } from '@/stores/vessel';
import { DashboardClient } from './DashboardClient';

// Vessel density changes constantly — never bake a build-time snapshot.
export const dynamic = 'force-dynamic';

async function getInitialCenter(): Promise<MapCenter | undefined> {
  try {
    const stats = await getChokepointStats();
    const densest = stats.reduce(
      (max, s) => (s.totalVessels > max.totalVessels ? s : max),
      stats[0],
    );
    if (!densest || densest.totalVessels === 0) return undefined;

    return {
      lat: (densest.bounds.minLat + densest.bounds.maxLat) / 2,
      lon: (densest.bounds.minLon + densest.bounds.maxLon) / 2,
      zoom: 8,
    };
  } catch (error) {
    console.error('Failed to compute densest chokepoint, falling back to default view:', error);
    return undefined;
  }
}

export default async function DashboardPage() {
  const initialCenter = await getInitialCenter();
  return <DashboardClient initialCenter={initialCenter} />;
}
