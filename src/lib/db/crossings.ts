/**
 * Suez crossing persistence: load tracks from raw positions, store daily
 * aggregates that outlive the raw-position prune. Server-only.
 */
import { pool } from './index';
import { CHOKEPOINTS } from '../geo/chokepoints-constants';
import type { TrackPoint, DailyCrossingCounts } from '../analytics/crossings';

/** Runtime-safe twin of scripts/migrations/20260915_chokepoint_daily.sql. */
export const CHOKEPOINT_DAILY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS chokepoint_daily (
    chokepoint TEXT NOT NULL,
    day DATE NOT NULL,
    northbound INTEGER NOT NULL DEFAULT 0,
    southbound INTEGER NOT NULL DEFAULT 0,
    waiting INTEGER NOT NULL DEFAULT 0,
    incomplete INTEGER NOT NULL DEFAULT 0,
    distinct_mmsi INTEGER NOT NULL DEFAULT 0,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chokepoint, day)
  );
  ALTER TABLE chokepoint_daily ENABLE ROW LEVEL SECURITY;
`;

export async function ensureChokepointDailySchema(): Promise<void> {
  await pool.query(CHOKEPOINT_DAILY_SCHEMA_SQL);
}

/** Positions inside the Suez chokepoint box, ordered per MMSI, for the last `days`. */
export async function loadSuezTracks(days: number): Promise<Map<string, TrackPoint[]>> {
  const b = CHOKEPOINTS.suez.bounds;
  const result = await pool.query<{ mmsi: string; time: Date; latitude: number; longitude: number }>(
    `SELECT mmsi, time, latitude, longitude
     FROM vessel_positions
     WHERE time > NOW() - ($1 || ' days')::interval
       AND latitude BETWEEN $2 AND $3 AND longitude BETWEEN $4 AND $5
     ORDER BY mmsi, time`,
    [String(days), b.minLat, b.maxLat, b.minLon, b.maxLon],
  );
  const tracks = new Map<string, TrackPoint[]>();
  for (const r of result.rows) {
    let t = tracks.get(r.mmsi);
    if (!t) { t = []; tracks.set(r.mmsi, t); }
    t.push({ time: r.time, latitude: r.latitude, longitude: r.longitude });
  }
  return tracks;
}

export async function upsertChokepointDaily(chokepoint: string, rows: readonly DailyCrossingCounts[]): Promise<number> {
  if (rows.length === 0) return 0;
  const COLS = 7;
  const values = rows.map((_, j) => {
    const b = j * COLS;
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},NOW())`;
  }).join(', ');
  const params = rows.flatMap((r) => [chokepoint, r.day, r.northbound, r.southbound, r.waiting, r.incomplete, r.distinctMmsi]);
  await pool.query(
    `INSERT INTO chokepoint_daily
       (chokepoint, day, northbound, southbound, waiting, incomplete, distinct_mmsi, computed_at)
     VALUES ${values}
     ON CONFLICT (chokepoint, day) DO UPDATE SET
       northbound = EXCLUDED.northbound, southbound = EXCLUDED.southbound,
       waiting = EXCLUDED.waiting, incomplete = EXCLUDED.incomplete,
       distinct_mmsi = EXCLUDED.distinct_mmsi, computed_at = EXCLUDED.computed_at`,
    params,
  );
  return rows.length;
}

export interface ChokepointDailyRow extends DailyCrossingCounts { computedAt: string }

export async function getChokepointDaily(chokepoint: string, days: number): Promise<ChokepointDailyRow[]> {
  const result = await pool.query<{
    day: string; northbound: number; southbound: number; waiting: number; incomplete: number; distinct_mmsi: number; computed_at: Date;
  }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, northbound, southbound, waiting, incomplete, distinct_mmsi, computed_at
     FROM chokepoint_daily
     WHERE chokepoint = $1 AND day > (CURRENT_DATE - ($2 || ' days')::interval)
     ORDER BY day`,
    [chokepoint, String(days)],
  );
  return result.rows.map((r) => ({
    day: r.day, northbound: r.northbound, southbound: r.southbound, waiting: r.waiting,
    incomplete: r.incomplete, distinctMmsi: r.distinct_mmsi, computedAt: r.computed_at.toISOString(),
  }));
}
