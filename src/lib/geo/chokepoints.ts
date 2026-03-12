/**
 * Chokepoint Detection (MAP-07)
 *
 * Server-side functions for chokepoint vessel counting.
 * Uses database queries - DO NOT import in client components.
 */
import { pool } from '../db';
import { CHOKEPOINTS, type ChokepointBounds, type Chokepoint } from './chokepoints-constants';

// Re-export constants for backward compatibility
export { CHOKEPOINTS, isInChokepoint, type Chokepoint, type ChokepointBounds } from './chokepoints-constants';

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
