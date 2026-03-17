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

/**
 * A vessel currently inside a chokepoint zone, enriched with anomaly status.
 */
export interface ChokepointVessel {
  mmsi: string;
  imo: string | null;
  name: string | null;
  flag: string | null;
  shipType: number | null;
  latitude: number;
  longitude: number;
  hasActiveAnomaly: boolean;
  anomalyType: string | null;
}

/**
 * Get all vessels currently inside a chokepoint's bounding box.
 * Only considers positions from the last hour for freshness.
 * Enriches each vessel with active anomaly status.
 *
 * @param chokepointId - Chokepoint identifier (e.g. 'hormuz', 'suez', 'babel_mandeb')
 * @returns Array of vessels, or null if the chokepoint ID is unknown
 */
export async function getVesselsInChokepoint(chokepointId: string): Promise<ChokepointVessel[] | null> {
  const cp = CHOKEPOINTS[chokepointId];
  if (!cp) return null;

  const { bounds } = cp;

  const result = await pool.query<ChokepointVessel>(`
    SELECT DISTINCT ON (vp.mmsi)
      vp.mmsi,
      v.imo,
      v.name,
      v.flag,
      v.ship_type AS "shipType",
      vp.latitude,
      vp.longitude,
      CASE WHEN a.imo IS NOT NULL THEN true ELSE false END AS "hasActiveAnomaly",
      a.anomaly_type AS "anomalyType"
    FROM vessel_positions vp
    LEFT JOIN vessels v ON v.mmsi = vp.mmsi
    LEFT JOIN vessel_anomalies a ON v.imo = a.imo AND a.resolved_at IS NULL
    WHERE vp.time > NOW() - INTERVAL '1 hour'
      AND vp.latitude BETWEEN $1 AND $2
      AND vp.longitude BETWEEN $3 AND $4
    ORDER BY vp.mmsi, vp.time DESC
  `, [bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon]);

  return result.rows;
}
