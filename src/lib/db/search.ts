/**
 * Vessel search functionality for autocomplete.
 * Searches by IMO (exact), MMSI (exact), or name (partial ILIKE).
 * Requirements: MAP-06
 */
import { pool } from './index';

export interface VesselSearchResult {
  imo: string;
  mmsi: string;
  name: string;
  flag: string;
  shipType: number;
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

  // Search by IMO (exact), MMSI (exact), or name (partial ILIKE)
  // Priority: IMO match > MMSI match > name match
  const result = await pool.query<VesselSearchResult>(`
    SELECT v.imo, v.mmsi, v.name, v.flag, v.ship_type as "shipType",
           p.latitude, p.longitude
    FROM vessels v
    LEFT JOIN LATERAL (
      SELECT latitude, longitude FROM vessel_positions
      WHERE mmsi = v.mmsi ORDER BY time DESC LIMIT 1
    ) p ON true
    WHERE v.imo = $1
       OR v.mmsi = $1
       OR v.name ILIKE $2
    ORDER BY
      CASE WHEN v.imo = $1 THEN 0
           WHEN v.mmsi = $1 THEN 1
           ELSE 2 END,
      v.name
    LIMIT 10
  `, [q, `%${q}%`]);

  return result.rows;
}
