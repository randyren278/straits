/**
 * Ship-to-Ship Transfer Detection
 *
 * Detects vessel pairs in close proximity at sea, suggesting cargo transfer.
 * Close proximity = within 0.5 nautical miles (0.926 km) with both vessels
 * having recent AIS positions (within 30 minutes).
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
 * 1. SQL haversine query finds all vessel pairs within 0.5nm where both have
 *    positions in the last 30 minutes — b.imo > a.imo ensures each pair found once
 * 2. For each pair, upsert TWO anomalies (one per vessel) with cross-reference details
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

  let count = 0;

  for (const row of result.rows) {
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
