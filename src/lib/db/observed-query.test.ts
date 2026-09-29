import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  connect: vi.fn(), query: vi.fn(), release: vi.fn(),
}));
vi.mock('./index', () => ({ pool: {
  connect: database.connect, totalCount: 2, idleCount: 0, waitingCount: 1,
} }));

import { observedQuery } from './observed-query';

beforeEach(() => {
  database.connect.mockReset().mockResolvedValue({ query: database.query, release: database.release });
  database.query.mockReset().mockResolvedValue({ rows: [{ value: 1 }], rowCount: 1 });
  database.release.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('observedQuery', () => {
  it('records sampled acquisition and query time without SQL or parameters', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = await observedQuery('current-vessels', 'SELECT $1 AS value', ['secret']);
    expect(result.rows).toEqual([{ value: 1 }]);
    expect(database.release).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(String(log.mock.calls[0][0]));
    expect(entry).toMatchObject({ event: 'db-read-timing', operation: 'current-vessels', rows: 1, waiting: 1 });
    expect(entry).toHaveProperty('waitMs');
    expect(entry).toHaveProperty('queryMs');
    expect(JSON.stringify(entry)).not.toContain('secret');
  });

  it('logs pool acquisition failure with the operation', async () => {
    database.connect.mockRejectedValueOnce(new Error('unavailable'));
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    await expect(observedQuery('current-vessels', 'SELECT 1')).rejects.toThrow('unavailable');
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({ event: 'db-pool-acquire-failed', operation: 'current-vessels' });
  });

  it('releases the checked-out client after query failure', async () => {
    database.query.mockRejectedValueOnce(new Error('query failed'));
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    await expect(observedQuery('current-vessels', 'SELECT 1')).rejects.toThrow('query failed');
    expect(database.release).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({ event: 'db-read-failed', operation: 'current-vessels' });
  });
});
