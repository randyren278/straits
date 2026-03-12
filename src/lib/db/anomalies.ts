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
