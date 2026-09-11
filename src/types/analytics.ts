/**
 * Analytics Type Definitions (HIST-01)
 *
 * Type definitions for historical analytics data structures.
 * Used by analytics queries, API routes, and chart components.
 */

/** Time range options for analytics queries */
export type TimeRange = '7d' | '30d' | '90d';

/** Ship type filter for analytics queries */
export type ShipTypeFilter = 'all' | 'tanker' | 'cargo' | 'other';

/**
 * Convert TimeRange to days number for query.
 *
 * @param range - Time range string ('7d', '30d', '90d')
 * @returns Number of days
 */
export function timeRangeToDays(range: TimeRange): number {
  const map: Record<TimeRange, number> = { '7d': 7, '30d': 30, '90d': 90 };
  return map[range];
}

/** Daily traffic data point for charts */
export interface DailyTrafficPoint {
  date: string;           // ISO date (YYYY-MM-DD)
  vesselCount: number;    // Total unique vessels
  tankerCount: number;    // Tankers only (ship_type 80-89)
}

/** Traffic point with optional oil price for overlay charts */
export interface TrafficWithPrices extends DailyTrafficPoint {
  oilPrice?: number;      // WTI or Brent price for that day
}

/**
 * What position history actually exists for a zone, independent of the
 * requested range. Lets an empty chart say *why* it is empty and where the
 * data is, instead of drawing an empty frame.
 */
export interface TrafficCoverage {
  /** Earliest observed day (YYYY-MM-DD) within the coverage lookback, or null. */
  firstObservation: string | null;
  /** Latest observed day (YYYY-MM-DD) within the coverage lookback, or null. */
  lastObservation: string | null;
  /** Number of distinct days with at least one fix in the lookback. */
  observedDays: number;
  /** Lookback window the coverage summary was computed over. */
  lookbackDays: number;
}

/** Route destination regions for grouping */
export type RouteRegion = 'east_asia' | 'europe' | 'americas' | 'unknown';

/** Traffic grouped by route region */
export interface RouteTrafficPoint extends DailyTrafficPoint {
  route: RouteRegion;
}
