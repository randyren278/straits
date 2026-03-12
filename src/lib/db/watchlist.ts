/**
 * Watchlist CRUD Operations
 *
 * Functions for managing user watchlists.
 * Uses session-based user identification (localStorage UUID).
 */
import { pool } from './index';
import type { WatchlistEntry } from '../../types/anomaly';

/**
 * Add a vessel to user's watchlist.
 * Updates notes if vessel already on watchlist.
 *
 * @param userId - User session ID from localStorage
 * @param imo - Vessel IMO number to add
 * @param notes - Optional notes about the vessel
 */
export async function addToWatchlist(userId: string, imo: string, notes?: string): Promise<void> {
  await pool.query(
    `INSERT INTO watchlist (user_id, imo, notes)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, imo) DO UPDATE SET notes = EXCLUDED.notes`,
    [userId, imo, notes || null]
  );
}

/**
 * Remove a vessel from user's watchlist.
 *
 * @param userId - User session ID
 * @param imo - Vessel IMO number to remove
 */
export async function removeFromWatchlist(userId: string, imo: string): Promise<void> {
  await pool.query(
    `DELETE FROM watchlist WHERE user_id = $1 AND imo = $2`,
    [userId, imo]
  );
}

/**
 * Get all vessels on user's watchlist.
 * Ordered by most recently added first.
 *
 * @param userId - User session ID
 * @returns Array of watchlist entries
 */
export async function getUserWatchlist(userId: string): Promise<WatchlistEntry[]> {
  const result = await pool.query<{
    user_id: string;
    imo: string;
    added_at: Date;
    notes: string | null;
  }>(
    `SELECT user_id, imo, added_at, notes
     FROM watchlist
     WHERE user_id = $1
     ORDER BY added_at DESC`,
    [userId]
  );

  return result.rows.map(row => ({
    userId: row.user_id,
    imo: row.imo,
    addedAt: row.added_at,
    notes: row.notes,
  }));
}

/**
 * Check if a vessel is on user's watchlist.
 *
 * @param userId - User session ID
 * @param imo - Vessel IMO number
 * @returns True if vessel is on watchlist
 */
export async function isOnWatchlist(userId: string, imo: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM watchlist WHERE user_id = $1 AND imo = $2
    ) as exists`,
    [userId, imo]
  );
  return result.rows[0]?.exists ?? false;
}

/**
 * Get all user IDs watching a specific vessel.
 * Used to generate alerts when anomaly detected.
 *
 * @param imo - Vessel IMO number
 * @returns Array of user IDs
 */
export async function getWatchersForVessel(imo: string): Promise<string[]> {
  const result = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM watchlist WHERE imo = $1`,
    [imo]
  );
  return result.rows.map(row => row.user_id);
}

/**
 * Extended watchlist entry with vessel info for API responses.
 */
export interface WatchlistWithVessel {
  userId: string;
  imo: string;
  addedAt: Date;
  notes: string | null;
  vesselName: string | null;
  flag: string | null;
  shipType: number | null;
}

/**
 * Get user's watchlist with vessel information.
 * Joins with vessels table for display names.
 *
 * @param userId - User session ID
 * @returns Array of watchlist entries with vessel details
 */
export async function getWatchlistWithVessels(userId: string): Promise<WatchlistWithVessel[]> {
  const result = await pool.query<{
    user_id: string;
    imo: string;
    added_at: Date;
    notes: string | null;
    name: string | null;
    flag: string | null;
    ship_type: number | null;
  }>(
    `SELECT w.user_id, w.imo, w.added_at, w.notes,
            v.name, v.flag, v.ship_type
     FROM watchlist w
     LEFT JOIN vessels v ON v.imo = w.imo
     WHERE w.user_id = $1
     ORDER BY w.added_at DESC`,
    [userId]
  );

  return result.rows.map(row => ({
    userId: row.user_id,
    imo: row.imo,
    addedAt: row.added_at,
    notes: row.notes,
    vesselName: row.name,
    flag: row.flag,
    shipType: row.ship_type,
  }));
}
