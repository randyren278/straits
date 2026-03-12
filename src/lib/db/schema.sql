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
