/**
 * Alert CRUD Operations
 *
 * Functions for managing user alerts/notifications.
 * Alerts are generated when watched vessels trigger anomalies.
 */
import { pool } from './index';
import type { Alert } from '../../types/anomaly';
import { getWatchersForVessel } from './watchlist';

/**
 * Create a new alert for a user.
 *
 * @param userId - User session ID
 * @param imo - Vessel IMO number
 * @param alertType - Type of alert (e.g., 'going_dark', 'loitering')
 * @param details - Additional context about the alert
 */
export async function createAlert(
  userId: string,
  imo: string,
  alertType: string,
  details: object
): Promise<void> {
  await pool.query(
    `INSERT INTO alerts (user_id, imo, alert_type, details)
     VALUES ($1, $2, $3, $4)`,
    [userId, imo, alertType, JSON.stringify(details)]
  );
}

/**
 * Get all unread alerts for a user.
 * Ordered by most recent first.
 *
 * @param userId - User session ID
 * @returns Array of unread alerts
 */
export async function getUnreadAlerts(userId: string): Promise<Alert[]> {
  const result = await pool.query<{
    id: number;
    user_id: string;
    imo: string;
    alert_type: string;
    triggered_at: Date;
    read_at: Date | null;
    details: object;
  }>(
    `SELECT id, user_id, imo, alert_type, triggered_at, read_at, details
     FROM alerts
     WHERE user_id = $1 AND read_at IS NULL
     ORDER BY triggered_at DESC`,
    [userId]
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    imo: row.imo,
    alertType: row.alert_type,
    triggeredAt: row.triggered_at,
    readAt: row.read_at,
    details: row.details,
  }));
}

/**
 * Get all alerts for a user (including read).
 * Ordered by most recent first.
 *
 * @param userId - User session ID
 * @param limit - Maximum number of alerts to return
 * @returns Array of alerts
 */
export async function getAllAlerts(userId: string, limit: number = 50): Promise<Alert[]> {
  const result = await pool.query<{
    id: number;
    user_id: string;
    imo: string;
    alert_type: string;
    triggered_at: Date;
    read_at: Date | null;
    details: object;
  }>(
    `SELECT id, user_id, imo, alert_type, triggered_at, read_at, details
     FROM alerts
     WHERE user_id = $1
     ORDER BY triggered_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    imo: row.imo,
    alertType: row.alert_type,
    triggeredAt: row.triggered_at,
    readAt: row.read_at,
    details: row.details,
  }));
}

/**
 * Mark an alert as read.
 *
 * @param alertId - Alert ID to mark as read
 */
export async function markAlertAsRead(alertId: number): Promise<void> {
  await pool.query(
    `UPDATE alerts SET read_at = NOW() WHERE id = $1`,
    [alertId]
  );
}

/**
 * Generate alerts for all users watching a vessel when anomaly detected.
 * Called by detection jobs after creating anomaly.
 *
 * @param imo - Vessel IMO number
 * @param anomalyType - Type of anomaly detected
 * @param details - Anomaly details to include in alert
 */
export async function generateAlertsForAnomaly(
  imo: string,
  anomalyType: string,
  details: object
): Promise<void> {
  const watchers = await getWatchersForVessel(imo);

  if (watchers.length === 0) {
    return;
  }

  // Batch insert alerts for all watchers
  const values = watchers.map((userId, i) => {
    const offset = i * 4;
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
  }).join(', ');

  const params = watchers.flatMap(userId => [userId, imo, anomalyType, JSON.stringify(details)]);

  await pool.query(
    `INSERT INTO alerts (user_id, imo, alert_type, details) VALUES ${values}`,
    params
  );
}

/**
 * Extended alert with vessel info for API responses.
 */
export interface AlertWithVessel {
  id: number;
  imo: string;
  alertType: string;
  triggeredAt: Date;
  readAt: Date | null;
  details: object;
  vesselName: string | null;
  flag: string | null;
}

/**
 * Get user's alerts with vessel information.
 * Joins with vessels table for display names.
 *
 * @param userId - User session ID
 * @param limit - Maximum number of alerts to return
 * @returns Array of alerts with vessel details
 */
export async function getAlertsWithVessels(userId: string, limit: number = 50): Promise<AlertWithVessel[]> {
  const result = await pool.query<{
    id: number;
    imo: string;
    alert_type: string;
    triggered_at: Date;
    read_at: Date | null;
    details: object;
    name: string | null;
    flag: string | null;
  }>(
    `SELECT a.id, a.imo, a.alert_type, a.triggered_at, a.read_at, a.details,
            v.name, v.flag
     FROM alerts a
     LEFT JOIN vessels v ON v.imo = a.imo
     WHERE a.user_id = $1
     ORDER BY a.triggered_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    imo: row.imo,
    alertType: row.alert_type,
    triggeredAt: row.triggered_at,
    readAt: row.read_at,
    details: row.details,
    vesselName: row.name,
    flag: row.flag,
  }));
}

/**
 * Generate alerts for all new anomalies of a specific type.
 * Called by cron jobs after detection runs.
 *
 * Finds anomalies detected in the last detection window (35 min to cover both
 * 15-min and 30-min schedules) that have watched vessels, and creates alerts
 * for watchers who haven't been alerted recently (1-hour dedup window).
 *
 * @param anomalyType - Type of anomaly to generate alerts for
 */
export async function generateAlertsForNewAnomalies(anomalyType: string): Promise<void> {
  // Find new anomalies for watched vessels and create alerts
  // Deduplication: don't alert same user for same vessel+type within 1 hour
  await pool.query(`
    INSERT INTO alerts (user_id, imo, alert_type, details)
    SELECT w.user_id, a.imo, a.anomaly_type, a.details
    FROM vessel_anomalies a
    JOIN watchlist w ON w.imo = a.imo
    WHERE a.anomaly_type = $1
      AND a.detected_at > NOW() - INTERVAL '35 minutes'
      AND a.resolved_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM alerts al
        WHERE al.user_id = w.user_id
          AND al.imo = a.imo
          AND al.alert_type = a.anomaly_type
          AND al.triggered_at > NOW() - INTERVAL '1 hour'
      )
  `, [anomalyType]);
}
