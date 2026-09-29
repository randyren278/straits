-- First-party sampled Web Vitals and map-ready observations (30-day retention).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

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
  CONSTRAINT performance_value_bounded CHECK (value >= 0 AND value <= 120000)
);
ALTER TABLE performance_samples DROP CONSTRAINT IF EXISTS performance_metric_allowed;
ALTER TABLE performance_samples ADD CONSTRAINT performance_metric_allowed
  CHECK (metric IN ('LCP', 'INP', 'CLS', 'MAP_READY', 'MAP_INIT_ERROR', 'MAP_DATA_ERROR', 'SHELL_READY', 'SNAPSHOT_RECEIVED', 'MAP_STYLE_READY'));
CREATE INDEX IF NOT EXISTS idx_performance_samples_created ON performance_samples(created_at);
CREATE INDEX IF NOT EXISTS idx_performance_samples_report ON performance_samples(metric, route, device, created_at DESC);
ALTER TABLE performance_samples ENABLE ROW LEVEL SECURITY;
COMMIT;
