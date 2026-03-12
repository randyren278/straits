/**
 * Database connection pool for TimescaleDB/PostgreSQL.
 * Uses connection pooling with configurable limits.
 */
import { Pool, QueryResult } from 'pg';

/**
 * Connection pool configured for production use.
 * - max: 20 connections (sufficient for typical workload)
 * - idleTimeoutMillis: 30s (release idle connections)
 * - connectionTimeoutMillis: 2s (fail fast on connection issues)
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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
export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const result: QueryResult<T> = await pool.query(sql, params);
  return result.rows;
}
