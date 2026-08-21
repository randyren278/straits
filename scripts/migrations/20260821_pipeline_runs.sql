-- Distributed worker coordination and execution ledger.
-- Idempotent: safe to apply on every deploy/startup.

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

ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE pipeline_runs FROM %I', r);
      EXECUTE format('REVOKE ALL ON SEQUENCE pipeline_runs_id_seq FROM %I', r);
    END IF;
  END LOOP;
END $$;
