/**
 * Analytics Database Queries (HIST-01)
 *
 * Aggregation queries for historical traffic analysis.
 * Uses TimescaleDB time_bucket for efficient daily grouping.
 */
import { pool } from './index';
import { CHOKEPOINTS } from '../geo/chokepoints';
import { classifyRoute } from '../analytics/routes';
import type { DailyTrafficPoint, RouteTrafficPoint, TimeRange, ShipTypeFilter } from '@/types/analytics';
import { timeRangeToDays } from '@/types/analytics';

/**
 * Get daily vessel traffic for a chokepoint over time range.
 * Uses time_bucket for efficient TimescaleDB aggregation.
 *
 * @param chokepointId - ID from CHOKEPOINTS (hormuz, babel_mandeb, suez)
 * @param range - Time range ('7d', '30d', '90d')
 * @param shipTypeFilter - Optional ship type filter (default 'all' = no filter)
 * @returns Daily traffic points sorted by date ascending
 */
export async function getTrafficByChokepoint(
  chokepointId: string,
  range: TimeRange,
  shipTypeFilter: ShipTypeFilter = 'all'
): Promise<DailyTrafficPoint[]> {
  const chokepoint = CHOKEPOINTS[chokepointId];
  if (!chokepoint) return [];

  const { minLat, maxLat, minLon, maxLon } = chokepoint.bounds;
  const days = timeRangeToDays(range);

  // Build controlled SQL clause from validated enum — never inject raw user input
  const shipTypeClause = (() => {
    switch (shipTypeFilter) {
      case 'tanker': return 'AND v.ship_type BETWEEN 80 AND 89';
      case 'cargo':  return 'AND v.ship_type BETWEEN 70 AND 79';
      case 'other':  return 'AND (v.ship_type IS NULL OR v.ship_type NOT BETWEEN 70 AND 89)';
      default:       return ''; // 'all' — no additional ship_type filter
    }
  })();

  const result = await pool.query<{
    bucket_day: Date;
    vessel_count: string;
    tanker_count: string;
  }>(`
    SELECT
      time_bucket('1 day', vp.time) AS bucket_day,
      COUNT(DISTINCT vp.mmsi)::text AS vessel_count,
      COUNT(DISTINCT vp.mmsi) FILTER (WHERE v.ship_type BETWEEN 80 AND 89)::text AS tanker_count
    FROM vessel_positions vp
    LEFT JOIN vessels v ON vp.mmsi = v.mmsi
    WHERE vp.time > NOW() - $1::interval
      AND vp.latitude BETWEEN $2 AND $3
      AND vp.longitude BETWEEN $4 AND $5
      ${shipTypeClause}
    GROUP BY bucket_day
    ORDER BY bucket_day ASC
  `, [`${days} days`, minLat, maxLat, minLon, maxLon]);

  return result.rows.map(row => ({
    date: row.bucket_day.toISOString().split('T')[0],
    vesselCount: parseInt(row.vessel_count, 10),
    tankerCount: parseInt(row.tanker_count, 10),
  }));
}

/**
 * Get daily vessel traffic grouped by destination route region.
 *
 * @param range - Time range ('7d', '30d', '90d')
 * @param shipTypeFilter - Optional ship type filter (default 'all' = no filter)
 * @returns Daily traffic points with route classification
 */
export async function getTrafficByRoute(
  range: TimeRange,
  shipTypeFilter: ShipTypeFilter = 'all'
): Promise<RouteTrafficPoint[]> {
  const days = timeRangeToDays(range);

  // Build controlled SQL clause from validated enum — never inject raw user input
  const shipTypeClause = (() => {
    switch (shipTypeFilter) {
      case 'tanker': return 'AND v.ship_type BETWEEN 80 AND 89';
      case 'cargo':  return 'AND v.ship_type BETWEEN 70 AND 79';
      case 'other':  return 'AND (v.ship_type IS NULL OR v.ship_type NOT BETWEEN 70 AND 89)';
      default:       return ''; // 'all' — no additional ship_type filter
    }
  })();

  // Get vessels with destinations and their daily positions
  const result = await pool.query<{
    bucket_day: Date;
    destination: string | null;
    vessel_count: string;
    tanker_count: string;
  }>(`
    SELECT
      time_bucket('1 day', vp.time) AS bucket_day,
      v.destination,
      COUNT(DISTINCT vp.mmsi)::text AS vessel_count,
      COUNT(DISTINCT vp.mmsi) FILTER (WHERE v.ship_type BETWEEN 80 AND 89)::text AS tanker_count
    FROM vessel_positions vp
    LEFT JOIN vessels v ON vp.mmsi = v.mmsi
    WHERE vp.time > NOW() - $1::interval
      ${shipTypeClause}
    GROUP BY bucket_day, v.destination
    ORDER BY bucket_day ASC
  `, [`${days} days`]);

  // Aggregate by route region (classifyRoute handles destination -> region mapping)
  const byDayAndRoute = new Map<string, RouteTrafficPoint>();

  for (const row of result.rows) {
    const date = row.bucket_day.toISOString().split('T')[0];
    const route = classifyRoute(row.destination);
    const key = `${date}:${route}`;

    const existing = byDayAndRoute.get(key);
    if (existing) {
      existing.vesselCount += parseInt(row.vessel_count, 10);
      existing.tankerCount += parseInt(row.tanker_count, 10);
    } else {
      byDayAndRoute.set(key, {
        date,
        route,
        vesselCount: parseInt(row.vessel_count, 10),
        tankerCount: parseInt(row.tanker_count, 10),
      });
    }
  }

  return Array.from(byDayAndRoute.values()).sort((a, b) =>
    a.date.localeCompare(b.date) || a.route.localeCompare(b.route)
  );
}

/**
 * Get oil price history for chart overlay.
 * Returns daily average prices for specified symbol.
 *
 * @param symbol - Oil price symbol ('WTI' or 'BRENT')
 * @param range - Time range
 * @returns Daily price points sorted by date ascending
 */
export async function getPriceHistoryForOverlay(
  symbol: string,
  range: TimeRange
): Promise<{ date: string; price: number }[]> {
  const days = timeRangeToDays(range);

  const result = await pool.query<{ date: Date; price: string }>(`
    SELECT
      DATE(fetched_at) as date,
      AVG(price)::numeric(10,2)::text as price
    FROM oil_prices
    WHERE symbol = $1
      AND fetched_at > NOW() - $2::interval
    GROUP BY DATE(fetched_at)
    ORDER BY date ASC
  `, [symbol, `${days} days`]);

  return result.rows.map(row => ({
    date: row.date.toISOString().split('T')[0],
    price: parseFloat(row.price),
  }));
}
