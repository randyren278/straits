import { query } from './index';
import { COVERAGE_PEER_LIMIT, type BucketRow, type VesselGapSummary } from '@/lib/coverage/diagnostics';

export interface CoveragePeer {
  mmsi: string;
  imo: string | null;
  name: string | null;
  latitude: number;
  longitude: number;
  lastFix: string;
  source: string | null;
}

interface PeerRow extends Record<string, unknown> {
  mmsi: string;
  imo: string | null;
  name: string | null;
  latitude: number;
  longitude: number;
  last_fix: Date | string;
  source: string | null;
}

interface BucketDbRow extends Record<string, unknown> {
  bucket_start: Date | string;
  source: string;
  message_count: number;
  latest_fix: Date | string | null;
}

interface GapDbRow extends Record<string, unknown> {
  count: number;
  first_fix: Date | string | null;
  last_fix: Date | string | null;
  longest_gap_seconds: number | null;
  longest_gap_start: Date | string | null;
  longest_gap_end: Date | string | null;
}

function iso(value: Date | string | null): string | null {
  if (value == null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function getRegionBuckets(region: string): Promise<BucketRow[]> {
  const rows = await query<BucketDbRow>(
    `SELECT bucket_start, source, message_count, latest_fix
       FROM collection_buckets
      WHERE region = $1
        AND bucket_start >= NOW() - INTERVAL '48 hours'
        AND bucket_start <= NOW()
      ORDER BY bucket_start ASC, source ASC`,
    [region],
  );
  return rows.map((row) => ({
    bucketStart: row.bucket_start,
    source: row.source,
    messageCount: Number(row.message_count),
    latestFix: row.latest_fix,
  }));
}

/** Returns only the newest retained last-observed positions inside these fixed bounds. */
export async function getRegionPeers(region: string, bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }): Promise<CoveragePeer[]> {
  const rows = await query<PeerRow>(
    `SELECT latest.mmsi, latest.imo,
            COALESCE(fallback.name, vessel.name) AS name,
            latest.latitude, latest.longitude, latest.time AS last_fix, latest.source
       FROM vessel_latest_positions AS latest
       LEFT JOIN vessel_fallback_metadata AS fallback ON fallback.mmsi = latest.mmsi
       LEFT JOIN vessels AS vessel ON vessel.imo = latest.imo
      WHERE latest.time >= NOW() - INTERVAL '48 hours'
        AND latest.time <= NOW()
        AND latest.latitude BETWEEN $1 AND $2
        AND latest.longitude BETWEEN $3 AND $4
      ORDER BY latest.time DESC, latest.mmsi ASC
      LIMIT ${COVERAGE_PEER_LIMIT}`,
    [bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon],
  );
  return rows.map((row) => ({
    mmsi: row.mmsi,
    imo: row.imo,
    name: row.name,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    lastFix: new Date(row.last_fix).toISOString(),
    source: row.source,
  }));
}

export async function getVesselGapSummary(mmsi: string): Promise<VesselGapSummary | null> {
  const rows = await query<GapDbRow>(
    `WITH ordered_fixes AS (
       SELECT time,
              LAG(time) OVER (ORDER BY time ASC) AS previous_time
         FROM vessel_positions
        WHERE mmsi = $1
          AND time >= NOW() - INTERVAL '48 hours'
          AND time <= NOW()
     ), gaps AS (
       SELECT EXTRACT(EPOCH FROM (time - previous_time))::double precision AS seconds,
              previous_time AS gap_start,
              time AS gap_end
         FROM ordered_fixes
        WHERE previous_time IS NOT NULL
     )
     SELECT (SELECT COUNT(*)::integer FROM ordered_fixes) AS count,
            (SELECT MIN(time) FROM ordered_fixes) AS first_fix,
            (SELECT MAX(time) FROM ordered_fixes) AS last_fix,
            (SELECT seconds FROM gaps ORDER BY seconds DESC, gap_start ASC LIMIT 1) AS longest_gap_seconds,
            (SELECT gap_start FROM gaps ORDER BY seconds DESC, gap_start ASC LIMIT 1) AS longest_gap_start,
            (SELECT gap_end FROM gaps ORDER BY seconds DESC, gap_start ASC LIMIT 1) AS longest_gap_end`,
    [mmsi],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    count: Number(row.count),
    firstFix: iso(row.first_fix),
    lastFix: iso(row.last_fix),
    longestGapSeconds: row.longest_gap_seconds == null ? null : Number(row.longest_gap_seconds),
    longestGapStart: iso(row.longest_gap_start),
    longestGapEnd: iso(row.longest_gap_end),
  };
}
