import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a mock query function
const mockQuery = vi.fn();

// Create a proper mock class for Pool
class MockPool {
  query = mockQuery;
  constructor(public config: Record<string, unknown>) {
    MockPool.lastConfig = config;
    MockPool.instanceCount++;
  }
  static lastConfig: Record<string, unknown> = {};
  static instanceCount = 0;
}

// Mock pg module
vi.mock('pg', () => ({
  Pool: MockPool,
}));

describe('Database Connection Pool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockPool.instanceCount = 0;
    MockPool.lastConfig = {};
  });

  it('exports pool instance', async () => {
    vi.resetModules();
    const { pool } = await import('./index');
    expect(pool).toBeDefined();
    expect(pool.query).toBeDefined();
  });

  it('exports query function', async () => {
    vi.resetModules();
    const { query } = await import('./index');
    expect(query).toBeDefined();
    expect(typeof query).toBe('function');
  });

  it('pool.query executes parameterized SQL', async () => {
    vi.resetModules();
    mockQuery.mockResolvedValue({
      rows: [{ id: 1, name: 'test' }],
    });

    const { query } = await import('./index');
    const result = await query<{ id: number; name: string }>(
      'SELECT * FROM test WHERE id = $1',
      [1]
    );

    expect(result).toEqual([{ id: 1, name: 'test' }]);
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
  });

  it('connection uses DATABASE_URL environment variable', async () => {
    vi.resetModules();
    await import('./index');
    expect(MockPool.lastConfig.connectionString).toBe(process.env.DATABASE_URL);
  });

  it('pool has max 20 connections', async () => {
    vi.resetModules();
    await import('./index');
    expect(MockPool.lastConfig.max).toBe(20);
  });

  it('pool has 30s idle timeout', async () => {
    vi.resetModules();
    await import('./index');
    expect(MockPool.lastConfig.idleTimeoutMillis).toBe(30000);
  });
});
