/** Track engine persistence: engine input, per-vessel state, learning state, lane density. */
import { pool } from './index';
import { readerPool } from './reader';
import type { EngineVessel } from '../tracks/engine';
import { normalizeLearnState, type LearnState } from '../tracks/learn';
import type { ReplayVessel, TrackPayload, TracksResponse } from '../tracks/types';

const HALF_LIFE_DAYS = 14;

export async function loadEngineVessels(): Promise<EngineVessel[]> {
  // Mirrored tables only, last 24h — see readerPool().
  const { rows } = await readerPool().query<{
    mmsi: string; t: string | Date; latitude: number; longitude: number;
    name: string | null; ship_type: number | null; flag: string | null; imo: string | null; destination: string | null;
  }>(`
    WITH recent AS (SELECT DISTINCT mmsi FROM vessel_positions WHERE time > NOW() - INTERVAL '24 hours')
    SELECT p.mmsi, p.time AS t, p.latitude, p.longitude,
           COALESCE(v.name, f.name) AS name, COALESCE(v.ship_type, f.ship_type) AS ship_type,
           v.flag, v.imo, v.destination
    FROM vessel_positions p
    JOIN recent USING (mmsi)
    LEFT JOIN LATERAL (SELECT name, ship_type, flag, imo, destination FROM vessels WHERE mmsi = p.mmsi ORDER BY last_seen DESC NULLS LAST LIMIT 1) v ON true
    LEFT JOIN vessel_fallback_metadata f ON f.mmsi = p.mmsi
    WHERE p.time > NOW() - INTERVAL '24 hours'
    ORDER BY p.mmsi, p.time`);
  const byMmsi = new Map<string, EngineVessel>();
  for (const r of rows) {
    let v = byMmsi.get(r.mmsi);
    if (!v) {
      v = { mmsi: r.mmsi, fixes: [], identity: { name: !!r.name, type: r.ship_type != null, flag: !!r.flag, imoOrDest: !!(r.imo || r.destination) } };
      byMmsi.set(r.mmsi, v);
    }
    v.fixes.push({ t: new Date(r.t).getTime() / 60000, lat: r.latitude, lon: r.longitude });
  }
  return [...byMmsi.values()];
}

export async function loadLaneDensity(now: Date, size: number): Promise<Float32Array> {
  const { rows } = await pool.query<{ cell: number; w: number; updated_at: string | Date }>('SELECT cell, w, updated_at FROM lane_density');
  return laneDensityFromRows(rows, now, size);
}

/** Stored lane weights decayed to `now` (shared by the Supabase and mirrored reads). */
export function laneDensityFromRows(
  rows: ReadonlyArray<{ cell: number; w: number; updated_at: string | Date }>, now: Date, size: number,
): Float32Array {
  const out = new Float32Array(size);
  for (const r of rows) {
    const days = (now.getTime() - new Date(r.updated_at).getTime()) / 86_400_000;
    if (r.cell >= 0 && r.cell < size) out[r.cell] = r.w * Math.pow(0.5, days / HALF_LIFE_DAYS);
  }
  return out;
}

export async function saveLaneDensity(delta: Map<number, number>): Promise<void> {
  if (!delta.size) return;
  const cells = [...delta.keys()], ws = cells.map((c) => delta.get(c)!);
  // Decay the stored weight to now before adding, so a busy lane from last month fades.
  await pool.query(`
    INSERT INTO lane_density (cell, w, updated_at)
    SELECT c, d, NOW() FROM unnest($1::int[], $2::real[]) AS u(c, d)
    ON CONFLICT (cell) DO UPDATE SET
      w = lane_density.w * power(0.5, extract(epoch FROM NOW() - lane_density.updated_at) / 86400.0 / ${HALF_LIFE_DAYS}) + EXCLUDED.w,
      updated_at = NOW()`, [cells, ws]);
}

export async function loadLearnState(): Promise<LearnState> {
  const { rows } = await pool.query<{ value: unknown }>(`SELECT value FROM track_engine_state WHERE key = 'learn'`);
  return normalizeLearnState(rows[0]?.value ?? null);
}

export async function saveEngineRun(
  payloads: TrackPayload[], learn: LearnState,
  meta: { backtest: TracksResponse['backtest']; learned: TracksResponse['learned'] },
  replay?: ReplayVessel[],
): Promise<void> {
  await pool.query(`
    INSERT INTO vessel_track_state (mmsi, payload, updated_at)
    SELECT r->>'mmsi', r, NOW() FROM jsonb_array_elements($1::jsonb) AS r
    ON CONFLICT (mmsi) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`, [JSON.stringify(payloads)]);
  await pool.query(`DELETE FROM vessel_track_state WHERE updated_at < NOW() - INTERVAL '7 hours'`);
  await pool.query(`
    INSERT INTO track_engine_state (key, value, updated_at) VALUES ('learn', $1::jsonb, NOW()), ('summary', $2::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
  [JSON.stringify(learn), JSON.stringify({ ...meta, generatedAt: new Date().toISOString() })]);
  if (replay) {
    await pool.query(`
      INSERT INTO track_engine_state (key, value, updated_at) VALUES ('replay', $1::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify({ generatedAt: new Date().toISOString(), vessels: replay })]);
  }
}

export { getTracks, getReplay } from './tracks-read';
