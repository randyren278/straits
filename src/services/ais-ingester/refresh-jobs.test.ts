/**
 * Refresh Jobs Tests
 *
 * Unit tests for background refresh cron jobs (prices, news, sanctions).
 * Cross-worker locking and snapshot validation are tested in their own modules;
 * these tests verify the scheduler composes them correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node-cron', () => ({
  default: { schedule: vi.fn() },
}));

vi.mock('../../lib/prices/fetcher', () => ({
  fetchOilPrices: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../lib/db/prices', () => ({
  insertPrice: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/news/fetcher', () => ({
  fetchNews: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../lib/db/news', () => ({
  insertNewsItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/external/opensanctions', () => ({
  fetchSanctionsList: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../lib/db/sanctions', () => ({
  batchUpsertSanctions: vi.fn().mockResolvedValue({ upserted: 0, deleted: 0 }),
  migrateSanctionsSchema: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/sanctions/snapshot-guard', () => ({
  validateSanctionsSnapshot: vi.fn().mockResolvedValue({
    incomingUnique: 1,
    currentCount: 1,
    retainRatio: 1,
  }),
}));

vi.mock('../../lib/db/pipeline-runs', () => ({
  runExclusiveJob: vi.fn(async (_name: string, task: () => Promise<unknown>) => ({
    executed: true,
    value: await task(),
  })),
}));

import cron from 'node-cron';
import { startRefreshJobs, _resetStartedForTesting } from './refresh-jobs';
import { fetchOilPrices } from '../../lib/prices/fetcher';
import { fetchNews } from '../../lib/news/fetcher';
import { fetchSanctionsList } from '../../lib/external/opensanctions';
import { runExclusiveJob } from '../../lib/db/pipeline-runs';
import { validateSanctionsSnapshot } from '../../lib/sanctions/snapshot-guard';

describe('startRefreshJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetStartedForTesting();
  });

  it('does not throw when called', () => {
    expect(() => startRefreshJobs()).not.toThrow();
  });

  it('registers each cron schedule only once per process', () => {
    startRefreshJobs();
    startRefreshJobs();
    expect(cron.schedule).toHaveBeenCalledTimes(3);
  });

  it('runs eager source refreshes through distributed job ownership', async () => {
    startRefreshJobs();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchOilPrices).toHaveBeenCalled();
    expect(fetchNews).toHaveBeenCalled();
    expect(fetchSanctionsList).toHaveBeenCalled();
    expect(runExclusiveJob).toHaveBeenCalledWith('refresh:prices', expect.any(Function), { source: 'startup' });
    expect(runExclusiveJob).toHaveBeenCalledWith('refresh:news', expect.any(Function), { source: 'startup' });
    expect(runExclusiveJob).toHaveBeenCalledWith('refresh:sanctions', expect.any(Function), { source: 'startup' });
  });

  it('validates sanctions coverage before reconciliation', async () => {
    startRefreshJobs();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(validateSanctionsSnapshot).toHaveBeenCalled();
  });

  it.todo('prices cron runs fetchOilPrices and insertPrice for each result');
  it.todo('news cron runs fetchNews and insertNewsItem for each result');
  it.todo('sanctions cron runs fetchSanctionsList and batchUpsertSanctions for each result');
});
