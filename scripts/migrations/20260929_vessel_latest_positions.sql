-- Current AIS fixes: one row per observed MMSI, independent of history length.
-- Apply before deploying code that reads vessel_latest_positions.
-- The trigger covers the bounded harvester, standalone ingester, local seed,
-- and any other writer of vessel_positions without a second client round-trip.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

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

-- Repeatable backfill. The same tie ordering as the trigger prevents an older
-- historical row from replacing a fix that arrived while this migration ran.
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

COMMIT;
