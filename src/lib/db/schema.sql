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
  raw_message JSONB                   -- Original AIS message for debugging
);

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
-- Phase 2: Intelligence Layers
-- =============================================================================

-- Vessel sanctions table (INTL-01)
-- Stores matched vessels from OpenSanctions and other sanctions lists
-- IMO as primary key allows direct joining with vessels table
CREATE TABLE IF NOT EXISTS vessel_sanctions (
  imo VARCHAR(10) PRIMARY KEY,                        -- Vessel IMO number (matches vessels.imo)
  sanctioning_authority VARCHAR(10) NOT NULL,         -- Authority code: OFAC, EU, UN, etc.
  list_date DATE,                                     -- Date vessel was added to sanctions list
  reason TEXT,                                        -- Reason for sanctions (if provided)
  confidence VARCHAR(10) DEFAULT 'HIGH',              -- Match confidence: HIGH, MEDIUM, LOW
  source_url TEXT,                                    -- URL to source document/list
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
