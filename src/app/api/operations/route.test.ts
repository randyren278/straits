import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/pipeline-runs', () => ({ getLatestPipelineRuns: vi.fn() }));
vi.mock('@/lib/db/operations', () => ({ getRiskScoreFreshness: vi.fn() }));

import { getLatestPipelineRuns } from '@/lib/db/pipeline-runs';
import { getRiskScoreFreshness } from '@/lib/db/operations';
import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/operations', () => {
  it('returns a sanitized healthy operational snapshot', async () => {
    vi.mocked(getLatestPipelineRuns).mockResolvedValue([
      {
        id: '1',
        jobName: 'refresh:prices',
        status: 'success',
        workerId: 'secret-worker-host',
        startedAt: '2026-08-21T00:00:00.000Z',
        finishedAt: '2026-08-21T00:00:01.000Z',
        durationMs: 1000,
        error: null,
      },
    ]);
    vi.mocked(getRiskScoreFreshness).mockResolvedValue({
      totalScores: 10,
      staleScores: 0,
      latestComputedAt: '2026-08-21T00:00:00.000Z',
      oldestComputedAt: '2026-08-20T23:45:00.000Z',
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.status).toBe('ok');
    expect(body.pipelineRuns[0].workerId).toBeUndefined();
    expect(body.pipelineRuns[0].error).toBeUndefined();
  });

  it('marks failed jobs or stale risk materialization as degraded', async () => {
    vi.mocked(getLatestPipelineRuns).mockResolvedValue([
      {
        id: '2',
        jobName: 'detect:route-anomalies',
        status: 'failed',
        workerId: 'worker',
        startedAt: '2026-08-21T00:00:00.000Z',
        finishedAt: '2026-08-21T00:00:01.000Z',
        durationMs: 1000,
        error: 'database password should never leave this route',
      },
    ]);
    vi.mocked(getRiskScoreFreshness).mockResolvedValue({
      totalScores: 10,
      staleScores: 3,
      latestComputedAt: '2026-08-21T00:00:00.000Z',
      oldestComputedAt: '2026-08-20T20:00:00.000Z',
    });

    const response = await GET();
    const body = await response.json();
    expect(body.status).toBe('degraded');
    expect(JSON.stringify(body)).not.toContain('database password');
  });

  it('returns 503 without leaking query errors', async () => {
    vi.mocked(getLatestPipelineRuns).mockRejectedValue(new Error('postgres://secret'));
    vi.mocked(getRiskScoreFreshness).mockResolvedValue({
      totalScores: 0,
      staleScores: 0,
      latestComputedAt: null,
      oldestComputedAt: null,
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain('postgres://secret');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
