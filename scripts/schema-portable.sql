-- Straits — Portable (vanilla PostgreSQL) schema
-- =============================================================================
-- This is the deploy schema for hosts WITHOUT the TimescaleDB extension
-- (e.g. Supabase on Postgres 17, where timescaledb is deprecated/unavailable).
--
-- It is byte-for-byte identical to src/lib/db/schema.sql EXCEPT:
--   • vessel_positions is a plain table (no create_hypertable)
--   • no compression / compression policy on vessel_positions
--
-- The application's runtime queries were ported off TimescaleDB-only functions
-- (time_bucket -> date_trunc), so they run identically on both engines. Local
-- dev still uses schema.sql with the real hypertable; this file is for hosted
-- demo databases seeded with a bounded dataset where hypertable partitioning
-- and compression add no value.
-- =============================================================================

-- Vessel metadata table (IMO as primary key per DATA-03)
CREATE TABLE IF NOT EXISTS vessels (
  imo VARCHAR(10) PRIMARY KEY,
  mmsi VARCHAR(9) NOT NULL,
  name VARCHAR(255) NOT NULL,
  flag VARCHAR(2),
  ship_type INTEGER,
  destination VARCHAR(255),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vessels_mmsi ON vessels(mmsi);
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

-- Vessel positions time-series table (plain table — no hypertable)
CREATE TABLE IF NOT EXISTS vessel_positions (
  time TIMESTAMPTZ NOT NULL,
  mmsi VARCHAR(9) NOT NULL,
  imo VARCHAR(10),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed REAL,
  course REAL,
  heading REAL,
  nav_status INTEGER,
  low_confidence BOOLEAN DEFAULT FALSE,
  raw_message JSONB
);

CREATE INDEX IF NOT EXISTS idx_positions_mmsi_time ON vessel_positions(mmsi, time DESC);
CREATE INDEX IF NOT EXISTS idx_positions_imo_time ON vessel_positions(imo, time DESC);
-- Plain btree index on time replaces the hypertable's implicit time partitioning
CREATE INDEX IF NOT EXISTS idx_positions_time ON vessel_positions(time DESC);

-- =============================================================================
-- Phase 2: Intelligence Layers
-- =============================================================================

CREATE TABLE IF NOT EXISTS vessel_sanctions (
  imo VARCHAR(10) PRIMARY KEY,
  sanctioning_authority VARCHAR(10) NOT NULL,
  list_date DATE,
  reason TEXT,
  confidence VARCHAR(10) DEFAULT 'HIGH',
  source_url TEXT,
  risk_category VARCHAR(50),
  datasets TEXT[],
  flag TEXT,
  mmsi TEXT,
  aliases TEXT[],
  opensanctions_url TEXT,
  vessel_type VARCHAR(20),
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oil_prices (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  change DECIMAL(10, 2),
  change_percent DECIMAL(5, 2),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oil_prices_symbol_time ON oil_prices(symbol, fetched_at DESC);

CREATE TABLE IF NOT EXISTS news_items (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  source VARCHAR(100),
  url TEXT NOT NULL UNIQUE,
  published_at TIMESTAMPTZ,
  relevance_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_items_time ON news_items(published_at DESC);

-- =============================================================================
-- Phase 3: Anomaly Detection
-- =============================================================================

CREATE TABLE IF NOT EXISTS vessel_anomalies (
  id SERIAL PRIMARY KEY,
  imo VARCHAR(10) NOT NULL REFERENCES vessels(imo),
  anomaly_type VARCHAR(50) NOT NULL,
  confidence VARCHAR(20) DEFAULT 'confirmed',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_anomalies_active ON vessel_anomalies(imo, anomaly_type)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON vessel_anomalies(anomaly_type, detected_at DESC);

CREATE TABLE IF NOT EXISTS watchlist (
  user_id VARCHAR(50) NOT NULL,
  imo VARCHAR(10) NOT NULL REFERENCES vessels(imo),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  PRIMARY KEY (user_id, imo)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id, added_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  imo VARCHAR(10) REFERENCES vessels(imo),
  alert_type VARCHAR(50) NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  details JSONB,
  scope TEXT,
  chokepoint TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(user_id, triggered_at DESC)
  WHERE read_at IS NULL;

-- =============================================================================
-- Phase 12: Behavioral Pattern Detection
-- =============================================================================

CREATE TABLE IF NOT EXISTS vessel_destination_changes (
  id SERIAL PRIMARY KEY,
  imo TEXT NOT NULL,
  previous_destination TEXT NOT NULL,
  new_destination TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dest_changes_imo_time ON vessel_destination_changes(imo, changed_at DESC);

CREATE TABLE IF NOT EXISTS vessel_proximity_events (
  imo_a TEXT NOT NULL,
  imo_b TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  distance_km DOUBLE PRECISION,
  PRIMARY KEY (imo_a, imo_b)
);

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

CREATE INDEX IF NOT EXISTS idx_rendezvous_imo_a ON vessel_rendezvous(imo_a);
CREATE INDEX IF NOT EXISTS idx_rendezvous_imo_b ON vessel_rendezvous(imo_b);

-- =============================================================================
-- Phase 13: Dark Fleet Risk Score
-- =============================================================================

CREATE TABLE IF NOT EXISTS vessel_risk_scores (
  imo TEXT PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 0,
  factors JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Pipeline execution ledger
-- =============================================================================
-- Mirrors scripts/migrations/20260821_pipeline_runs.sql. That migration exists
-- to add the table to databases provisioned before it landed; this copy is what
-- gives a freshly provisioned database the table. Both are idempotent, so
-- applying the schema and then every migration (as CI does) is a no-op here.

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
  worker_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_job_started
  ON pipeline_runs(job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status_started
  ON pipeline_runs(status, started_at DESC);

-- =============================================================================
-- Row-Level Security
-- =============================================================================
-- A hosted Supabase project always exposes PostgREST on the project URL, and
-- grants the publishable `anon` key's role full DML on every table in `public`
-- by default. With RLS off that leaves the whole dataset readable and writable
-- by anyone who knows the URL (`rls_disabled_in_public`).
--
-- This app never touches PostgREST — every query runs server-side through the
-- `pg.Pool` in src/lib/db/index.ts as the database owner. So RLS is enabled
-- with NO policies: zero policies denies every row to every non-exempt role,
-- while the owner (which also carries BYPASSRLS on Supabase) is unaffected.
-- FORCE ROW LEVEL SECURITY is intentionally not set — forcing it on the owner
-- is the one thing that would break the app.
--
-- Catalog-driven so tables added later are covered on the next apply. Run
-- scripts/enable-rls.sql to retrofit a database deployed before this block.
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
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Defense in depth: revoke the grants Supabase hands the PostgREST roles, so a
-- policy added by accident later can't silently re-open the data. Guarded on
-- role existence so this file still applies to a plain local Postgres.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);

      -- The REVOKEs above only touch tables that exist right now. Without also
      -- rewriting the default privileges, the next table created in this schema
      -- is granted to the PostgREST roles again and the hole silently reopens.
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
