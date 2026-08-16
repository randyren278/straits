/**
 * Anomaly CRUD Operations
 *
 * Functions for managing vessel anomalies in the database.
 * Used by detection jobs and API routes.
 */
import { pool } from './index';
import type { Anomaly, AnomalyType, Confidence, UpsertAnomalyInput } from '../../types/anomaly';

/**
 * Insert or update an anomaly record.
 * If anomaly exists for same (imo, anomaly_type) with resolved_at NULL,
 * updates the existing record. Otherwise inserts new.
 *
 * @param anomaly - Anomaly data to upsert
 */
export async function upsertAnomaly(anomaly: UpsertAnomalyInput): Promise<void> {
  await pool.query(
    `INSERT INTO vessel_anomalies (imo, anomaly_type, confidence, detected_at, details)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (imo, anomaly_type) WHERE resolved_at IS NULL
     DO UPDATE SET
       confidence = EXCLUDED.confidence,
       detected_at = EXCLUDED.detected_at,
       details = EXCLUDED.details`,
    [anomaly.imo, anomaly.anomalyType, anomaly.confidence, anomaly.detectedAt, JSON.stringify(anomaly.details)]
  );
}

/** Round-trips per flush; mirrors the 500-row chunking in harvest-once.ts. */
const UPSERT_CHUNK_SIZE = 500;

/**
 * Batch insert or update anomaly records — same semantics as upsertAnomaly,
 * issued as chunked multi-row upserts instead of one round-trip per row.
 *
 * A detector can produce two rows for the same (imo, anomalyType) within one
 * run (e.g. an STS candidate close to two other vessels at once). Postgres
 * rejects an INSERT ... ON CONFLICT DO UPDATE that would touch the same
 * conflict target twice in one statement, so duplicates are collapsed to the
 * last occurrence first — matching the old per-row loop, where the later
 * upsertAnomaly call would win anyway since only one row can be active
 * (resolved_at IS NULL) for a given (imo, anomalyType) at a time.
 *
 * @param anomalies - Anomaly rows to upsert
 */
export async function upsertAnomaliesBatch(anomalies: UpsertAnomalyInput[]): Promise<void> {
  if (anomalies.length === 0) return;

  const deduped = new Map<string, UpsertAnomalyInput>();
  for (const a of anomalies) deduped.set(`${a.imo}:${a.anomalyType}`, a);
  const rows = [...deduped.values()];

  const cols = 5;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const values = chunk.map((_, j) => {
      const b = j * cols;
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`;
    }).join(', ');
    const params = chunk.flatMap((a) => [
      a.imo, a.anomalyType, a.confidence, a.detectedAt, JSON.stringify(a.details),
    ]);
    await pool.query(
      `INSERT INTO vessel_anomalies (imo, anomaly_type, confidence, detected_at, details)
       VALUES ${values}
       ON CONFLICT (imo, anomaly_type) WHERE resolved_at IS NULL
       DO UPDATE SET
         confidence = EXCLUDED.confidence,
         detected_at = EXCLUDED.detected_at,
         details = EXCLUDED.details`,
      params
    );
  }
}

/**
 * Get all active (unresolved) anomalies.
 * Optionally filter by IMO number.
 *
 * @param imo - Optional IMO to filter by
 * @returns Array of active anomalies
 */
export async function getActiveAnomalies(imo?: string): Promise<Anomaly[]> {
  const result = await pool.query<{
    id: number;
    imo: string;
    anomaly_type: AnomalyType;
    confidence: Confidence;
    detected_at: Date;
    resolved_at: Date | null;
    details: object;
  }>(
    imo
      ? `SELECT id, imo, anomaly_type, confidence, detected_at, resolved_at, details
         FROM vessel_anomalies
         WHERE resolved_at IS NULL AND imo = $1
         ORDER BY detected_at DESC`
      : `SELECT id, imo, anomaly_type, confidence, detected_at, resolved_at, details
         FROM vessel_anomalies
         WHERE resolved_at IS NULL
         ORDER BY detected_at DESC`,
    imo ? [imo] : []
  );

  return result.rows.map(row => ({
    id: row.id,
    imo: row.imo,
    anomalyType: row.anomaly_type,
    confidence: row.confidence,
    detectedAt: row.detected_at,
    resolvedAt: row.resolved_at,
    details: row.details as Anomaly['details'],
  }));
}

/**
 * Mark an anomaly as resolved.
 * Sets resolved_at timestamp to NOW().
 *
 * @param imo - Vessel IMO number
 * @param anomalyType - Type of anomaly to resolve
 */
export async function resolveAnomaly(imo: string, anomalyType: string): Promise<void> {
  await pool.query(
    `UPDATE vessel_anomalies
     SET resolved_at = NOW()
     WHERE imo = $1 AND anomaly_type = $2 AND resolved_at IS NULL`,
    [imo, anomalyType]
  );
}

/**
 * Batch-resolve anomalies — same semantics as resolveAnomaly, issued as a
 * single round-trip via unnest() instead of one UPDATE per (imo, anomalyType)
 * pair. Array params keep this to one query regardless of row count, so
 * unlike the row-based upserts above it doesn't need chunking.
 *
 * @param targets - (imo, anomalyType) pairs to resolve
 */
export async function resolveAnomaliesBatch(
  targets: Array<{ imo: string; anomalyType: string }>
): Promise<void> {
  if (targets.length === 0) return;

  const imos = targets.map((t) => t.imo);
  const types = targets.map((t) => t.anomalyType);
  await pool.query(
    `UPDATE vessel_anomalies va
     SET resolved_at = NOW()
     FROM unnest($1::text[], $2::text[]) AS t(imo, anomaly_type)
     WHERE va.imo = t.imo AND va.anomaly_type = t.anomaly_type AND va.resolved_at IS NULL`,
    [imos, types]
  );
}

/**
 * Get anomalies for multiple vessels at once.
 * Used for batch loading when displaying vessel list.
 *
 * @param imos - Array of IMO numbers
 * @returns Array of anomalies for the specified vessels
 */
export async function getAnomaliesForVessels(imos: string[]): Promise<Anomaly[]> {
  if (imos.length === 0) {
    return [];
  }

  const placeholders = imos.map((_, i) => `$${i + 1}`).join(', ');
  const result = await pool.query<{
    id: number;
    imo: string;
    anomaly_type: AnomalyType;
    confidence: Confidence;
    detected_at: Date;
    resolved_at: Date | null;
    details: object;
  }>(
    `SELECT id, imo, anomaly_type, confidence, detected_at, resolved_at, details
     FROM vessel_anomalies
     WHERE imo IN (${placeholders}) AND resolved_at IS NULL
     ORDER BY detected_at DESC`,
    imos
  );

  return result.rows.map(row => ({
    id: row.id,
    imo: row.imo,
    anomalyType: row.anomaly_type,
    confidence: row.confidence,
    detectedAt: row.detected_at,
    resolvedAt: row.resolved_at,
    details: row.details as Anomaly['details'],
  }));
}
