import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./index', () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

import { pool } from './index';
import {
  _resetPipelineSchemaForTesting,
  getLatestPipelineRuns,
  runExclusiveJob,
} from './pipeline-runs';

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  _resetPipelineSchemaForTesting();
  vi.mocked(pool.connect).mockResolvedValue(mockClient as never);
});

describe('runExclusiveJob', () => {
  it('records a successful run and releases the advisory lock', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // schema
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [{ id: '42' }] })
      .mockResolvedValueOnce({ rows: [] }) // success update
      .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] });

    const task = vi.fn().mockResolvedValue('done');
    const result = await runExclusiveJob('refresh:prices', task, { source: 'cron' });

    expect(result).toEqual({ executed: true, value: 'done' });
    expect(task).toHaveBeenCalledTimes(1);
    expect(mockClient.query.mock.calls.some(([sql]) => String(sql).includes("status = 'success'"))).toBe(true);
    expect(mockClient.query.mock.calls.some(([sql]) => String(sql).includes('pg_advisory_unlock'))).toBe(true);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('skips execution when another worker owns the lock', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ locked: false }] })
      .mockResolvedValueOnce({ rows: [] });

    const task = vi.fn();
    const result = await runExclusiveJob('detect:route-anomalies', task);

    expect(result).toEqual({ executed: false });
    expect(task).not.toHaveBeenCalled();
    expect(mockClient.query.mock.calls.some(([sql]) => String(sql).includes("'skipped'"))).toBe(true);
    expect(mockClient.query.mock.calls.some(([sql]) => String(sql).includes('pg_advisory_unlock'))).toBe(false);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('records failures, unlocks, releases, and rethrows', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [{ id: '99' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] });

    await expect(
      runExclusiveJob('refresh:news', async () => {
        throw new Error('upstream unavailable');
      })
    ).rejects.toThrow('upstream unavailable');

    const failureCall = mockClient.query.mock.calls.find(([sql]) =>
      String(sql).includes("status = 'failed'")
    );
    expect(failureCall?.[1]).toContain('Error: upstream unavailable');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});

describe('getLatestPipelineRuns', () => {
  it('maps the latest persisted run per job', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [
        {
          id: '7',
          job_name: 'refresh:sanctions',
          status: 'success',
          worker_id: 'worker-a',
          started_at: new Date('2026-08-21T00:00:00Z'),
          finished_at: new Date('2026-08-21T00:00:03Z'),
          duration_ms: 3000,
          error: null,
        },
      ],
    } as never);

    const result = await getLatestPipelineRuns();
    expect(result).toEqual([
      {
        id: '7',
        jobName: 'refresh:sanctions',
        status: 'success',
        workerId: 'worker-a',
        startedAt: '2026-08-21T00:00:00.000Z',
        finishedAt: '2026-08-21T00:00:03.000Z',
        durationMs: 3000,
        error: null,
      },
    ]);
  });
});
