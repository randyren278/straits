/**
 * Read side of the track engine, for /api/tracks. Deliberately imports no engine code:
 * the land raster must never load on a serverless cold start.
 */
import { pool } from './index';
import type { TrackPayload, TracksResponse } from '../tracks/types';

export async function getTracks(): Promise<TracksResponse> {
  const states = await pool.query<{ payload: TrackPayload }>(
    `SELECT payload FROM vessel_track_state WHERE updated_at > NOW() - INTERVAL '7 hours'`);
  const summary = await pool.query<{ value: { backtest: TracksResponse['backtest']; learned: TracksResponse['learned']; generatedAt: string } }>(
    `SELECT value FROM track_engine_state WHERE key = 'summary'`);
  const s = summary.rows[0]?.value;
  return { generatedAt: s?.generatedAt ?? new Date().toISOString(), vessels: states.rows.map((r) => r.payload), backtest: s?.backtest ?? null, learned: s?.learned ?? null };
}
