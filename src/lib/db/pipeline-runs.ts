import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { pool } from './index';

export type PipelineRunStatus = 'running' | 'success' | 'failed' | 'skipped';

export interface PipelineRunSummary {
  id: string;
  jobName: string;
  status: PipelineRunStatus;
  workerId: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

export interface ExclusiveJobResult<T> {
  executed: boolean;
  value?: T;
}

/**
 * Runtime-safe migration for the worker coordination table.
 *
 * The same DDL also lives in scripts/migrations so clean environments can be
 * provisioned ahead of time. Keeping this guard here lets an already-deployed
 * database adopt distributed job ownership without a flag day.
 */
export const PIPELINE_RUNS_SCHEMA_SQL = `
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
`;

let schemaReady = false;

function lockKey(jobName: string): string {
  // pg_advisory_lock accepts a signed 64-bit integer. Hashing the namespaced job
  // name gives stable keys across hosts without maintaining a central registry.
  return createHash('sha256')
    .update(`straits:pipeline:${jobName}`)
    .digest()
    .readBigInt64BE(0)
    .toString();
}

function workerId(): string {
  return process.env.WORKER_ID || `${hostname()}:${process.pid}`;
}

function safeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, 1000);
  }
  return String(error).slice(0, 1000);
}

async function ensureSchema(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }) {
  if (schemaReady) return;
  await client.query(PIPELINE_RUNS_SCHEMA_SQL);
  schemaReady = true;
}

/**
 * Execute a scheduled job only if this worker wins a PostgreSQL advisory lock.
 *
 * The lock is session-scoped and held on one dedicated pool client for the
 * entire job. That means multiple ingester replicas can all register the same
 * cron schedule while exactly one performs each invocation. Every attempted
 * execution is persisted for operational diagnostics.
 */
export async function runExclusiveJob<T>(
  jobName: string,
  task: () => Promise<T>,
  metadata: Record<string, unknown> = {}
): Promise<ExclusiveJobResult<T>> {
  const client = await pool.connect();
  const key = lockKey(jobName);
  const worker = workerId();
  let locked = false;
  let runId: string | null = null;
  let startedAtMs = Date.now();

  try {
    await ensureSchema(client);

    const lockResult = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1::bigint) AS locked',
      [key]
    );
    locked = Boolean(lockResult.rows[0]?.locked);

    if (!locked) {
      await client.query(
        `INSERT INTO pipeline_runs
          (job_name, status, worker_id, finished_at, duration_ms, metadata)
         VALUES ($1, 'skipped', $2, NOW(), 0, $3::jsonb)`,
        [jobName, worker, JSON.stringify({ ...metadata, reason: 'lock_held' })]
      );
      console.log(`[JOB] ${jobName}: skipped — another worker owns the advisory lock`);
      return { executed: false };
    }

    startedAtMs = Date.now();
    const insertResult = await client.query<{ id: string }>(
      `INSERT INTO pipeline_runs (job_name, status, worker_id, metadata)
       VALUES ($1, 'running', $2, $3::jsonb)
       RETURNING id::text AS id`,
      [jobName, worker, JSON.stringify(metadata)]
    );
    runId = insertResult.rows[0]?.id ?? null;

    try {
      const value = await task();
      const durationMs = Date.now() - startedAtMs;
      if (runId) {
        await client.query(
          `UPDATE pipeline_runs
              SET status = 'success', finished_at = NOW(), duration_ms = $2
            WHERE id = $1::bigint`,
          [runId, durationMs]
        );
      }
      console.log(`[JOB] ${jobName}: success (${durationMs}ms)`);
      return { executed: true, value };
    } catch (error) {
      const durationMs = Date.now() - startedAtMs;
      if (runId) {
        await client.query(
          `UPDATE pipeline_runs
              SET status = 'failed', finished_at = NOW(), duration_ms = $2, error = $3
            WHERE id = $1::bigint`,
          [runId, durationMs, safeError(error)]
        );
      }
      console.error(`[JOB] ${jobName}: failed (${durationMs}ms)`, error);
      throw error;
    }
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1::bigint)', [key]);
      } catch (unlockError) {
        console.error(`[JOB] ${jobName}: failed to release advisory lock`, unlockError);
      }
    }
    client.release();
  }
}

/** Latest execution per job, used by the protected operations endpoint. */
export async function getLatestPipelineRuns(): Promise<PipelineRunSummary[]> {
  const result = await pool.query<{
    id: string;
    job_name: string;
    status: PipelineRunStatus;
    worker_id: string;
    started_at: Date;
    finished_at: Date | null;
    duration_ms: number | null;
    error: string | null;
  }>(
    `SELECT DISTINCT ON (job_name)
       id::text, job_name, status, worker_id, started_at, finished_at, duration_ms, error
     FROM pipeline_runs
     ORDER BY job_name, started_at DESC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    jobName: row.job_name,
    status: row.status,
    workerId: row.worker_id,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
    durationMs: row.duration_ms,
    error: row.error,
  }));
}

/** Reset the one-process migration cache for isolated unit tests. */
export function _resetPipelineSchemaForTesting(): void {
  schemaReady = false;
}
