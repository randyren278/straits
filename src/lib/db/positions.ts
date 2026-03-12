/**
 * Position CRUD operations for vessel tracking.
 * Uses TimescaleDB hypertable for efficient time-series queries.
 */
import { pool } from './index';
import type { VesselPosition } from '../../types/vessel';

/**
 * Insert a position report into the vessel_positions hypertable.
 * Uses parameterized query to prevent SQL injection.
 *
 * @param position - Position data from AIS message
 */
export async function insertPosition(position: VesselPosition): Promise<void> {
  await pool.query(
    `INSERT INTO vessel_positions
     (time, mmsi, imo, latitude, longitude, speed, course, heading, nav_status, low_confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      position.time,
      position.mmsi,
      position.imo,
      position.latitude,
      position.longitude,
      position.speed,
      position.course,
      position.heading,
      position.navStatus,
      position.lowConfidence,
    ]
  );
}

/**
 * Get position history for a vessel within a time range.
 * Orders by time DESC (most recent first).
 *
 * @param mmsi - MMSI of the vessel
 * @param hours - Number of hours of history to retrieve (default: 24)
 * @returns Array of positions, newest first
 */
export async function getPositionHistory(
  mmsi: string,
  hours: number = 24
): Promise<VesselPosition[]> {
  const result = await pool.query<VesselPosition>(
    `SELECT time, mmsi, imo, latitude, longitude, speed, course, heading,
            nav_status as "navStatus", low_confidence as "lowConfidence"
     FROM vessel_positions
     WHERE mmsi = $1 AND time > NOW() - $2::interval
     ORDER BY time DESC`,
    [mmsi, `${hours} hours`]
  );
  return result.rows;
}

/**
 * Get the most recent position for each vessel.
 * Uses DISTINCT ON to efficiently get latest position per vessel.
 * Only considers positions from the last hour to avoid stale data.
 *
 * @returns Array of latest positions, one per vessel
 */
export async function getLatestPositions(): Promise<VesselPosition[]> {
  const result = await pool.query<VesselPosition>(
    `SELECT DISTINCT ON (mmsi)
       time, mmsi, imo, latitude, longitude, speed, course, heading,
       nav_status as "navStatus", low_confidence as "lowConfidence"
     FROM vessel_positions
     WHERE time > NOW() - INTERVAL '1 hour'
     ORDER BY mmsi, time DESC`
  );
  return result.rows;
}
