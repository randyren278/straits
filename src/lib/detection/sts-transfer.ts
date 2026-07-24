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
import { upsertAnomaly } from '../db/anomalies';
import type { StsTransferDetails } from '../../types/anomaly';

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
  // Find vessel pairs within 0.5nm using haversine formula
  // b.imo > a.imo ensures lexicographic deduplication — each pair appears once
  const result = await pool.query<StsRow>(`
    SELECT DISTINCT ON (LEAST(a.imo, b.imo), GREATEST(a.imo, b.imo))
      a.imo as imo_a, a.name as name_a, a_pos.latitude as lat_a, a_pos.longitude as lon_a,
      b.imo as imo_b, b.name as name_b, b_pos.latitude as lat_b, b_pos.longitude as lon_b,
      2 * 6371 * asin(sqrt(
        sin(radians((b_pos.latitude - a_pos.latitude) / 2))^2 +
        cos(radians(a_pos.latitude)) * cos(radians(b_pos.latitude)) *
        sin(radians((b_pos.longitude - a_pos.longitude) / 2))^2
      )) as distance_km
    FROM vessels a
    JOIN LATERAL (
      SELECT latitude, longitude FROM vessel_positions
      WHERE mmsi = a.mmsi AND time > NOW() - INTERVAL '${POSITION_FRESHNESS_MINUTES} minutes'
      ORDER BY time DESC LIMIT 1
    ) a_pos ON true
    JOIN vessels b ON b.imo > a.imo
    JOIN LATERAL (
      SELECT latitude, longitude FROM vessel_positions
      WHERE mmsi = b.mmsi AND time > NOW() - INTERVAL '${POSITION_FRESHNESS_MINUTES} minutes'
      ORDER BY time DESC LIMIT 1
    ) b_pos ON true
    WHERE 2 * 6371 * asin(sqrt(
        sin(radians((b_pos.latitude - a_pos.latitude) / 2))^2 +
        cos(radians(a_pos.latitude)) * cos(radians(b_pos.latitude)) *
        sin(radians((b_pos.longitude - a_pos.longitude) / 2))^2
      )) < ${STS_DISTANCE_KM}
  `);

  // Step A — Upsert proximity events for all currently-close pairs.
  // Track the minimum observed separation across the encounter in distance_km.
  for (const row of result.rows) {
    await pool.query(`
      INSERT INTO vessel_proximity_events (imo_a, imo_b, first_seen_at, last_seen_at, distance_km)
      VALUES ($1, $2, NOW(), NOW(), $3)
      ON CONFLICT (imo_a, imo_b) DO UPDATE SET
        last_seen_at = NOW(),
        distance_km = LEAST(COALESCE(vessel_proximity_events.distance_km, EXCLUDED.distance_km), EXCLUDED.distance_km)
    `, [row.imo_a, row.imo_b, Number(row.distance_km)]);
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
    LEFT JOIN LATERAL (
      SELECT latitude, longitude FROM vessel_positions
      WHERE mmsi = va.mmsi ORDER BY time DESC LIMIT 1
    ) a_pos ON true
    LEFT JOIN LATERAL (
      SELECT latitude, longitude FROM vessel_positions
      WHERE mmsi = vb.mmsi ORDER BY time DESC LIMIT 1
    ) b_pos ON true
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
  let count = 0;

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

    await upsertAnomaly({
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

    await upsertAnomaly({
      imo: row.imo_b,
      anomalyType: 'sts_transfer',
      confidence: 'suspected',
      detectedAt: new Date(),
      details: detailsB,
    });

    count += 2;
  }

  return count;
}
