/** Pool acquisition and query timing for the few hot dashboard reads.
 * Emits a structured line for slow calls and a 1% sample of healthy calls.
 * Never logs SQL text, parameters, credentials, or vessel identities.
 */
import type { QueryResultRow } from 'pg';
import { pool } from './index';

function log(event: string, fields: Record<string, unknown>) {
  console.info(JSON.stringify({ event, ...fields }));
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return error instanceof Error ? error.name : 'unknown';
}

export async function observedQuery<T extends QueryResultRow>(operation: string, sql: string, params?: unknown[]) {
  const acquisitionStarted = performance.now();
  let client;
  try {
    client = await pool.connect();
  } catch (error) {
    log('db-pool-acquire-failed', {
      operation, waitMs: Math.round(performance.now() - acquisitionStarted),
      total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount,
      reason: errorCode(error),
    });
    throw error;
  }
  const waitMs = performance.now() - acquisitionStarted;
  const queryStarted = performance.now();
  try {
    const result = await client.query<T>(sql, params);
    const queryMs = performance.now() - queryStarted;
    if (waitMs >= 100 || queryMs >= 250 || Math.random() < 0.01) {
      log('db-read-timing', {
        operation, waitMs: Math.round(waitMs), queryMs: Math.round(queryMs),
        rows: result.rowCount, total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount,
      });
    }
    return result;
  } catch (error) {
    log('db-read-failed', {
      operation, waitMs: Math.round(waitMs), queryMs: Math.round(performance.now() - queryStarted),
      reason: errorCode(error),
    });
    throw error;
  } finally {
    client.release();
  }
}
