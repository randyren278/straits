-- One fact per vessel, UTC day, and observed region. Keeps traffic and SPC
-- charts useful after the seven-day raw-position prune. '*' means any region.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

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

-- Repeatable backfill. Historical days already pruned cannot be reconstructed.
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

COMMIT;
