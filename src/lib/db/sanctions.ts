/**
 * Sanctions CRUD operations for vessel_sanctions table.
 * INTL-01: Sanctions matching.
 */
import { pool } from './index';
import type { SanctionEntry } from '../external/opensanctions';
import type { VesselWithPosition, VesselPosition } from '@/types/vessel';

export interface SanctionRecord {
  imo: string;
  sanctioningAuthority: string;
  listDate: Date | null;
  reason: string | null;
  confidence: string;
}

export interface VesselWithSanctions extends VesselWithPosition {
  isSanctioned: boolean;
  sanctioningAuthority: string | null;
  sanctionReason: string | null;
}

/**
 * Insert or update a sanction entry.
 * Uses ON CONFLICT to handle upsert logic.
 */
export async function upsertSanction(entry: SanctionEntry): Promise<void> {
  await pool.query(
    `
    INSERT INTO vessel_sanctions (imo, sanctioning_authority, list_date, reason, source_url, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (imo) DO UPDATE SET
      sanctioning_authority = EXCLUDED.sanctioning_authority,
      list_date = EXCLUDED.list_date,
      reason = EXCLUDED.reason,
      source_url = EXCLUDED.source_url,
      updated_at = NOW()
  `,
    [entry.imo, entry.authority, entry.listDate, entry.reason, entry.sourceUrl]
  );
}

/**
 * Get sanction record by IMO number.
 */
export async function getSanction(imo: string): Promise<SanctionRecord | null> {
  const result = await pool.query(
    `
    SELECT imo, sanctioning_authority as "sanctioningAuthority",
           list_date as "listDate", reason, confidence
    FROM vessel_sanctions WHERE imo = $1
  `,
    [imo]
  );
  return result.rows[0] || null;
}

// Internal row type for query result
interface VesselSanctionsRow {
  imo: string;
  mmsi: string;
  name: string;
  flag: string;
  shipType: number;
  destination: string | null;
  lastSeen: Date;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  course: number | null;
  heading: number | null;
  navStatus: number | null;
  lowConfidence: boolean;
  time: Date | null;
  isSanctioned: boolean;
  sanctioningAuthority: string | null;
  sanctionReason: string | null;
}

/**
 * Get vessels with sanctions data via LEFT JOIN.
 * Returns vessels enriched with sanctions information.
 */
export async function getVesselsWithSanctions(
  tankersOnly: boolean = false
): Promise<VesselWithSanctions[]> {
  const result = await pool.query<VesselSanctionsRow>(
    `
    SELECT v.imo, v.mmsi, v.name, v.flag, v.ship_type as "shipType",
           v.destination, v.last_seen as "lastSeen",
           p.latitude, p.longitude, p.speed, p.course, p.heading,
           p.nav_status as "navStatus", p.low_confidence as "lowConfidence", p.time,
           CASE WHEN s.imo IS NOT NULL THEN true ELSE false END as "isSanctioned",
           s.sanctioning_authority as "sanctioningAuthority",
           s.reason as "sanctionReason"
    FROM vessels v
    LEFT JOIN LATERAL (
      SELECT * FROM vessel_positions WHERE mmsi = v.mmsi
      ORDER BY time DESC LIMIT 1
    ) p ON true
    LEFT JOIN vessel_sanctions s ON v.imo = s.imo
    ${tankersOnly ? 'WHERE v.ship_type BETWEEN 80 AND 89' : ''}
    ORDER BY v.last_seen DESC
  `
  );

  // Transform rows to VesselWithSanctions with nested position
  return result.rows.map((row) => ({
    imo: row.imo,
    mmsi: row.mmsi,
    name: row.name,
    flag: row.flag,
    shipType: row.shipType,
    destination: row.destination,
    lastSeen: row.lastSeen,
    isSanctioned: row.isSanctioned,
    sanctioningAuthority: row.sanctioningAuthority,
    sanctionReason: row.sanctionReason,
    position: row.latitude
      ? {
          time: row.time!,
          mmsi: row.mmsi,
          imo: row.imo,
          latitude: row.latitude,
          longitude: row.longitude!,
          speed: row.speed,
          course: row.course,
          heading: row.heading,
          navStatus: row.navStatus,
          lowConfidence: row.lowConfidence,
        }
      : null,
  }));
}
