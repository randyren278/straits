-- Track engine: per-vessel API-ready state, learning state, and decaying lane density.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS vessel_track_state (
  mmsi VARCHAR(9) PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_track_state_updated ON vessel_track_state(updated_at DESC);
ALTER TABLE vessel_track_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS track_engine_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE track_engine_state ENABLE ROW LEVEL SECURITY;

-- Lane weight per 0.02° cell; readers decay it by a ~14-day half-life from updated_at.
CREATE TABLE IF NOT EXISTS lane_density (
  cell INTEGER PRIMARY KEY,
  w REAL NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lane_density ENABLE ROW LEVEL SECURITY;

COMMIT;
