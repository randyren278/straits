/**
 * Read side of the track engine, for /api/tracks. Deliberately imports no engine code:
 * the land raster must never load on a serverless cold start.
 */
import { pool } from './index';
import type { ReplayResponse, ReplayVessel, TrackPayload, TracksResponse } from '../tracks/types';

export async function getTracks(): Promise<TracksResponse> {
  const states = await pool.query<{ payload: TrackPayload }>(
    `SELECT payload FROM vessel_track_state WHERE updated_at > NOW() - INTERVAL '7 hours'`);
  const summary = await pool.query<{ value: { backtest: TracksResponse['backtest']; learned: TracksResponse['learned']; generatedAt: string } }>(
    `SELECT value FROM track_engine_state WHERE key = 'summary'`);
  const s = summary.rows[0]?.value;
  return { generatedAt: s?.generatedAt ?? new Date().toISOString(), vessels: states.rows.map((r) => r.payload), backtest: s?.backtest ?? null, learned: s?.learned ?? null };
}

/** The harvester's last 24 h replay; `from`/`to` bound the series in minutes since epoch. */
export async function getReplay(): Promise<ReplayResponse | null> {
  const { rows } = await pool.query<{ value: { generatedAt: string; vessels: ReplayVessel[] } }>(
    `SELECT value FROM track_engine_state WHERE key = 'replay'`);
  const v = rows[0]?.value;
  if (!v) return null;
  const to = Date.parse(v.generatedAt) / 60000;
  return { generatedAt: v.generatedAt, from: to - 1440, to, vessels: v.vessels };
}
