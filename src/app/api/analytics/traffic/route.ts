/**
 * Analytics Traffic API (HIST-01)
 *
 * GET /api/analytics/traffic
 * Returns daily vessel traffic by chokepoint or route.
 *
 * Query params:
 * - range: TimeRange ('7d', '30d', '90d') - default '30d'
 * - groupBy: 'chokepoint' | 'route' - default 'chokepoint'
 * - chokepoints: comma-separated IDs (for groupBy=chokepoint)
 * - routes: comma-separated route regions (for groupBy=route)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrafficByChokepoint, getTrafficByRoute } from '@/lib/db/analytics';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints';
import type { TimeRange, DailyTrafficPoint, RouteRegion } from '@/types/analytics';

const VALID_RANGES: TimeRange[] = ['7d', '30d', '90d'];
const VALID_ROUTES: RouteRegion[] = ['east_asia', 'europe', 'americas', 'unknown'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse time range
    const rangeParam = searchParams.get('range') || '30d';
    const range: TimeRange = VALID_RANGES.includes(rangeParam as TimeRange)
      ? (rangeParam as TimeRange)
      : '30d';

    // Parse group by mode
    const groupBy = searchParams.get('groupBy') || 'chokepoint';

    if (groupBy === 'route') {
      // Route-based grouping
      const routesParam = searchParams.get('routes');
      const selectedRoutes = routesParam
        ? routesParam.split(',').filter(r => VALID_ROUTES.includes(r as RouteRegion)) as RouteRegion[]
        : VALID_ROUTES;

      const allRouteData = await getTrafficByRoute(range);

      // Filter to selected routes
      const filteredData = selectedRoutes.length > 0
        ? allRouteData.filter(d => selectedRoutes.includes(d.route))
        : allRouteData;

      return NextResponse.json({
        groupBy: 'route',
        range,
        data: filteredData,
      });
    } else {
      // Chokepoint-based grouping (default)
      const chokepointsParam = searchParams.get('chokepoints');
      const selectedChokepoints = chokepointsParam
        ? chokepointsParam.split(',').filter(id => CHOKEPOINTS[id])
        : Object.keys(CHOKEPOINTS);

      // Fetch traffic for each chokepoint
      const results: Record<string, DailyTrafficPoint[]> = {};

      for (const cpId of selectedChokepoints) {
        results[cpId] = await getTrafficByChokepoint(cpId, range);
      }

      return NextResponse.json({
        groupBy: 'chokepoint',
        range,
        data: results,
      });
    }
  } catch (error) {
    console.error('Analytics traffic API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
