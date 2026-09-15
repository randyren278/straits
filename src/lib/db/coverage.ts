/**
 * collection_buckets persistence + the per-chokepoint quality read the API serves.
 * Server-only (uses the pool).
 */
import { pool } from './index';
import { CHOKEPOINTS } from '../geo/chokepoints-constants';
import { classifyQuality, type QualityAssessment, type QualityBucket } from '../coverage/quality';
import type { CollectionBucketRow } from '../coverage/buckets';

/**
 * Runtime-safe migration, same DDL as scripts/migrations/20260915_collection_buckets.sql
 * (see pipeline-runs.ts for why both exist).
 */
export const COLLECTION_BUCKETS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS collection_buckets (
    region TEXT NOT NULL,
    bucket_start TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    unique_mmsi INTEGER NOT NULL DEFAULT 0,
    latest_fix TIMESTAMPTZ,
    run_id TEXT,
    PRIMARY KEY (region, bucket_start, source)
  );
  CREATE INDEX IF NOT EXISTS idx_collection_buckets_region_start
    ON collection_buckets(region, bucket_start DESC);
  ALTER TABLE collection_buckets ENABLE ROW LEVEL SECURITY;
`;

export async function ensureCollectionBucketsSchema(): Promise<void> {
  await pool.query(COLLECTION_BUCKETS_SCHEMA_SQL);
}

const CHUNK = 500;
const COLS = 7;

/**
 * One multi-row upsert per ≤500 rows. Two harvests landing in the same bucket
 * (a manual "run now" next to the scheduled run) add their message counts and
 * keep the larger unique count / later fix rather than clobbering each other.
 */
export async function upsertCollectionBuckets(rows: readonly CollectionBucketRow[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk.map((_, j) => {
      const b = j * COLS;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`;
    }).join(', ');
    const params = chunk.flatMap((r) => [
      r.region, r.bucketStart, r.source, r.messageCount, r.uniqueMmsi, r.latestFix, r.runId,
    ]);
    await pool.query(
      `INSERT INTO collection_buckets
         (region, bucket_start, source, message_count, unique_mmsi, latest_fix, run_id)
       VALUES ${values}
       ON CONFLICT (region, bucket_start, source) DO UPDATE SET
         message_count = collection_buckets.message_count + EXCLUDED.message_count,
         unique_mmsi   = GREATEST(collection_buckets.unique_mmsi, EXCLUDED.unique_mmsi),
         latest_fix    = GREATEST(collection_buckets.latest_fix, EXCLUDED.latest_fix),
         run_id        = EXCLUDED.run_id`,
      params,
    );
    written += chunk.length;
  }
  return written;
}

/**
 * One row per 10-minute bucket with sources merged. Sources are disjoint per
 * harvest (primary wins per MMSI before anything is written), so unique
 * counts add across sources.
 */
export async function getRecentBuckets(region: string, hours: number): Promise<QualityBucket[]> {
  const result = await pool.query<{
    bucket_start: Date; message_count: number; unique_mmsi: number; latest_fix: Date | null;
  }>(
    `SELECT bucket_start,
            SUM(message_count)::int AS message_count,
            SUM(unique_mmsi)::int AS unique_mmsi,
            MAX(latest_fix) AS latest_fix
     FROM collection_buckets
     WHERE region = $1 AND bucket_start > NOW() - ($2 || ' hours')::interval
     GROUP BY bucket_start
     ORDER BY bucket_start DESC`,
    [region, String(hours)],
  );
  return result.rows.map((r) => ({
    bucketStart: r.bucket_start,
    messageCount: r.message_count,
    uniqueMmsi: r.unique_mmsi,
    latestFix: r.latest_fix,
  }));
}

export interface ChokepointQuality extends QualityAssessment {
  id: string;
  name: string;
  /** Always true today: every chokepoint sits inside a subscribed box. */
  subscribed: boolean;
}

export async function getChokepointQuality(now = new Date()): Promise<ChokepointQuality[]> {
  return Promise.all(
    Object.values(CHOKEPOINTS).map(async (cp) => {
      const buckets = await getRecentBuckets(cp.id, 24);
      return { id: cp.id, name: cp.name, subscribed: true, ...classifyQuality(buckets, now) };
    }),
  );
}

export interface HourlyBucket {
  /** ISO start of the hour (UTC). */
  hour: string;
  messages: number;
  /** Peak per-bucket unique MMSI within the hour, sources summed per bucket (a sum across buckets would double count). */
  unique: number;
  /** Peak per-bucket unique MMSI heard from the primary / the fallback. */
  aisstream: number;
  fallback: number;
  /** Number of 10-minute collection rows in the hour — 0 means the harvester never ran. */
  attempted: number;
}

export interface RegionHistory {
  id: string;
  name: string;
  hours: HourlyBucket[];
}

/**
 * Hour-by-hour collection record per chokepoint for the heatmaps. One query
 * for every region; missing hours are filled client-side as "not attempted".
 */
export async function getCoverageHistory(hours: number): Promise<RegionHistory[]> {
  const result = await pool.query<{
    region: string; hour: Date; messages: number; unique: number; aisstream: number; fallback: number; attempted: number;
  }>(
    `WITH per_bucket AS (
       SELECT region, bucket_start,
              SUM(message_count) AS messages,
              SUM(unique_mmsi) AS unique_all,
              SUM(unique_mmsi) FILTER (WHERE source = 'aisstream') AS unique_primary,
              SUM(unique_mmsi) FILTER (WHERE source <> 'aisstream') AS unique_fallback
       FROM collection_buckets
       WHERE region = ANY($1) AND bucket_start > NOW() - ($2 || ' hours')::interval
       GROUP BY region, bucket_start
     )
     SELECT region,
            date_trunc('hour', bucket_start) AS hour,
            SUM(messages)::int AS messages,
            MAX(unique_all)::int AS unique,
            COALESCE(MAX(unique_primary), 0)::int AS aisstream,
            COALESCE(MAX(unique_fallback), 0)::int AS fallback,
            COUNT(*)::int AS attempted
     FROM per_bucket
     GROUP BY region, hour
     ORDER BY region, hour`,
    [Object.keys(CHOKEPOINTS), String(hours)],
  );
  const byRegion = new Map<string, HourlyBucket[]>();
  for (const r of result.rows) {
    let list = byRegion.get(r.region);
    if (!list) { list = []; byRegion.set(r.region, list); }
    list.push({
      hour: r.hour.toISOString(), messages: r.messages, unique: r.unique,
      aisstream: r.aisstream ?? 0, fallback: r.fallback ?? 0, attempted: r.attempted,
    });
  }
  return Object.values(CHOKEPOINTS).map((cp) => ({ id: cp.id, name: cp.name, hours: byRegion.get(cp.id) ?? [] }));
}
