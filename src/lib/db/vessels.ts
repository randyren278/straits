/**
 * Vessel metadata CRUD operations.
 * Uses IMO as primary key per DATA-03 decision (MMSI can be reused/spoofed).
 */
import { pool } from './index';
import type { Vessel } from '../../types/vessel';

/**
 * Insert or update a vessel by IMO number.
 * Uses ON CONFLICT DO UPDATE to handle the case where a vessel's metadata changes.
 * COALESCE preserves existing values when new values are null.
 *
 * @param vessel - Vessel data (without lastSeen which is set to NOW())
 */
export async function upsertVessel(vessel: Omit<Vessel, 'lastSeen'>): Promise<void> {
  await pool.query(
    `INSERT INTO vessels (imo, mmsi, name, flag, ship_type, destination, last_seen)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (imo) DO UPDATE SET
       mmsi = EXCLUDED.mmsi,
       name = EXCLUDED.name,
       flag = COALESCE(EXCLUDED.flag, vessels.flag),
       ship_type = COALESCE(EXCLUDED.ship_type, vessels.ship_type),
       destination = COALESCE(EXCLUDED.destination, vessels.destination),
       last_seen = NOW()`,
    [vessel.imo, vessel.mmsi, vessel.name, vessel.flag, vessel.shipType, vessel.destination]
  );
}

/**
 * Get a single vessel by IMO number.
 *
 * @param imo - IMO number to look up
 * @returns Vessel if found, null otherwise
 */
export async function getVessel(imo: string): Promise<Vessel | null> {
  const result = await pool.query<Vessel>(
    `SELECT imo, mmsi, name, flag, ship_type as "shipType", destination, last_seen as "lastSeen"
     FROM vessels WHERE imo = $1`,
    [imo]
  );
  return result.rows[0] || null;
}

/**
 * Get all vessels, optionally filtered to tankers only.
 * Ship type codes 80-89 are tankers per AIS specification.
 *
 * @param tankersOnly - If true, only return vessels with ship_type 80-89
 * @returns Array of vessels, ordered by last_seen DESC
 */
export async function getAllVessels(tankersOnly: boolean = false): Promise<Vessel[]> {
  const sql = tankersOnly
    ? `SELECT imo, mmsi, name, flag, ship_type as "shipType", destination, last_seen as "lastSeen"
       FROM vessels WHERE ship_type BETWEEN 80 AND 89 ORDER BY last_seen DESC`
    : `SELECT imo, mmsi, name, flag, ship_type as "shipType", destination, last_seen as "lastSeen"
       FROM vessels ORDER BY last_seen DESC`;

  const result = await pool.query<Vessel>(sql);
  return result.rows;
}
