import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./index', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from './index';
import {
  _resetPipelineSchemaForTesting,
  getLatestPipelineRuns,
  runExclusiveJob,
} from './pipeline-runs';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  _resetPipelineSchemaForTesting();
});

describe('runExclusiveJob', () => {
  it('records a successful run and releases its lease', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // schema
      .mockImplementationOnce((_sql: string, params: string[]) => Promise.resolve({ rows: [{ owner: params[1] }] }))
      .mockResolvedValueOnce({ rows: [{ id: '42' }] })
      .mockResolvedValueOnce({ rows: [] }) // success update
      .mockResolvedValueOnce({ rows: [] }); // lease release

    const task = vi.fn().mockResolvedValue('done');
    const result = await runExclusiveJob('refresh:prices', task, { source: 'cron' });

    expect(result).toEqual({ executed: true, value: 'done' });
    expect(task).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes("status = 'success'"))).toBe(true);
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes('DELETE FROM job_leases'))).toBe(true);
  });

  it('skips execution when another worker owns the lease', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const task = vi.fn();
    const result = await runExclusiveJob('detect:route-anomalies', task);

    expect(result).toEqual({ executed: false });
    expect(task).not.toHaveBeenCalled();
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes("'skipped'"))).toBe(true);
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes('DELETE FROM job_leases'))).toBe(false);
  });

  it('records failures, releases the lease, and rethrows', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockImplementationOnce((_sql: string, params: string[]) => Promise.resolve({ rows: [{ owner: params[1] }] }))
      .mockResolvedValueOnce({ rows: [{ id: '99' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      runExclusiveJob('refresh:news', async () => {
        throw new Error('upstream unavailable');
      })
    ).rejects.toThrow('upstream unavailable');

    const failureCall = mockQuery.mock.calls.find(([sql]) =>
      String(sql).includes("status = 'failed'")
    );
    expect(failureCall?.[1]).toContain('Error: upstream unavailable');
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes('DELETE FROM job_leases'))).toBe(true);
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
