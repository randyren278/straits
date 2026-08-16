/**
 * Database connection pool for TimescaleDB/PostgreSQL.
 * Uses connection pooling with configurable limits.
 */
import { Pool, QueryResultRow } from 'pg';

/**
 * Connection pool configured for production use.
 * - max: 20 connections (sufficient for typical workload)
 * - idleTimeoutMillis: 30s (release idle connections)
 * - connectionTimeoutMillis: 8s (fail fast on connection issues, but with
 *   real margin — a Supabase pooler connect was measured at 1455ms; the old
 *   2000ms left only ~500ms of slack, so a routine stall surfaced as a hard
 *   failure instead of just being slow)
 *
 * NOT set here: a client-supplied `statement_timeout`. node-postgres sends it
 * as a startup parameter, but empirically (verified 2026-08 against this
 * project's Supabase transaction-pooler connection string, :6543) Supavisor
 * silently drops it — `SHOW statement_timeout` on a pool configured with
 * `statement_timeout: 60000` still reports the project's own default (2min).
 * A bare `SET statement_timeout = …` after connecting is worse, not better:
 * in transaction-pooling mode a session-level SET can bind to whatever
 * backend Supavisor hands the connection and was observed LEAKING into
 * later, unrelated client sessions once the backend was recycled — including
 * (potentially) the deployed app's connections through the same pooler. Do
 * not add either of these without re-verifying against the live pooler.
 * `SET LOCAL` inside an explicit transaction on a client checked out via
 * `pool.connect()` DOES work and does NOT leak (also verified), but requires
 * every call site to hold an exclusive client for a wrapped transaction
 * instead of a bare `pool.query()` — out of scope here. The real bound on
 * how long an abandoned query (see harvest-once.ts `step()`) can hold a
 * pooled connection is therefore Supabase's own project-level
 * `statement_timeout` default (currently 2 minutes, not controlled from this
 * codebase), not a value this file sets.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
});

/**
 * Execute a parameterized SQL query and return typed results.
 * Uses parameterized queries to prevent SQL injection.
 *
 * @param sql - SQL query with $1, $2, etc. placeholders
 * @param params - Array of parameter values
 * @returns Array of typed result rows
 *
 * @example
 * const vessels = await query<Vessel>('SELECT * FROM vessels WHERE imo = $1', ['1234567']);
 */
export async function query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}
