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
