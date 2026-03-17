/**
 * Analytics Correlation API (HIST-01, ANLX-05)
 *
 * GET /api/analytics/correlation
 * Returns combined traffic and oil price data for correlation charts.
 *
 * Query params:
 * - range: TimeRange ('7d', '30d', '90d') - default '30d'
 * - chokepoint: chokepoint ID - default 'hormuz'
 * - priceSymbol: 'WTI' | 'BRENT' - default 'WTI'
 * - shipType: ShipTypeFilter ('all'|'tanker'|'cargo'|'other') - default 'all'
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrafficByChokepoint, getPriceHistoryForOverlay } from '@/lib/db/analytics';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints';
import type { TimeRange, TrafficWithPrices, ShipTypeFilter } from '@/types/analytics';

const VALID_RANGES: TimeRange[] = ['7d', '30d', '90d'];
const VALID_SYMBOLS = ['WTI', 'BRENT'];
const VALID_SHIP_TYPES: ShipTypeFilter[] = ['all', 'tanker', 'cargo', 'other'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse time range
    const rangeParam = searchParams.get('range') || '30d';
    const range: TimeRange = VALID_RANGES.includes(rangeParam as TimeRange)
      ? (rangeParam as TimeRange)
      : '30d';

    // Parse chokepoint
    const chokepointId = searchParams.get('chokepoint') || 'hormuz';
    if (!CHOKEPOINTS[chokepointId]) {
      return NextResponse.json(
        { error: `Invalid chokepoint: ${chokepointId}` },
        { status: 400 }
      );
    }

    // Parse price symbol
    const symbolParam = searchParams.get('priceSymbol') || 'WTI';
    const priceSymbol = VALID_SYMBOLS.includes(symbolParam) ? symbolParam : 'WTI';

    // Parse ship type filter
    const shipTypeParam = searchParams.get('shipType') || 'all';
    const shipTypeFilter: ShipTypeFilter = VALID_SHIP_TYPES.includes(shipTypeParam as ShipTypeFilter)
      ? (shipTypeParam as ShipTypeFilter)
      : 'all';

    // Fetch traffic and prices in parallel — oil prices are independent of ship type
    const [trafficData, priceData] = await Promise.all([
      getTrafficByChokepoint(chokepointId, range, shipTypeFilter),
      getPriceHistoryForOverlay(priceSymbol, range),
    ]);

    // Create price lookup by date
    const priceByDate = new Map(priceData.map(p => [p.date, p.price]));

    // Merge traffic with prices
    const correlationData: TrafficWithPrices[] = trafficData.map(traffic => ({
      ...traffic,
      oilPrice: priceByDate.get(traffic.date),
    }));

    return NextResponse.json({
      chokepoint: chokepointId,
      chokepointName: CHOKEPOINTS[chokepointId].name,
      priceSymbol,
      range,
      data: correlationData,
    });
  } catch (error) {
    console.error('Analytics correlation API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch correlation data' },
      { status: 500 }
    );
  }
}
