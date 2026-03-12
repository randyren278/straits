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
