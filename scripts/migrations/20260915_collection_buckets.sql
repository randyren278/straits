-- Per-region, per-source collection provenance: what each harvest actually
-- received. A zero-count row is the evidence that a region was attempted and
-- nothing arrived — the difference between "unobserved" and "empty water".
-- Idempotent: safe to apply on every deploy/startup.

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

-- No policies: RLS-on with zero policies denies PostgREST roles every row (see scripts/enable-rls.sql).
ALTER TABLE collection_buckets ENABLE ROW LEVEL SECURITY;
