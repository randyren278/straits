/**
 * Watchlist CRUD Tests
 *
 * Tests for watchlist database operations with mocked pool.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock query function
const mockQuery = vi.fn();

// Create mock pool class
class MockPool {
  query = mockQuery;
  constructor(public config: Record<string, unknown>) {}
}

// Mock pg module
vi.mock('pg', () => ({
  Pool: MockPool,
}));

describe('addToWatchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('adds new vessel to watchlist', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { addToWatchlist } = await import('./watchlist');
    await addToWatchlist('user-123', '1234567', 'Test notes');

    expect(mockQuery).toHaveBeenCalled();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO watchlist');
    expect(params).toEqual(['user-123', '1234567', 'Test notes']);
  });

  it('updates notes on conflict (upsert)', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { addToWatchlist } = await import('./watchlist');
    await addToWatchlist('user-123', '1234567', 'Updated notes');

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('DO UPDATE SET notes = EXCLUDED.notes');
  });

  it('allows null notes', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { addToWatchlist } = await import('./watchlist');
    await addToWatchlist('user-123', '1234567');

    const [, params] = mockQuery.mock.calls[0];
    expect(params[2]).toBeNull();
  });
});

describe('removeFromWatchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('removes vessel from watchlist', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const { removeFromWatchlist } = await import('./watchlist');
    await removeFromWatchlist('user-123', '1234567');

    expect(mockQuery).toHaveBeenCalled();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('DELETE FROM watchlist');
    expect(sql).toContain('user_id = $1');
    expect(sql).toContain('imo = $2');
    expect(params).toEqual(['user-123', '1234567']);
  });

  it('is idempotent - does not error if not on watchlist', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const { removeFromWatchlist } = await import('./watchlist');

    // Should not throw
    await expect(removeFromWatchlist('user-123', '9999999')).resolves.toBeUndefined();
  });

  it('only removes for specified user', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { removeFromWatchlist } = await import('./watchlist');
    await removeFromWatchlist('user-123', '1234567');

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('user_id = $1');
  });
});

describe('getUserWatchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns all vessels on user watchlist', async () => {
    const mockRows = [
      { user_id: 'user-123', imo: '1234567', added_at: new Date(), notes: 'Note 1' },
      { user_id: 'user-123', imo: '7654321', added_at: new Date(), notes: null },
    ];
    mockQuery.mockResolvedValue({ rows: mockRows });

    const { getUserWatchlist } = await import('./watchlist');
    const result = await getUserWatchlist('user-123');

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('userId', 'user-123');
    expect(result[0]).toHaveProperty('imo', '1234567');
    expect(result[0]).toHaveProperty('addedAt');
    expect(result[0]).toHaveProperty('notes', 'Note 1');
  });

  it('returns entries ordered by added_at DESC', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getUserWatchlist } = await import('./watchlist');
    await getUserWatchlist('user-123');

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('ORDER BY added_at DESC');
  });

  it('returns empty array when watchlist empty', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getUserWatchlist } = await import('./watchlist');
    const result = await getUserWatchlist('user-123');

    expect(result).toEqual([]);
  });

  it('only returns entries for specified user', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getUserWatchlist } = await import('./watchlist');
    await getUserWatchlist('user-123');

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('WHERE user_id = $1');
    expect(params[0]).toBe('user-123');
  });
});

describe('isOnWatchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns true when vessel is on watchlist', async () => {
    mockQuery.mockResolvedValue({ rows: [{ exists: true }] });

    const { isOnWatchlist } = await import('./watchlist');
    const result = await isOnWatchlist('user-123', '1234567');

    expect(result).toBe(true);
  });

  it('returns false when vessel not on watchlist', async () => {
    mockQuery.mockResolvedValue({ rows: [{ exists: false }] });

    const { isOnWatchlist } = await import('./watchlist');
    const result = await isOnWatchlist('user-123', '9999999');

    expect(result).toBe(false);
  });

  it('checks user-specific watchlist', async () => {
    mockQuery.mockResolvedValue({ rows: [{ exists: false }] });

    const { isOnWatchlist } = await import('./watchlist');
    await isOnWatchlist('user-123', '1234567');

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('user_id = $1');
    expect(sql).toContain('imo = $2');
    expect(params).toEqual(['user-123', '1234567']);
  });
});

describe('getWatchersForVessel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns all user IDs watching vessel', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ user_id: 'user-123' }, { user_id: 'user-456' }],
    });

    const { getWatchersForVessel } = await import('./watchlist');
    const result = await getWatchersForVessel('1234567');

    expect(result).toEqual(['user-123', 'user-456']);
  });

  it('returns empty array when no watchers', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getWatchersForVessel } = await import('./watchlist');
    const result = await getWatchersForVessel('9999999');

    expect(result).toEqual([]);
  });
});

describe('getWatchlistWithVessels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns watchlist entries with vessel details', async () => {
    const mockRows = [{
      user_id: 'user-123',
      imo: '1234567',
      added_at: new Date('2026-01-01'),
      notes: 'Test vessel',
      name: 'Atlantic Spirit',
      flag: 'PA',
      ship_type: 80,
    }];
    mockQuery.mockResolvedValue({ rows: mockRows });

    const { getWatchlistWithVessels } = await import('./watchlist');
    const result = await getWatchlistWithVessels('user-123');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      userId: 'user-123',
      imo: '1234567',
      addedAt: new Date('2026-01-01'),
      notes: 'Test vessel',
      vesselName: 'Atlantic Spirit',
      flag: 'PA',
      shipType: 80,
    });
  });

  it('joins with vessels table', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getWatchlistWithVessels } = await import('./watchlist');
    await getWatchlistWithVessels('user-123');

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('LEFT JOIN vessels v ON v.imo = w.imo');
  });

  it('returns null for vessel fields when vessel not found', async () => {
    const mockRows = [{
      user_id: 'user-123',
      imo: '1234567',
      added_at: new Date(),
      notes: null,
      name: null,
      flag: null,
      ship_type: null,
    }];
    mockQuery.mockResolvedValue({ rows: mockRows });

    const { getWatchlistWithVessels } = await import('./watchlist');
    const result = await getWatchlistWithVessels('user-123');

    expect(result[0].vesselName).toBeNull();
    expect(result[0].flag).toBeNull();
    expect(result[0].shipType).toBeNull();
  });
});
