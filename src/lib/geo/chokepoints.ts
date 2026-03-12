/**
 * Chokepoint Detection (MAP-07)
 *
 * Defines bounding boxes for critical maritime chokepoints in the Middle East.
 * Used for geofence alerts and vessel tracking at key transit points.
 */
import { pool } from '../db';

export interface ChokepointBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface Chokepoint {
  id: string;
  name: string;
  bounds: ChokepointBounds;
}

/**
 * Critical maritime chokepoints for Middle East oil transit.
 * Coordinates define bounding boxes for vessel detection.
 */
export const CHOKEPOINTS: Record<string, Chokepoint> = {
  hormuz: {
    id: 'hormuz',
    name: 'Strait of Hormuz',
    bounds: { minLat: 26.0, maxLat: 27.0, minLon: 55.5, maxLon: 57.0 },
  },
  babel_mandeb: {
    id: 'babel_mandeb',
    name: 'Bab el-Mandeb',
    bounds: { minLat: 12.4, maxLat: 13.0, minLon: 43.0, maxLon: 43.7 },
  },
  suez: {
    id: 'suez',
    name: 'Suez Canal',
    bounds: { minLat: 29.8, maxLat: 31.3, minLon: 32.2, maxLon: 32.6 },
  },
};

/**
 * Check if a coordinate is within a chokepoint's bounding box.
 * Uses inclusive bounds check (edge points are inside).
 *
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @param bounds - Chokepoint bounding box
 * @returns True if coordinate is within bounds
 */
export function isInChokepoint(lat: number, lon: number, bounds: ChokepointBounds): boolean {
  return lat >= bounds.minLat && lat <= bounds.maxLat &&
         lon >= bounds.minLon && lon <= bounds.maxLon;
}

/**
 * Statistics for a single chokepoint.
 */
export interface ChokepointStats {
  id: string;
  name: string;
  totalVessels: number;
  tankerCount: number;
  bounds: ChokepointBounds;
}

/**
 * Count vessels within a chokepoint bounding box.
 * Only counts positions from the last hour for freshness.
 * Separates tanker count (ship types 80-89) from total.
 *
 * @param bounds - Chokepoint bounding box
 * @returns Object with total and tanker counts
 */
export async function countVesselsInChokepoint(bounds: ChokepointBounds): Promise<{ total: number; tankers: number }> {
  const result = await pool.query<{ total: number; tankers: number }>(`
    WITH latest_positions AS (
      SELECT DISTINCT ON (vp.mmsi) vp.mmsi, vp.latitude, vp.longitude, v.ship_type
      FROM vessel_positions vp
      JOIN vessels v ON vp.mmsi = v.mmsi
      WHERE vp.time > NOW() - INTERVAL '1 hour'
      ORDER BY vp.mmsi, vp.time DESC
    )
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE ship_type BETWEEN 80 AND 89)::int as tankers
    FROM latest_positions
    WHERE latitude BETWEEN $1 AND $2
      AND longitude BETWEEN $3 AND $4
  `, [bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon]);

  return result.rows[0] || { total: 0, tankers: 0 };
}

/**
 * Get vessel counts for all three chokepoints.
 *
 * @returns Array of chokepoint statistics
 */
export async function getChokepointStats(): Promise<ChokepointStats[]> {
  const stats = await Promise.all(
    Object.values(CHOKEPOINTS).map(async (cp) => {
      const counts = await countVesselsInChokepoint(cp.bounds);
      return {
        id: cp.id,
        name: cp.name,
        totalVessels: counts.total,
        tankerCount: counts.tankers,
        bounds: cp.bounds,
      };
    })
  );

  return stats;
}
