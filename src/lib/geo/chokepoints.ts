/**
 * Chokepoint Detection (MAP-07)
 *
 * Server-side functions for chokepoint vessel counting.
 * Uses database queries - DO NOT import in client components.
 */
import { pool } from '../db';
import { observedQuery } from '../db/observed-query';
import { CHOKEPOINTS, type ChokepointBounds, type Chokepoint } from './chokepoints-constants';
import { CHOKEPOINT_STALENESS_INTERVAL } from '../constants/staleness';

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
 * Only counts positions from the configured display freshness window.
 * Separates tanker count (ship types 80-89) from total.
 * Fallback-relayed contacts have no IMO and never enter `vessels`, so the
 * join must be LEFT and the type must fall back to vessel_fallback_metadata —
 * otherwise a region observed only by the fallback counts as empty.
 *
 * @param bounds - Chokepoint bounding box
 * @returns Object with total and tanker counts
 */
export async function countVesselsInChokepoint(bounds: ChokepointBounds): Promise<{ total: number; tankers: number }> {
  const result = await observedQuery<{ total: number; tankers: number }>('chokepoint-count', `
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE COALESCE(v.ship_type, fallback.ship_type) BETWEEN 80 AND 89)::int as tankers
    FROM vessel_latest_positions p
    LEFT JOIN LATERAL (
      SELECT ship_type FROM vessels WHERE mmsi = p.mmsi
      ORDER BY (imo = p.imo) DESC NULLS LAST, last_seen DESC, imo LIMIT 1
    ) v ON true
    LEFT JOIN vessel_fallback_metadata fallback ON fallback.mmsi = p.mmsi
    WHERE p.time > NOW() - INTERVAL '${CHOKEPOINT_STALENESS_INTERVAL}'
      AND p.latitude BETWEEN $1 AND $2
      AND p.longitude BETWEEN $3 AND $4
  `, [bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon]);

  return result.rows[0] || { total: 0, tankers: 0 };
}

/**
 * Get all chokepoint counts with one bounded latest-position read.
 *
 * @returns Array of chokepoint statistics
 */
export async function getChokepointStats(): Promise<ChokepointStats[]> {
  const chokepoints = Object.values(CHOKEPOINTS);
  const values = chokepoints.map((_, i) => {
    const n = i * 5;
    return `($${n + 1}::text, $${n + 2}::double precision, $${n + 3}::double precision, $${n + 4}::double precision, $${n + 5}::double precision)`;
  }).join(', ');
  const params = chokepoints.flatMap((cp) => [cp.id, cp.bounds.minLat, cp.bounds.maxLat, cp.bounds.minLon, cp.bounds.maxLon]);
  const result = await observedQuery<{ id: string; total: number; tankers: number }>('chokepoint-stats', `
    WITH cp(id, min_lat, max_lat, min_lon, max_lon) AS (VALUES ${values})
    SELECT cp.id,
      COUNT(p.mmsi)::int AS total,
      COUNT(p.mmsi) FILTER (WHERE COALESCE(v.ship_type, fallback.ship_type) BETWEEN 80 AND 89)::int AS tankers
    FROM cp
    LEFT JOIN vessel_latest_positions p ON p.time > NOW() - INTERVAL '${CHOKEPOINT_STALENESS_INTERVAL}'
      AND p.latitude BETWEEN cp.min_lat AND cp.max_lat
      AND p.longitude BETWEEN cp.min_lon AND cp.max_lon
    LEFT JOIN LATERAL (
      SELECT ship_type FROM vessels WHERE mmsi = p.mmsi
      ORDER BY (imo = p.imo) DESC NULLS LAST, last_seen DESC, imo LIMIT 1
    ) v ON true
    LEFT JOIN vessel_fallback_metadata fallback ON fallback.mmsi = p.mmsi
    GROUP BY cp.id
  `, params);
  const byId = new Map(result.rows.map((row) => [row.id, row]));
  return chokepoints.map((cp) => ({
    id: cp.id, name: cp.name, bounds: cp.bounds,
    totalVessels: byId.get(cp.id)?.total ?? 0,
    tankerCount: byId.get(cp.id)?.tankers ?? 0,
  }));
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
  navStatus: number | null;
}

/**
 * Get all vessels currently inside a chokepoint's bounding box.
 * Only considers positions from the configured display freshness window.
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
    SELECT
      vp.mmsi,
      v.imo,
      COALESCE(v.name, fallback.name) AS name,
      v.flag,
      COALESCE(v.ship_type, fallback.ship_type) AS "shipType",
      vp.latitude,
      vp.longitude,
      vp.nav_status AS "navStatus",
      CASE WHEN a.imo IS NOT NULL THEN true ELSE false END AS "hasActiveAnomaly",
      a.anomaly_type AS "anomalyType"
    FROM vessel_latest_positions vp
    LEFT JOIN LATERAL (
      SELECT * FROM vessels WHERE mmsi = vp.mmsi
      ORDER BY (imo = vp.imo) DESC NULLS LAST, last_seen DESC, imo LIMIT 1
    ) v ON true
    LEFT JOIN vessel_fallback_metadata fallback ON fallback.mmsi = vp.mmsi
    LEFT JOIN LATERAL (
      SELECT anomaly_type, imo FROM vessel_anomalies
      WHERE imo = v.imo AND resolved_at IS NULL
      ORDER BY detected_at DESC LIMIT 1
    ) a ON true
    WHERE vp.time > NOW() - INTERVAL '${CHOKEPOINT_STALENESS_INTERVAL}'
      AND vp.latitude BETWEEN $1 AND $2
      AND vp.longitude BETWEEN $3 AND $4
    ORDER BY vp.time DESC
  `, [bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon]);

  return result.rows;
}
