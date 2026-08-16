/**
 * Vessel search functionality for autocomplete.
 * Searches by IMO (exact), MMSI (exact), or name (partial ILIKE).
 * Requirements: MAP-06
 */
import { pool } from './index';

export interface VesselSearchResult {
  imo: string | null;
  mmsi: string;
  name: string;
  flag: string | null;
  shipType: number | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Search vessels by IMO, MMSI, or name.
 * Returns up to 10 results with latest position data.
 *
 * @param query - Search string (min 2 characters)
 * @returns Array of matching vessels with positions
 *
 * @example
 * const results = await searchVessels('tanker');
 * const byIMO = await searchVessels('1234567');
 */
export async function searchVessels(query: string): Promise<VesselSearchResult[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  // Search canonical AISStream metadata and the MMSI-keyed fallback metadata.
  // A fallback-only vessel has no safe IMO claim, but it remains searchable by
  // its live name/MMSI and can still be opened on the map.
  const result = await pool.query<VesselSearchResult>(`
    SELECT identity.imo, identity.mmsi, identity.name, identity.flag, identity."shipType",
           p.latitude, p.longitude
    FROM (
      SELECT
        v.imo,
        COALESCE(v.mmsi, fallback.mmsi) AS mmsi,
        COALESCE(v.name, fallback.name) AS name,
        v.flag,
        COALESCE(v.ship_type, fallback.ship_type) AS "shipType"
      FROM vessels v
      FULL OUTER JOIN vessel_fallback_metadata fallback ON fallback.mmsi = v.mmsi
    ) identity
    LEFT JOIN LATERAL (
      SELECT latitude, longitude FROM vessel_positions
      WHERE mmsi = identity.mmsi ORDER BY time DESC LIMIT 1
    ) p ON true
    WHERE identity.imo = $1
       OR identity.mmsi = $1
       OR identity.name ILIKE $2
    ORDER BY
      CASE WHEN identity.imo = $1 THEN 0
           WHEN identity.mmsi = $1 THEN 1
           ELSE 2 END,
      identity.name
    LIMIT 10
  `, [q, `%${q}%`]);

  return result.rows;
}
