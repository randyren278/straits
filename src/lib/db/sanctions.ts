/**
 * Sanctions CRUD operations for vessel_sanctions table.
 *
 * M005-S01: Enriched schema with risk_category, datasets[], flag, mmsi, aliases[],
 * opensanctions_url, vessel_type. Batch upsert with stale entry cleanup.
 */
import { pool } from './index';
import type { SanctionEntry } from '../external/opensanctions';

export interface SanctionRecord {
  imo: string;
  sanctioningAuthority: string;
  listDate: Date | null;
  reason: string | null;
  confidence: string;
  riskCategory: string | null;
  datasets: string[] | null;
  flag: string | null;
  mmsi: string | null;
  aliases: string[] | null;
  opensanctionsUrl: string | null;
  vesselType: string | null;
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
  sanctionRiskCategory: string | null;
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
 * SQL migration to add enriched columns to vessel_sanctions.
 * Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 */
export const SANCTIONS_MIGRATION_SQL = `
  ALTER TABLE vessel_sanctions ADD COLUMN IF NOT EXISTS risk_category VARCHAR(50);
  ALTER TABLE vessel_sanctions ADD COLUMN IF NOT EXISTS datasets TEXT[];
  ALTER TABLE vessel_sanctions ADD COLUMN IF NOT EXISTS flag TEXT;
  ALTER TABLE vessel_sanctions ADD COLUMN IF NOT EXISTS mmsi TEXT;
  ALTER TABLE vessel_sanctions ALTER COLUMN mmsi TYPE TEXT;
  ALTER TABLE vessel_sanctions ALTER COLUMN flag TYPE TEXT;
  ALTER TABLE vessel_sanctions ADD COLUMN IF NOT EXISTS aliases TEXT[];
  ALTER TABLE vessel_sanctions ADD COLUMN IF NOT EXISTS opensanctions_url TEXT;
  ALTER TABLE vessel_sanctions ADD COLUMN IF NOT EXISTS vessel_type VARCHAR(20);
  ALTER TABLE vessel_sanctions ADD COLUMN IF NOT EXISTS name TEXT;
`;

/**
 * Run the schema migration to add enriched columns.
 * Idempotent — safe to call on every startup.
 */
export async function migrateSanctionsSchema(): Promise<void> {
  await pool.query(SANCTIONS_MIGRATION_SQL);
}

/**
 * Insert or update a single sanction entry.
 * Uses ON CONFLICT to handle upsert logic.
 */
export async function upsertSanction(entry: SanctionEntry): Promise<void> {
  await pool.query(
    `
    INSERT INTO vessel_sanctions (
      imo, sanctioning_authority, list_date, reason, source_url,
      risk_category, datasets, flag, mmsi, aliases, opensanctions_url, vessel_type, name,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
    ON CONFLICT (imo) DO UPDATE SET
      sanctioning_authority = EXCLUDED.sanctioning_authority,
      list_date = EXCLUDED.list_date,
      reason = EXCLUDED.reason,
      source_url = EXCLUDED.source_url,
      risk_category = EXCLUDED.risk_category,
      datasets = EXCLUDED.datasets,
      flag = EXCLUDED.flag,
      mmsi = EXCLUDED.mmsi,
      aliases = EXCLUDED.aliases,
      opensanctions_url = EXCLUDED.opensanctions_url,
      vessel_type = EXCLUDED.vessel_type,
      name = EXCLUDED.name,
      updated_at = NOW()
    `,
    [
      entry.imo,
      entry.authority,
      entry.listDate,
      entry.reason,
      entry.sourceUrl,
      entry.riskCategory || null,
      entry.datasets.length > 0 ? entry.datasets : null,
      entry.flag || null,
      entry.mmsi || null,
      entry.aliases.length > 0 ? entry.aliases : null,
      entry.opensanctionsUrl || null,
      entry.vesselType || null,
      entry.name || null,
    ]
  );
}

/**
 * Batch upsert sanctions entries with stale cleanup.
 *
 * Strategy:
 * 1. Upsert all entries within a single transaction (individual INSERTs)
 * 2. Delete entries not present in the current fetch (stale cleanup)
 *
 * Using individual upserts in a transaction rather than unnest because
 * PostgreSQL unnest can't handle arrays of arrays (text[][]) from node-pg.
 * ~16,900 individual INSERTs in a transaction completes in <10 seconds.
 *
 * @param entries - Full list of sanction entries from the latest CSV fetch
 * @returns Object with counts of upserted and deleted entries
 */
export async function batchUpsertSanctions(
  entries: SanctionEntry[]
): Promise<{ upserted: number; deleted: number }> {
  if (entries.length === 0) return { upserted: 0, deleted: 0 };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const entry of entries) {
      await client.query(
        `
        INSERT INTO vessel_sanctions (
          imo, sanctioning_authority, reason, source_url,
          risk_category, datasets, flag, mmsi, aliases, opensanctions_url, vessel_type, name,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (imo) DO UPDATE SET
          sanctioning_authority = EXCLUDED.sanctioning_authority,
          reason = EXCLUDED.reason,
          source_url = EXCLUDED.source_url,
          risk_category = EXCLUDED.risk_category,
          datasets = EXCLUDED.datasets,
          flag = EXCLUDED.flag,
          mmsi = EXCLUDED.mmsi,
          aliases = EXCLUDED.aliases,
          opensanctions_url = EXCLUDED.opensanctions_url,
          vessel_type = EXCLUDED.vessel_type,
          name = EXCLUDED.name,
          updated_at = NOW()
        `,
        [
          entry.imo,
          entry.authority,
          entry.reason,
          entry.sourceUrl,
          entry.riskCategory || null,
          entry.datasets.length > 0 ? entry.datasets : null,
          entry.flag || null,
          entry.mmsi || null,
          entry.aliases.length > 0 ? entry.aliases : null,
          entry.opensanctionsUrl || null,
          entry.vesselType || null,
          entry.name || null,
        ]
      );
    }

    // Delete stale entries — vessels no longer in the latest fetch
    const allImos = entries.map((e) => e.imo);
    const deleteResult = await client.query(
      `DELETE FROM vessel_sanctions WHERE imo != ALL($1::text[])`,
      [allImos]
    );
    const deleted = deleteResult.rowCount ?? 0;

    await client.query('COMMIT');
    return { upserted: entries.length, deleted };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get sanction record by IMO number.
 */
export async function getSanction(imo: string): Promise<SanctionRecord | null> {
  const result = await pool.query(
    `
    SELECT imo,
           sanctioning_authority AS "sanctioningAuthority",
           list_date AS "listDate",
           reason,
           confidence,
           risk_category AS "riskCategory",
           datasets,
           flag,
           mmsi,
           aliases,
           opensanctions_url AS "opensanctionsUrl",
           vessel_type AS "vesselType"
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
  sanctionRiskCategory: string | null;
  // Anomaly fields
  anomalyType: string | null;
  anomalyConfidence: string | null;
  anomalyDetectedAt: Date | null;
}

/**
 * Get vessels with sanctions data, sourced from vessel_positions first.
 * Every ship with a recent position appears; vessel metadata is enriched where available.
 * Ships without a matching row in vessels (no IMO) appear with nullable metadata fields.
 * tankersOnly mode includes unclassified vessels (NULL ship_type).
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
      s.risk_category AS "sanctionRiskCategory",
      a.anomaly_type  AS "anomalyType",
      a.confidence    AS "anomalyConfidence",
      a.detected_at   AS "anomalyDetectedAt"
    FROM (
      SELECT DISTINCT ON (mmsi)
        mmsi, latitude, longitude, speed, course, heading,
        nav_status, low_confidence, time
      FROM vessel_positions
      WHERE time > NOW() - INTERVAL '72 hours'
      ORDER BY mmsi, time DESC
    ) p
    LEFT JOIN vessels v ON v.mmsi = p.mmsi
    LEFT JOIN vessel_sanctions s ON v.imo = s.imo
    LEFT JOIN LATERAL (
      SELECT anomaly_type, confidence, detected_at
      FROM vessel_anomalies
      WHERE imo = v.imo AND resolved_at IS NULL
      ORDER BY detected_at DESC
      LIMIT 1
    ) a ON true
    ${tankersOnly
      ? 'WHERE (v.ship_type IS NULL OR v.ship_type BETWEEN 80 AND 89)'
      : ''}
    ORDER BY p.time DESC
    `
  );

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
    sanctionRiskCategory: row.sanctionRiskCategory,
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
