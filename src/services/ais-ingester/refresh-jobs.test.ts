/**
 * Refresh Jobs Tests
 *
 * Unit tests for background refresh cron jobs (prices, news, sanctions).
 * Verifies startRefreshJobs() does not throw and calls fetchers on startup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-cron before importing the module under test
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
  },
}));

// Mock all fetchers and DB writers with relative paths matching refresh-jobs.ts
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

import { startRefreshJobs } from './refresh-jobs';
import { fetchOilPrices } from '../../lib/prices/fetcher';
import { fetchNews } from '../../lib/news/fetcher';
import { fetchSanctionsList } from '../../lib/external/opensanctions';

describe('startRefreshJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not throw when called', () => {
    expect(() => startRefreshJobs()).not.toThrow();
  });

  it('calls fetchOilPrices during eager startup fetch', async () => {
    startRefreshJobs();
    // Allow promises from eager fetch to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchOilPrices).toHaveBeenCalled();
  });

  it('calls fetchNews during eager startup fetch', async () => {
    startRefreshJobs();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchNews).toHaveBeenCalled();
  });

  it('calls fetchSanctionsList during eager startup fetch', async () => {
    startRefreshJobs();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchSanctionsList).toHaveBeenCalled();
  });

  it.todo('prices cron runs fetchOilPrices and insertPrice for each result');
  it.todo('news cron runs fetchNews and insertNewsItem for each result');
  it.todo('sanctions cron runs fetchSanctionsList and upsertSanction for each result');
});
