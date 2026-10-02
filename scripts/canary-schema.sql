-- App-owned canary state. Production observation data remains in public.
-- Apply as the database owner after the straits_canary role exists.
CREATE SCHEMA IF NOT EXISTS canary;

CREATE TABLE IF NOT EXISTS canary.watchlist (
  user_id VARCHAR(50) NOT NULL,
  imo VARCHAR(10) NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  PRIMARY KEY (user_id, imo)
);
CREATE INDEX IF NOT EXISTS idx_canary_watchlist_user
  ON canary.watchlist(user_id, added_at DESC);

CREATE TABLE IF NOT EXISTS canary.alerts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  imo VARCHAR(10),
  alert_type VARCHAR(50) NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  details JSONB,
  scope TEXT,
  chokepoint TEXT
);
CREATE INDEX IF NOT EXISTS idx_canary_alerts_unread
  ON canary.alerts(user_id, triggered_at DESC)
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS canary.performance_samples (
  sample_id UUID NOT NULL,
  metric VARCHAR(20) NOT NULL,
  route VARCHAR(40) NOT NULL,
  device VARCHAR(12) NOT NULL,
  connection VARCHAR(12) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  build_sha VARCHAR(40) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sample_id, metric),
  CONSTRAINT canary_performance_metric_allowed CHECK (
    metric IN ('LCP', 'INP', 'CLS', 'MAP_READY', 'MAP_INIT_ERROR', 'MAP_DATA_ERROR', 'SHELL_READY', 'SNAPSHOT_RECEIVED', 'MAP_STYLE_READY')
  ),
  CONSTRAINT canary_performance_value_bounded CHECK (value >= 0 AND value <= 120000)
);
CREATE INDEX IF NOT EXISTS idx_canary_performance_created
  ON canary.performance_samples(created_at);
CREATE INDEX IF NOT EXISTS idx_canary_performance_report
  ON canary.performance_samples(metric, route, device, created_at DESC);

ALTER TABLE canary.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE canary.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE canary.performance_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS canary_app_access ON canary.watchlist;
CREATE POLICY canary_app_access ON canary.watchlist
  TO straits_canary USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS canary_app_access ON canary.alerts;
CREATE POLICY canary_app_access ON canary.alerts
  TO straits_canary USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS canary_app_access ON canary.performance_samples;
CREATE POLICY canary_app_access ON canary.performance_samples
  TO straits_canary USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA canary TO straits_canary;
GRANT SELECT, INSERT, UPDATE, DELETE ON canary.watchlist, canary.alerts, canary.performance_samples TO straits_canary;
GRANT USAGE, SELECT ON SEQUENCE canary.alerts_id_seq TO straits_canary;
