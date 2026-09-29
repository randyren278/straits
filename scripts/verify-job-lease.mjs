/** Local integration check that two concurrent workers cannot own one job. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/lib/db/index.ts';
import { runExclusiveJob } from '../src/lib/db/pipeline-runs.ts';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost');
if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
  throw new Error('Refusing lease fixture on a non-local database');
}
const job = `verify:lease:${randomUUID()}`;
let began;
const started = new Promise((resolve) => { began = resolve; });
let release;
const hold = new Promise((resolve) => { release = resolve; });
let first;

try {
  first = runExclusiveJob(job, async () => { began(); await hold; return 'first'; });
  await started;
  const second = await runExclusiveJob(job, async () => 'wrong');
  assert.deepEqual(second, { executed: false });
  release();
  assert.deepEqual(await first, { executed: true, value: 'first' });
  const third = await runExclusiveJob(job, async () => 'third');
  assert.deepEqual(third, { executed: true, value: 'third' });
  await pool.query(`INSERT INTO job_leases(job_name, owner, expires_at)
    VALUES ($1, 'crashed-worker', NOW() - INTERVAL '1 minute')`, [job]);
  const recovered = await runExclusiveJob(job, async () => 'recovered');
  assert.deepEqual(recovered, { executed: true, value: 'recovered' });
  console.log('PASS job lease: concurrent skip, release, reacquire, expired-owner recovery');
} finally {
  release();
  await first?.catch(() => {});
  await pool.query('DELETE FROM pipeline_runs WHERE job_name=$1', [job]);
  await pool.query('DELETE FROM job_leases WHERE job_name=$1', [job]);
  await pool.end();
}
