-- Tanker Tracker Database Schema
-- Uses TimescaleDB extension for efficient time-series storage of vessel positions.
--
-- Key design decisions:
-- - IMO is the primary key for vessels (DATA-03) because MMSI can be reused/spoofed
-- - vessel_positions is a TimescaleDB hypertable with 1-day chunks for efficient queries
-- - Compression policy automatically compresses data older than 7 days
-- - Indexes optimized for common queries: by MMSI/IMO + time range

-- Enable TimescaleDB extension (must be done by superuser or with appropriate privileges)
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Vessel metadata table (IMO as primary key per DATA-03)
-- Sampled, first-party performance observations. The Mac harvester prunes
-- these after 30 days; the table holds no URL query, IP, or user identifier.
CREATE TABLE IF NOT EXISTS performance_samples (
  sample_id UUID NOT NULL,
  metric VARCHAR(20) NOT NULL,
  route VARCHAR(20) NOT NULL,
  device VARCHAR(12) NOT NULL,
  connection VARCHAR(12) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  build_sha VARCHAR(40) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sample_id, metric),
  CONSTRAINT performance_metric_allowed CHECK (metric IN ('LCP', 'INP', 'CLS', 'MAP_READY', 'MAP_INIT_ERROR', 'MAP_DATA_ERROR', 'SHELL_READY', 'SNAPSHOT_RECEIVED', 'MAP_STYLE_READY')),
  CONSTRAINT performance_value_bounded CHECK (value >= 0 AND value <= 120000)
);
CREATE INDEX IF NOT EXISTS idx_performance_samples_created ON performance_samples(created_at);
CREATE INDEX IF NOT EXISTS idx_performance_samples_report ON performance_samples(metric, route, device, created_at DESC);
ALTER TABLE performance_samples ENABLE ROW LEVEL SECURITY;

-- Vessel metadata table (IMO as primary key per DATA-03)
-- Stores static vessel information that doesn't change frequently
CREATE TABLE IF NOT EXISTS vessels (
  imo VARCHAR(10) PRIMARY KEY,        -- IMO number (7 digits + optional check digit)
  mmsi VARCHAR(9) NOT NULL,           -- Maritime Mobile Service Identity (9 digits)
  name VARCHAR(255) NOT NULL,         -- Vessel name from AIS
  flag VARCHAR(2),                    -- Flag state (ISO 3166-1 alpha-2)
  ship_type INTEGER,                  -- AIS ship type code (80-89 = tankers)
  destination VARCHAR(255),           -- Current destination from AIS
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Last time we received data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- Record creation time
);

-- Index for MMSI lookups (AIS messages come with MMSI, not IMO)
CREATE INDEX IF NOT EXISTS idx_vessels_mmsi ON vessels(mmsi);

-- Index for filtering by ship type (e.g., tankers only)
CREATE INDEX IF NOT EXISTS idx_vessels_ship_type ON vessels(ship_type);

-- Public fallback feeds identify vessels by MMSI and do not expose an IMO.
-- Keep their live name/type separate from IMO-keyed canonical vessel records.
CREATE TABLE IF NOT EXISTS vessel_fallback_metadata (
  mmsi VARCHAR(9) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  ship_type INTEGER,
  last_seen TIMESTAMPTZ NOT NULL,
  source VARCHAR(40) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fallback_metadata_last_seen ON vessel_fallback_metadata(last_seen DESC);

-- Vessel positions time-series table
-- Stores all position reports received from AIS
-- Will be converted to TimescaleDB hypertable for efficient time-series queries
CREATE TABLE IF NOT EXISTS vessel_positions (
  time TIMESTAMPTZ NOT NULL,          -- Position report timestamp (partition key)
  mmsi VARCHAR(9) NOT NULL,           -- MMSI from AIS message
  imo VARCHAR(10),                    -- IMO if known (may be null initially)
  latitude DOUBLE PRECISION NOT NULL, -- Latitude in decimal degrees (-90 to 90)
  longitude DOUBLE PRECISION NOT NULL, -- Longitude in decimal degrees (-180 to 180)
  speed REAL,                         -- Speed over ground in knots
  course REAL,                        -- Course over ground in degrees (0-360)
  heading REAL,                       -- True heading in degrees (0-360)
  nav_status INTEGER,                 -- AIS navigational status code
  low_confidence BOOLEAN DEFAULT FALSE, -- Flag for positions in GPS jamming zones
  raw_message JSONB,                  -- Original AIS message for debugging
  source TEXT                         -- Which feed relayed the fix ('aisstream' | 'middle-east-fallback'); NULL on legacy rows
);
-- Databases provisioned before the column existed (mirrors scripts/migrations/20260915_position_source.sql).
ALTER TABLE vessel_positions ADD COLUMN IF NOT EXISTS source TEXT;

-- Convert to TimescaleDB hypertable with 1-day chunks
-- 1-day chunks balance query efficiency with chunk management overhead
-- if_not_exists prevents errors when schema is re-run
SELECT create_hypertable('vessel_positions', 'time',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Index for querying vessel track history: "show me this vessel's positions over time"
-- DESC ordering because we usually want most recent first
CREATE INDEX IF NOT EXISTS idx_positions_mmsi_time ON vessel_positions(mmsi, time DESC);

-- Index for querying by IMO (once we've resolved MMSI -> IMO mapping)
CREATE INDEX IF NOT EXISTS idx_positions_imo_time ON vessel_positions(imo, time DESC);

-- Enable compression on the hypertable
-- Segmenting by MMSI keeps each vessel's data together for efficient reads
ALTER TABLE vessel_positions SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'mmsi'
);

-- Compression policy: automatically compress chunks older than 7 days
-- This significantly reduces storage while maintaining query performance
-- Compressed data is still queryable, just stored more efficiently
SELECT add_compression_policy('vessel_positions', INTERVAL '7 days', if_not_exists => TRUE);

-- =============================================================================
-- Bounded current-state read model; keep this block aligned with
-- scripts/migrations/20260929_vessel_latest_positions.sql.
CREATE TABLE IF NOT EXISTS vessel_latest_positions (
  mmsi VARCHAR(9) PRIMARY KEY,
  time TIMESTAMPTZ NOT NULL,
  imo VARCHAR(10),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed REAL,
  course REAL,
  heading REAL,
  nav_status INTEGER,
  low_confidence BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT
);
CREATE INDEX IF NOT EXISTS idx_latest_positions_time ON vessel_latest_positions(time DESC);
ALTER TABLE vessel_latest_positions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION record_vessel_latest_position() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO vessel_latest_positions
    (mmsi, time, imo, latitude, longitude, speed, course, heading, nav_status, low_confidence, source)
  VALUES
    (NEW.mmsi, NEW.time, NEW.imo, NEW.latitude, NEW.longitude, NEW.speed, NEW.course,
     NEW.heading, NEW.nav_status, COALESCE(NEW.low_confidence, FALSE), NEW.source)
  ON CONFLICT (mmsi) DO UPDATE SET
    time = EXCLUDED.time, imo = EXCLUDED.imo,
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
    speed = EXCLUDED.speed, course = EXCLUDED.course, heading = EXCLUDED.heading,
    nav_status = EXCLUDED.nav_status, low_confidence = EXCLUDED.low_confidence,
    source = EXCLUDED.source
  WHERE (EXCLUDED.time,
         CASE EXCLUDED.source WHEN 'aisstream' THEN 2 WHEN 'middle-east-fallback' THEN 1 ELSE 0 END,
         EXCLUDED.latitude, EXCLUDED.longitude,
         COALESCE(EXCLUDED.source, ''), COALESCE(EXCLUDED.imo, ''),
         COALESCE(EXCLUDED.speed, -1), COALESCE(EXCLUDED.course, -1),
         COALESCE(EXCLUDED.heading, -1), COALESCE(EXCLUDED.nav_status, -1),
         EXCLUDED.low_confidence)
      > (vessel_latest_positions.time,
         CASE vessel_latest_positions.source WHEN 'aisstream' THEN 2 WHEN 'middle-east-fallback' THEN 1 ELSE 0 END,
         vessel_latest_positions.latitude, vessel_latest_positions.longitude,
         COALESCE(vessel_latest_positions.source, ''), COALESCE(vessel_latest_positions.imo, ''),
         COALESCE(vessel_latest_positions.speed, -1), COALESCE(vessel_latest_positions.course, -1),
         COALESCE(vessel_latest_positions.heading, -1), COALESCE(vessel_latest_positions.nav_status, -1),
         vessel_latest_positions.low_confidence);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
DROP TRIGGER IF EXISTS trg_vessel_latest_position ON vessel_positions;
CREATE TRIGGER trg_vessel_latest_position
  AFTER INSERT ON vessel_positions
  FOR EACH ROW EXECUTE FUNCTION record_vessel_latest_position();

INSERT INTO vessel_latest_positions
  (mmsi, time, imo, latitude, longitude, speed, course, heading, nav_status, low_confidence, source)
SELECT DISTINCT ON (mmsi)
  mmsi, time, imo, latitude, longitude, speed, course, heading, nav_status,
  COALESCE(low_confidence, FALSE), source
FROM vessel_positions
WHERE time > NOW() - INTERVAL '7 days'
ORDER BY mmsi, time DESC,
  CASE source WHEN 'aisstream' THEN 2 WHEN 'middle-east-fallback' THEN 1 ELSE 0 END DESC,
  latitude DESC, longitude DESC,
  COALESCE(source, '') DESC, COALESCE(imo, '') DESC,
  COALESCE(speed, -1) DESC, COALESCE(course, -1) DESC,
  COALESCE(heading, -1) DESC, COALESCE(nav_status, -1) DESC,
  COALESCE(low_confidence, FALSE) DESC
ON CONFLICT (mmsi) DO UPDATE SET
  time = EXCLUDED.time, imo = EXCLUDED.imo,
  latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
  speed = EXCLUDED.speed, course = EXCLUDED.course, heading = EXCLUDED.heading,
  nav_status = EXCLUDED.nav_status, low_confidence = EXCLUDED.low_confidence,
  source = EXCLUDED.source
WHERE (EXCLUDED.time,
       CASE EXCLUDED.source WHEN 'aisstream' THEN 2 WHEN 'middle-east-fallback' THEN 1 ELSE 0 END,
       EXCLUDED.latitude, EXCLUDED.longitude,
         COALESCE(EXCLUDED.source, ''), COALESCE(EXCLUDED.imo, ''),
         COALESCE(EXCLUDED.speed, -1), COALESCE(EXCLUDED.course, -1),
         COALESCE(EXCLUDED.heading, -1), COALESCE(EXCLUDED.nav_status, -1),
         EXCLUDED.low_confidence)
    > (vessel_latest_positions.time,
       CASE vessel_latest_positions.source WHEN 'aisstream' THEN 2 WHEN 'middle-east-fallback' THEN 1 ELSE 0 END,
       vessel_latest_positions.latitude, vessel_latest_positions.longitude,
         COALESCE(vessel_latest_positions.source, ''), COALESCE(vessel_latest_positions.imo, ''),
         COALESCE(vessel_latest_positions.speed, -1), COALESCE(vessel_latest_positions.course, -1),
         COALESCE(vessel_latest_positions.heading, -1), COALESCE(vessel_latest_positions.nav_status, -1),
         vessel_latest_positions.low_confidence);

-- Durable daily observed contacts for traffic and SPC after raw history prune.
CREATE TABLE IF NOT EXISTS vessel_daily_presence (
  day DATE NOT NULL,
  mmsi VARCHAR(9) NOT NULL,
  region TEXT NOT NULL,
  PRIMARY KEY (day, mmsi, region)
);
CREATE INDEX IF NOT EXISTS idx_daily_presence_region_day
  ON vessel_daily_presence(region, day DESC);
ALTER TABLE vessel_daily_presence ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION record_vessel_daily_presence() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO vessel_daily_presence(day, mmsi, region)
  SELECT (NEW.time AT TIME ZONE 'UTC')::date, NEW.mmsi, region
  FROM (VALUES
    ('*', TRUE),
    ('hormuz', NEW.latitude BETWEEN 23.5 AND 27.0 AND NEW.longitude BETWEEN 55.5 AND 57.5),
    ('babel_mandeb', NEW.latitude BETWEEN 11.0 AND 13.5 AND NEW.longitude BETWEEN 42.5 AND 45.0),
    ('suez', NEW.latitude BETWEEN 29.5 AND 32.5 AND NEW.longitude BETWEEN 31.5 AND 33.0),
    ('gulf_of_aden', NEW.latitude BETWEEN 11.0 AND 14.0 AND NEW.longitude BETWEEN 43.0 AND 48.0)
  ) AS regions(region, inside)
  WHERE inside
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
DROP TRIGGER IF EXISTS trg_vessel_daily_presence ON vessel_positions;
CREATE TRIGGER trg_vessel_daily_presence
  AFTER INSERT ON vessel_positions
  FOR EACH ROW EXECUTE FUNCTION record_vessel_daily_presence();
INSERT INTO vessel_daily_presence(day, mmsi, region)
SELECT DISTINCT (vp.time AT TIME ZONE 'UTC')::date, vp.mmsi, regions.region
FROM vessel_positions vp
CROSS JOIN LATERAL (VALUES
  ('*', TRUE),
  ('hormuz', vp.latitude BETWEEN 23.5 AND 27.0 AND vp.longitude BETWEEN 55.5 AND 57.5),
  ('babel_mandeb', vp.latitude BETWEEN 11.0 AND 13.5 AND vp.longitude BETWEEN 42.5 AND 45.0),
  ('suez', vp.latitude BETWEEN 29.5 AND 32.5 AND vp.longitude BETWEEN 31.5 AND 33.0),
  ('gulf_of_aden', vp.latitude BETWEEN 11.0 AND 14.0 AND vp.longitude BETWEEN 43.0 AND 48.0)
) AS regions(region, inside)
WHERE inside AND vp.time >= NOW() - INTERVAL '120 days'
ON CONFLICT DO NOTHING;

-- Phase 2: Intelligence Layers
-- =============================================================================

-- Vessel sanctions table (INTL-01, M005-S01)
-- Stores matched vessels from OpenSanctions maritime dataset.
-- IMO as primary key allows direct joining with vessels table.
-- M005: Enriched with risk_category, datasets[], flag, mmsi, aliases[], opensanctions_url, vessel_type, name.
CREATE TABLE IF NOT EXISTS vessel_sanctions (
  imo VARCHAR(10) PRIMARY KEY,                        -- Vessel IMO number (matches vessels.imo)
  sanctioning_authority VARCHAR(10) NOT NULL,         -- Primary authority code: OFAC, EU, UK, CA, UN, CH, UA, PSC, etc.
  list_date DATE,                                     -- Date vessel was added to sanctions list (legacy, may be null)
  reason TEXT,                                        -- Risk category used as reason for backward compatibility
  confidence VARCHAR(10) DEFAULT 'HIGH',              -- Match confidence: HIGH, MEDIUM, LOW
  source_url TEXT,                                    -- URL to source document/list
  risk_category VARCHAR(50),                          -- OpenSanctions risk: sanction, mare.detained, mare.shadow;poi, poi, reg.warn
  datasets TEXT[],                                    -- All dataset IDs listing this entity (e.g., us_ofac_sdn, eu_fsf)
  flag TEXT,                                             -- Vessel flag state(s) from sanctions data (may contain multiple semicolon-separated)
  mmsi TEXT,                                            -- MMSI from sanctions data (may contain multiple semicolon-separated, up to 89 chars)
  aliases TEXT[],                                     -- All known aliases for the vessel
  opensanctions_url TEXT,                             -- Link to OpenSanctions entity profile
  vessel_type VARCHAR(20),                            -- VESSEL or ORGANIZATION
  name TEXT,                                          -- Vessel/organization name from sanctions list
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),      -- Record creation time
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()       -- Last update time
);

-- Oil prices table (INTL-02)
-- Stores historical oil prices for WTI and Brent crude
-- Used for sparkline charts and price change indicators
CREATE TABLE IF NOT EXISTS oil_prices (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,                        -- Price symbol: WTI, BRENT
  price DECIMAL(10, 2) NOT NULL,                      -- Price in USD
  change DECIMAL(10, 2),                              -- Absolute change from previous
  change_percent DECIMAL(5, 2),                       -- Percentage change from previous
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()       -- When price was fetched
);

-- Index for efficient price queries: get latest prices by symbol
CREATE INDEX IF NOT EXISTS idx_oil_prices_symbol_time ON oil_prices(symbol, fetched_at DESC);

-- News items table (INTL-03)
-- Stores oil/shipping related headlines from NewsAPI
-- Used for news sidebar in dashboard
CREATE TABLE IF NOT EXISTS news_items (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,                                -- Headline text
  source VARCHAR(100),                                -- News source name
  url TEXT NOT NULL UNIQUE,                           -- Article URL (unique constraint prevents duplicates)
  published_at TIMESTAMPTZ,                           -- When article was published
  relevance_score INTEGER DEFAULT 0,                  -- Keyword-based relevance score
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()       -- Record creation time
);

-- Index for fetching recent news: sorted by publish time
CREATE INDEX IF NOT EXISTS idx_news_items_time ON news_items(published_at DESC);

-- =============================================================================
-- Phase 3: Anomaly Detection
-- =============================================================================

-- Vessel anomalies table (ANOM-01, ANOM-02)
-- Stores detected anomalies with type-specific details in JSONB
CREATE TABLE IF NOT EXISTS vessel_anomalies (
  id SERIAL PRIMARY KEY,
  imo VARCHAR(10) NOT NULL REFERENCES vessels(imo),
  anomaly_type VARCHAR(50) NOT NULL,           -- 'going_dark', 'loitering', 'deviation', 'speed'
  confidence VARCHAR(20) DEFAULT 'confirmed',  -- 'confirmed', 'suspected', 'unknown'
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,                     -- NULL = still active
  details JSONB,                               -- Type-specific data (last position, radius, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for active anomalies (resolved_at IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_anomalies_active ON vessel_anomalies(imo, anomaly_type)
  WHERE resolved_at IS NULL;

-- Index for efficient lookup by type
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON vessel_anomalies(anomaly_type, detected_at DESC);

-- User watchlist table (HIST-02)
-- Session-based user tracking without full auth
CREATE TABLE IF NOT EXISTS watchlist (
  user_id VARCHAR(50) NOT NULL,               -- UUID from localStorage
  imo VARCHAR(10) NOT NULL REFERENCES vessels(imo),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  PRIMARY KEY (user_id, imo)
);

-- Index for user's watchlist
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id, added_at DESC);

-- User alerts table (HIST-02)
-- Notifications for watched vessels
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  imo VARCHAR(10) NOT NULL REFERENCES vessels(imo),
  alert_type VARCHAR(50) NOT NULL,            -- 'going_dark', 'loitering', 'chokepoint_enter', etc.
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,                        -- NULL = unread
  details JSONB                               -- Context about the alert
);

-- Index for unread alerts
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(user_id, triggered_at DESC)
  WHERE read_at IS NULL;

-- =============================================================================
-- Phase 14: Fleet-Level (System) Alerts
-- =============================================================================
-- System/chokepoint alerts have no vessel (imo IS NULL). Drop the NOT NULL
-- constraint on alerts.imo so a fleet-level alert can be stored. Guarded so the
-- schema stays idempotent — applying it twice is a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'imo' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE alerts ALTER COLUMN imo DROP NOT NULL;
  END IF;
END $$;

-- Scope tag distinguishes vessel alerts (NULL scope) from system alerts
-- (e.g. 'chokepoint'). Chokepoint column names the affected chokepoint id.
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS chokepoint TEXT;

-- =============================================================================
-- Phase 12: Behavioral Pattern Detection
-- =============================================================================

-- Vessel destination changes table (PATT-01)
-- Logs every mid-voyage destination change detected during AIS ingestion.
-- Only non-null to non-null transitions are recorded (NULL-to-value are ignored).
CREATE TABLE IF NOT EXISTS vessel_destination_changes (
  id SERIAL PRIMARY KEY,
  imo TEXT NOT NULL,
  previous_destination TEXT NOT NULL,
  new_destination TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient per-vessel destination change history (most recent first)
CREATE INDEX IF NOT EXISTS idx_dest_changes_imo_time ON vessel_destination_changes(imo, changed_at DESC);

-- Vessel proximity events — tracks when pairs are first observed within 0.5nm
-- Used by STS transfer detector to enforce 30-minute sustained co-location (PATT-03)
CREATE TABLE IF NOT EXISTS vessel_proximity_events (
  imo_a TEXT NOT NULL,
  imo_b TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (imo_a, imo_b)
);

-- Closest observed separation during the current encounter (kilometers)
ALTER TABLE vessel_proximity_events ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION;

-- Rendezvous ledger — archives completed sustained co-location encounters before
-- they age out of vessel_proximity_events, so "Known Associates" history persists.
-- Each row is one encounter (bounded by first_seen_at); repeat encounters between
-- the same pair produce distinct rows, letting us count repeat-partner behavior.
CREATE TABLE IF NOT EXISTS vessel_rendezvous (
  imo_a TEXT NOT NULL,
  imo_b TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  min_distance_km DOUBLE PRECISION,
  centroid_lat DOUBLE PRECISION,
  centroid_lon DOUBLE PRECISION,
  a_sanctioned BOOLEAN,
  b_sanctioned BOOLEAN,
  PRIMARY KEY (imo_a, imo_b, first_seen_at)
);

-- Indexes for associate lookups from either side of the pair
CREATE INDEX IF NOT EXISTS idx_rendezvous_imo_a ON vessel_rendezvous(imo_a);
CREATE INDEX IF NOT EXISTS idx_rendezvous_imo_b ON vessel_rendezvous(imo_b);

-- =============================================================================
-- Phase 13: Dark Fleet Risk Score
-- =============================================================================

-- Per-vessel composite risk score (RISK-01)
-- Only vessels with >=1 anomaly event are stored; zero-score vessels excluded.
CREATE TABLE IF NOT EXISTS vessel_risk_scores (
  imo TEXT PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 0,
  factors JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Collection provenance (observation quality)
-- =============================================================================
-- Mirrors scripts/migrations/20260915_collection_buckets.sql. One row per
-- (region, 10-minute bucket, source) written by every harvest — including
-- zero-count rows, which are what let the UI say "unobserved" instead of "0".

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

-- =============================================================================
-- Durable daily crossing aggregates (Chokepoint Pulse)
-- =============================================================================
-- Mirrors scripts/migrations/20260915_chokepoint_daily.sql. Survives the raw
-- vessel_positions prune, so charts beyond the retention window stay honest.

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

CREATE TABLE IF NOT EXISTS job_leases (
  job_name TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- =============================================================================
-- Row-Level Security
-- =============================================================================
-- Kept in step with scripts/schema-portable.sql, where this actually matters: a
-- hosted Supabase project always exposes PostgREST on the project URL and grants
-- the publishable `anon` key's role full DML on every table in `public`, so with
-- RLS off the whole dataset is readable and writable by anyone who knows the URL
-- (`rls_disabled_in_public`). Local dev is a private Docker container with no
-- PostgREST in front of it, but the two schemas stay identical apart from the
-- hypertable, and enabling RLS here keeps local behaviour honest to production.
--
-- This app never touches PostgREST — every query runs server-side through the
-- `pg.Pool` in src/lib/db/index.ts as the database owner. So RLS is enabled with
-- NO policies: zero policies denies every row to every non-exempt role, while
-- the owner is unaffected. FORCE ROW LEVEL SECURITY is intentionally not set —
-- forcing it on the owner is the one thing that would break the app.
--
-- Per-table failures are downgraded to a NOTICE rather than aborting: run.sh
-- applies this file with ON_ERROR_STOP=1, and vessel_positions is a compressed
-- hypertable whose acceptance of RLS varies by TimescaleDB version. A skip is
-- harmless locally; the hosted database is covered by the strict, verified
-- version of this block in schema-portable.sql and scripts/enable-rls.sql.
DO $$
DECLARE
  t regclass;
BEGIN
  FOR t IN
    SELECT c.oid::regclass
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND NOT c.relrowsecurity
     ORDER BY c.oid::regclass::text
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped RLS on %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- Defense in depth: revoke the grants Supabase hands the PostgREST roles, so a
-- policy added by accident later can't silently re-open the data. Guarded on
-- role existence — these roles don't exist on a local Postgres, so this is a
-- no-op in dev.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
    END IF;
  END LOOP;
END $$;
