-- Durable daily crossing counts per chokepoint. Raw positions are pruned after
-- RETENTION_DAYS; these aggregates are what survive, so a 90-day chart can be
-- honest about what was observed. Idempotent: safe to apply on every deploy/startup.

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

-- No policies: RLS-on with zero policies denies PostgREST roles every row (see scripts/enable-rls.sql).
ALTER TABLE chokepoint_daily ENABLE ROW LEVEL SECURITY;
