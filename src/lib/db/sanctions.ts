/**
 * Sanctions CRUD operations for vessel_sanctions table.
 * INTL-01: Sanctions matching.
 */
import { pool } from './index';
import type { SanctionEntry } from '../external/opensanctions';

export interface SanctionRecord {
  imo: string;
  sanctioningAuthority: string;
  listDate: Date | null;
  reason: string | null;
  confidence: string;
}

/**
 * VesselWithSanctions is defined independently (not extending VesselWithPosition)
 * because vessels sourced from vessel_positions may not have a matching row in vessels,
 * making imo/name/flag/shipType nullable.
 */
export interface VesselWithSanctions {
  imo: string | null;
  mmsi: string;
  name: string | null;
  flag: string | null;
  shipType: number | null;
  destination: string | null;
  lastSeen: Date | null;
  isSanctioned: boolean;
  sanctioningAuthority: string | null;
  sanctionReason: string | null;
  // Anomaly fields (from LEFT JOIN vessel_anomalies)
  anomalyType?: string | null;
  anomalyConfidence?: string | null;
  anomalyDetectedAt?: Date | null;
  // Position is always non-null — every row came from vessel_positions
  position: {
    time: Date;
    mmsi: string;
    imo: string | null;
    latitude: number;
    longitude: number;
    speed: number | null;
    course: number | null;
    heading: number | null;
    navStatus: number | null;
    lowConfidence: boolean;
  };
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
  imo: string | null;
  mmsi: string;
  name: string | null;
  flag: string | null;
  shipType: number | null;
  destination: string | null;
  lastSeen: Date | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  course: number | null;
  heading: number | null;
  navStatus: number | null;
  lowConfidence: boolean;
  time: Date;
  isSanctioned: boolean;
  sanctioningAuthority: string | null;
  sanctionReason: string | null;
  // Anomaly fields
  anomalyType: string | null;
  anomalyConfidence: string | null;
  anomalyDetectedAt: Date | null;
}

/**
 * Get vessels with sanctions data, sourced from vessel_positions first.
 * Every ship with a recent position appears; vessel metadata is enriched where available.
 * Ships without a matching row in vessels (no IMO) appear with nullable metadata fields.
 */
export async function getVesselsWithSanctions(
  tankersOnly: boolean = false
): Promise<VesselWithSanctions[]> {
  const result = await pool.query<VesselSanctionsRow>(
    `
    SELECT
      p.mmsi,
      p.latitude, p.longitude, p.speed, p.course, p.heading,
      p.nav_status    AS "navStatus",
      p.low_confidence AS "lowConfidence",
      p.time,
      v.imo, v.name, v.flag,
      v.ship_type     AS "shipType",
      v.destination,
      v.last_seen     AS "lastSeen",
      CASE WHEN s.imo IS NOT NULL THEN true ELSE false END AS "isSanctioned",
      s.sanctioning_authority AS "sanctioningAuthority",
      s.reason        AS "sanctionReason",
      a.anomaly_type  AS "anomalyType",
      a.confidence    AS "anomalyConfidence",
      a.detected_at   AS "anomalyDetectedAt"
    FROM (
      SELECT DISTINCT ON (mmsi)
        mmsi, latitude, longitude, speed, course, heading,
        nav_status, low_confidence, time
      FROM vessel_positions
      WHERE time > NOW() - INTERVAL '24 hours'
      ORDER BY mmsi, time DESC
    ) p
    LEFT JOIN vessels v ON v.mmsi = p.mmsi
    LEFT JOIN vessel_sanctions s ON v.imo = s.imo
    LEFT JOIN vessel_anomalies a ON v.imo = a.imo AND a.resolved_at IS NULL
    ${tankersOnly
      ? 'WHERE v.ship_type IS NOT NULL AND v.ship_type BETWEEN 80 AND 89'
      : ''}
    ORDER BY p.time DESC
    `
  );

  // Transform rows to VesselWithSanctions with nested position
  // Every row has a valid position (sourced from vessel_positions CTE)
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
    anomalyType: row.anomalyType,
    anomalyConfidence: row.anomalyConfidence,
    anomalyDetectedAt: row.anomalyDetectedAt,
    position: {
      time: row.time,
      mmsi: row.mmsi,
      imo: row.imo,
      latitude: row.latitude,
      longitude: row.longitude,
      speed: row.speed,
      course: row.course,
      heading: row.heading,
      navStatus: row.navStatus,
      lowConfidence: row.lowConfidence,
    },
  }));
}
