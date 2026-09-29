/**
 * Ship-to-Ship Transfer Detection
 *
 * Detects vessel pairs in close proximity at sea, suggesting cargo transfer.
 * Close proximity = within 0.5 nautical miles (0.926 km) sustained for 30+ minutes.
 * Uses vessel_proximity_events table to track when pairs were first observed close.
 *
 * Requirements: PATT-03
 */
import { pool } from '../db';
import { upsertAnomaliesBatch } from '../db/anomalies';
import type { StsTransferDetails, UpsertAnomalyInput } from '../../types/anomaly';

/** Round-trips per flush; mirrors the 500-row chunking in harvest-once.ts. */
const UPSERT_CHUNK_SIZE = 500;

/**
 * Distance threshold for STS transfer detection in kilometers.
 * 0.5 nautical miles = 0.926 km
 */
const STS_DISTANCE_KM = 0.926;

/**
 * How recently both vessels must have reported positions (minutes)
 */
const POSITION_FRESHNESS_MINUTES = 30;

/**
 * Minimum sustained co-location duration before firing an STS anomaly (minutes).
 * Enforces PATT-03: pairs must be observed within 0.5nm across multiple cron runs.
 */
const SUSTAINED_PROXIMITY_MINUTES = 30;

/**
 * Row returned from the STS proximity query
 */
interface StsRow {
  imo_a: string;
  name_a: string;
  lat_a: number;
  lon_a: number;
  imo_b: string;
  name_b: string;
  lat_b: number;
  lon_b: number;
  distance_km: number;
}

/**
 * Detect vessel pairs in STS transfer proximity.
 *
 * Process:
 * 1. SQL haversine query finds all vessel pairs within 0.5nm with recent positions
 * 2. Upsert vessel_proximity_events for each close pair (tracks first_seen_at + min distance)
 * 3. Archive sustained-but-stale encounters into vessel_rendezvous before cleanup
 * 4. Clean up stale proximity events for pairs no longer close
 * 5. Only fire sts_transfer anomaly for pairs with 30+ minutes sustained proximity
 *
 * @returns Total number of anomalies upserted (2 per pair)
 */
export async function detectStsTransfers(): Promise<number> {
  // Bin current fixes before applying haversine. In the monitored latitudes a
  // 0.926km separation spans less than 0.025 degrees in either axis, so only
  // the vessel's own cell and eight neighboring cells can contain a match.
  // This avoids a fleet-wide pairwise trigonometric join as contacts grow.
  const result = await pool.query<StsRow>(`
    WITH current AS MATERIALIZED (
      SELECT v.imo, v.mmsi, v.name, p.latitude, p.longitude,
        floor(p.latitude / 0.025)::int AS lat_cell,
        floor(p.longitude / 0.025)::int AS lon_cell
      FROM vessels v
      JOIN vessel_latest_positions p ON p.mmsi = v.mmsi
      WHERE p.time > NOW() - INTERVAL '${POSITION_FRESHNESS_MINUTES} minutes'
    ), nearby AS MATERIALIZED (
      SELECT a.imo, a.mmsi, a.name, a.latitude, a.longitude,
        a.lat_cell + lat_step.delta AS lat_cell,
        a.lon_cell + lon_step.delta AS lon_cell
      FROM current a
      CROSS JOIN (VALUES (-1), (0), (1)) AS lat_step(delta)
      CROSS JOIN (VALUES (-1), (0), (1)) AS lon_step(delta)
    )
    SELECT
      a.imo as imo_a, a.name as name_a, a.latitude as lat_a, a.longitude as lon_a,
      b.imo as imo_b, b.name as name_b, b.latitude as lat_b, b.longitude as lon_b,
      2 * 6371 * asin(sqrt(
        sin(radians((b.latitude - a.latitude) / 2))^2 +
        cos(radians(a.latitude)) * cos(radians(b.latitude)) *
        sin(radians((b.longitude - a.longitude) / 2))^2
      )) as distance_km
    FROM nearby a
    JOIN current b ON b.lat_cell = a.lat_cell AND b.lon_cell = a.lon_cell
      AND b.imo > a.imo AND b.mmsi <> a.mmsi
    WHERE 2 * 6371 * asin(sqrt(
        sin(radians((b.latitude - a.latitude) / 2))^2 +
        cos(radians(a.latitude)) * cos(radians(b.latitude)) *
        sin(radians((b.longitude - a.longitude) / 2))^2
      )) < ${STS_DISTANCE_KM}
  `);

  // Step A — Upsert proximity events for all currently-close pairs, chunked
  // into multi-row upserts (mirrors upsertVessels/insertPositions in
  // harvest-once.ts) instead of one round-trip per pair.
  // Track the minimum observed separation across the encounter in distance_km.
  // Each contact occupies one cell, and b.imo > a.imo picks one direction,
  // so no dedup is needed before the multi-row upsert.
  for (let i = 0; i < result.rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = result.rows.slice(i, i + UPSERT_CHUNK_SIZE);
    if (chunk.length === 0) continue;
    const cols = 3;
    const values = chunk.map((_, j) => {
      const b = j * cols;
      return `($${b + 1}, $${b + 2}, NOW(), NOW(), $${b + 3})`;
    }).join(', ');
    const params = chunk.flatMap((row) => [row.imo_a, row.imo_b, Number(row.distance_km)]);
    await pool.query(`
      INSERT INTO vessel_proximity_events (imo_a, imo_b, first_seen_at, last_seen_at, distance_km)
      VALUES ${values}
      ON CONFLICT (imo_a, imo_b) DO UPDATE SET
        last_seen_at = NOW(),
        distance_km = LEAST(COALESCE(vessel_proximity_events.distance_km, EXCLUDED.distance_km), EXCLUDED.distance_km)
    `, params);
  }

  // Step B — Archive sustained encounters that are about to age out into the
  // rendezvous ledger, so Known Associates history survives the DELETE below.
  // Only pairs that reached the sustained threshold are worth persisting.
  // Centroid is the midpoint of each vessel's last known position; sanctions
  // status is stamped at archive time by joining vessel_sanctions.
  await pool.query(`
    INSERT INTO vessel_rendezvous (
      imo_a, imo_b, first_seen_at, last_seen_at, min_distance_km,
      centroid_lat, centroid_lon, a_sanctioned, b_sanctioned
    )
    SELECT
      pe.imo_a, pe.imo_b, pe.first_seen_at, pe.last_seen_at, pe.distance_km,
      (a_pos.latitude + b_pos.latitude) / 2 AS centroid_lat,
      (a_pos.longitude + b_pos.longitude) / 2 AS centroid_lon,
      sa.imo IS NOT NULL AS a_sanctioned,
      sb.imo IS NOT NULL AS b_sanctioned
    FROM vessel_proximity_events pe
    LEFT JOIN vessels va ON va.imo = pe.imo_a
    LEFT JOIN vessels vb ON vb.imo = pe.imo_b
    LEFT JOIN vessel_latest_positions a_pos ON a_pos.mmsi = va.mmsi
    LEFT JOIN vessel_latest_positions b_pos ON b_pos.mmsi = vb.mmsi
    LEFT JOIN vessel_sanctions sa ON sa.imo = pe.imo_a
    LEFT JOIN vessel_sanctions sb ON sb.imo = pe.imo_b
    WHERE pe.last_seen_at < NOW() - INTERVAL '${POSITION_FRESHNESS_MINUTES + 5} minutes'
      AND pe.last_seen_at - pe.first_seen_at >= INTERVAL '${SUSTAINED_PROXIMITY_MINUTES} minutes'
    ON CONFLICT (imo_a, imo_b, first_seen_at) DO UPDATE SET
      last_seen_at = EXCLUDED.last_seen_at,
      min_distance_km = LEAST(COALESCE(vessel_rendezvous.min_distance_km, EXCLUDED.min_distance_km), EXCLUDED.min_distance_km),
      centroid_lat = EXCLUDED.centroid_lat,
      centroid_lon = EXCLUDED.centroid_lon,
      a_sanctioned = EXCLUDED.a_sanctioned,
      b_sanctioned = EXCLUDED.b_sanctioned
  `);

  // Step C — Clean up stale proximity events (pairs no longer within 0.5nm)
  // Use POSITION_FRESHNESS_MINUTES + 5 (35 min) to account for cron timing drift
  await pool.query(`
    DELETE FROM vessel_proximity_events
    WHERE last_seen_at < NOW() - INTERVAL '${POSITION_FRESHNESS_MINUTES + 5} minutes'
  `);

  // Step D — Fire anomalies only for pairs with 30+ minutes of sustained proximity
  const sustained = await pool.query<{ imo_a: string; imo_b: string }>(`
    SELECT imo_a, imo_b FROM vessel_proximity_events
    WHERE last_seen_at - first_seen_at >= INTERVAL '${SUSTAINED_PROXIMITY_MINUTES} minutes'
  `);

  const sustainedPairs = new Set(sustained.rows.map(r => `${r.imo_a}:${r.imo_b}`));
  const batch: UpsertAnomalyInput[] = [];

  for (const row of result.rows) {
    const pairKey = `${row.imo_a}:${row.imo_b}`;
    if (!sustainedPairs.has(pairKey)) continue;

    const distanceKm = Number(row.distance_km);

    // Anomaly for vessel A — references vessel B
    const detailsA: StsTransferDetails = {
      otherImo: row.imo_b,
      otherName: row.name_b,
      distanceKm,
      lat: row.lat_a,
      lon: row.lon_a,
    };

    batch.push({
      imo: row.imo_a,
      anomalyType: 'sts_transfer',
      confidence: 'suspected',
      detectedAt: new Date(),
      details: detailsA,
    });

    // Anomaly for vessel B — references vessel A
    const detailsB: StsTransferDetails = {
      otherImo: row.imo_a,
      otherName: row.name_a,
      distanceKm,
      lat: row.lat_b,
      lon: row.lon_b,
    };

    batch.push({
      imo: row.imo_b,
      anomalyType: 'sts_transfer',
      confidence: 'suspected',
      detectedAt: new Date(),
      details: detailsB,
    });
  }

  // NOTE: if a vessel is sustained-close to two different partners in the
  // same run, both push a 'sts_transfer' row for that same imo.
  // upsertAnomaliesBatch dedupes to the last one — same outcome as the old
  // per-row loop, since only one active (resolved_at IS NULL) sts_transfer
  // row can exist per vessel regardless (this is a preexisting one-partner
  // limitation of the schema, not something this change introduces).
  await upsertAnomaliesBatch(batch);
  return batch.length;
}
