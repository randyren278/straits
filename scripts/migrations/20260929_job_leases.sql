-- Transaction-pooler-safe worker ownership; replaces session advisory locks.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
CREATE TABLE IF NOT EXISTS job_leases (
  job_name TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE job_leases ENABLE ROW LEVEL SECURITY;
COMMIT;
