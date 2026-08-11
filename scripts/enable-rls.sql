-- Straits — Enable Row-Level Security on every table in `public`
-- =============================================================================
-- Run this ONCE against an already-deployed database that was created before
-- the RLS block was added to the schema files:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/enable-rls.sql
--
-- or paste it into the Supabase SQL editor. It is idempotent — re-running it is
-- a no-op — and the same block now lives at the end of src/lib/db/schema.sql
-- and scripts/schema-portable.sql, so fresh deploys are covered automatically.
--
-- WHY
-- ---
-- Every query in this app goes through the server-side `pg.Pool` in
-- src/lib/db/index.ts, authenticated with DATABASE_URL as the database owner.
-- Nothing uses PostgREST or supabase-js; no browser ever talks to Postgres.
--
-- A hosted Supabase project, however, always exposes PostgREST on the project
-- URL, and grants the publishable `anon` key's role SELECT/INSERT/UPDATE/DELETE
-- on every table in `public` by default. With RLS off, that makes the entire
-- dataset world-readable AND world-writable to anyone who knows the project
-- URL — the `rls_disabled_in_public` lint.
--
-- THE FIX
-- -------
-- Enable RLS with NO policies. A table with RLS on and zero policies denies
-- every row to every role that is not exempt, so PostgREST returns empty reads
-- and rejects all writes. The owner role the app connects as is exempt (it both
-- owns the tables and, on Supabase, carries BYPASSRLS), so the dashboard, the
-- ingester, and the harvester are completely unaffected.
--
-- FORCE ROW LEVEL SECURITY is deliberately NOT set: forcing RLS on the owner is
-- what would break the app, and it buys nothing here because the app is the
-- owner. If a browser client is ever meant to read a table directly, add an
-- explicit read-only policy for that one table rather than disabling RLS.
-- =============================================================================

-- Enable RLS on every base/partitioned table in `public` that doesn't have it.
-- Driven off the catalog rather than a hardcoded list so tables added later are
-- covered the next time this runs.
DO $$
DECLARE
  t regclass;
BEGIN
  FOR t IN
    SELECT c.oid::regclass
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')     -- ordinary + partitioned tables
       AND NOT c.relrowsecurity        -- skip ones already enabled
     ORDER BY c.oid::regclass::text
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    RAISE NOTICE 'RLS enabled on %', t;
  END LOOP;
END $$;

-- Defense in depth: drop the table-level grants Supabase hands the PostgREST
-- roles. RLS alone already denies every row, but revoking means a policy added
-- by accident later can't silently re-open the data. Guarded on role existence
-- so this file still runs on a plain local Postgres, where these roles don't
-- exist. To undo for a single table:
--   GRANT SELECT ON <table> TO anon;   -- plus a policy, or RLS still denies it
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      RAISE NOTICE 'Revoked public-schema grants from %', r;
    END IF;
  END LOOP;
END $$;

-- Verify: fail loudly rather than reporting success on a partial apply.
DO $$
DECLARE
  unprotected text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO unprotected
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p')
     AND NOT c.relrowsecurity;

  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION 'RLS still disabled on: %', unprotected;
  END IF;

  RAISE NOTICE 'Verified: RLS is enabled on every table in public.';
END $$;
