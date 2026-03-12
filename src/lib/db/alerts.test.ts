/**
 * Alert CRUD Tests
 *
 * Tests for alert database operations with mocked pool.
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

describe('createAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('inserts new alert record', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { createAlert } = await import('./alerts');
    await createAlert('user-123', '1234567', 'going_dark', { location: 'Persian Gulf' });

    expect(mockQuery).toHaveBeenCalled();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO alerts');
    expect(params[0]).toBe('user-123');
    expect(params[1]).toBe('1234567');
    expect(params[2]).toBe('going_dark');
  });

  it('stores JSONB details correctly', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { createAlert } = await import('./alerts');
    const details = { gapMinutes: 120, coverageZone: 'Persian Gulf' };
    await createAlert('user-123', '1234567', 'going_dark', details);

    const [, params] = mockQuery.mock.calls[0];
    expect(params[3]).toBe(JSON.stringify(details));
  });

  it('leaves read_at as NULL (implicit via INSERT)', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { createAlert } = await import('./alerts');
    await createAlert('user-123', '1234567', 'going_dark', {});

    const [sql] = mockQuery.mock.calls[0];
    // Should not include read_at in INSERT columns
    expect(sql).not.toContain('read_at');
  });
});

describe('getUnreadAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns only unread alerts', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getUnreadAlerts } = await import('./alerts');
    await getUnreadAlerts('user-123');

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('read_at IS NULL');
  });

  it('orders by triggered_at DESC', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getUnreadAlerts } = await import('./alerts');
    await getUnreadAlerts('user-123');

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('ORDER BY triggered_at DESC');
  });

  it('returns empty array when no unread alerts', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getUnreadAlerts } = await import('./alerts');
    const result = await getUnreadAlerts('user-123');

    expect(result).toEqual([]);
  });

  it('only returns alerts for specified user', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getUnreadAlerts } = await import('./alerts');
    await getUnreadAlerts('user-123');

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('user_id = $1');
    expect(params[0]).toBe('user-123');
  });

  it('maps database columns to camelCase', async () => {
    const mockRows = [{
      id: 1,
      user_id: 'user-123',
      imo: '1234567',
      alert_type: 'going_dark',
      triggered_at: new Date('2026-01-01'),
      read_at: null,
      details: { gapMinutes: 120 },
    }];
    mockQuery.mockResolvedValue({ rows: mockRows });

    const { getUnreadAlerts } = await import('./alerts');
    const result = await getUnreadAlerts('user-123');

    expect(result[0]).toEqual({
      id: 1,
      userId: 'user-123',
      imo: '1234567',
      alertType: 'going_dark',
      triggeredAt: new Date('2026-01-01'),
      readAt: null,
      details: { gapMinutes: 120 },
    });
  });
});

describe('getAllAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns both read and unread alerts', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getAllAlerts } = await import('./alerts');
    await getAllAlerts('user-123');

    const [sql] = mockQuery.mock.calls[0];
    // Should NOT filter by read_at IS NULL
    expect(sql).not.toContain('read_at IS NULL');
    expect(sql).toContain('WHERE user_id = $1');
  });

  it('respects limit parameter', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getAllAlerts } = await import('./alerts');
    await getAllAlerts('user-123', 25);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('LIMIT $2');
    expect(params[1]).toBe(25);
  });

  it('uses default limit of 50', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getAllAlerts } = await import('./alerts');
    await getAllAlerts('user-123');

    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBe(50);
  });

  it('orders by triggered_at DESC', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getAllAlerts } = await import('./alerts');
    await getAllAlerts('user-123');

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('ORDER BY triggered_at DESC');
  });
});

describe('markAlertAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('sets read_at to current timestamp', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const { markAlertAsRead } = await import('./alerts');
    await markAlertAsRead(123);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('UPDATE alerts');
    expect(sql).toContain('SET read_at = NOW()');
  });

  it('is idempotent - can mark already read alert', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const { markAlertAsRead } = await import('./alerts');

    // Should not throw even if already marked
    await expect(markAlertAsRead(123)).resolves.toBeUndefined();
  });

  it('only updates specified alert ID', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const { markAlertAsRead } = await import('./alerts');
    await markAlertAsRead(456);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('WHERE id = $1');
    expect(params[0]).toBe(456);
  });
});

describe('generateAlertsForAnomaly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('creates alerts for all users watching vessel', async () => {
    // First call: getWatchersForVessel
    mockQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'user-123' }, { user_id: 'user-456' }],
    });
    // Second call: INSERT alerts
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { generateAlertsForAnomaly } = await import('./alerts');
    await generateAlertsForAnomaly('1234567', 'going_dark', { gapMinutes: 120 });

    expect(mockQuery).toHaveBeenCalledTimes(2);
    const [insertSql] = mockQuery.mock.calls[1];
    expect(insertSql).toContain('INSERT INTO alerts');
  });

  it('creates no alerts when no watchers', async () => {
    // First call: getWatchersForVessel returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { generateAlertsForAnomaly } = await import('./alerts');
    await generateAlertsForAnomaly('9999999', 'going_dark', {});

    // Should only call getWatchersForVessel, no INSERT
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('includes anomaly details in alert', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-123' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { generateAlertsForAnomaly } = await import('./alerts');
    const details = { gapMinutes: 180, coverageZone: 'Red Sea' };
    await generateAlertsForAnomaly('1234567', 'going_dark', details);

    const [, insertParams] = mockQuery.mock.calls[1];
    expect(insertParams).toContain(JSON.stringify(details));
  });

  it('handles multiple watchers efficiently (batch insert)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'user-1' }, { user_id: 'user-2' }, { user_id: 'user-3' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { generateAlertsForAnomaly } = await import('./alerts');
    await generateAlertsForAnomaly('1234567', 'loitering', {});

    // Should be a single INSERT with multiple VALUES
    const [insertSql] = mockQuery.mock.calls[1];
    expect(insertSql).toContain('INSERT INTO alerts');
    // Should have placeholders for all 3 users (4 params each)
    expect(insertSql).toContain('$1');
    expect(insertSql).toContain('$12'); // 3 users x 4 params = 12
  });
});

describe('getAlertsWithVessels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns alerts with vessel details', async () => {
    const mockRows = [{
      id: 1,
      imo: '1234567',
      alert_type: 'going_dark',
      triggered_at: new Date('2026-01-01'),
      read_at: null,
      details: { gapMinutes: 120 },
      name: 'Atlantic Spirit',
      flag: 'PA',
    }];
    mockQuery.mockResolvedValue({ rows: mockRows });

    const { getAlertsWithVessels } = await import('./alerts');
    const result = await getAlertsWithVessels('user-123');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      imo: '1234567',
      alertType: 'going_dark',
      triggeredAt: new Date('2026-01-01'),
      readAt: null,
      details: { gapMinutes: 120 },
      vesselName: 'Atlantic Spirit',
      flag: 'PA',
    });
  });

  it('joins with vessels table', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getAlertsWithVessels } = await import('./alerts');
    await getAlertsWithVessels('user-123');

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('LEFT JOIN vessels v ON v.imo = a.imo');
  });

  it('respects limit parameter', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getAlertsWithVessels } = await import('./alerts');
    await getAlertsWithVessels('user-123', 10);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('LIMIT $2');
    expect(params[1]).toBe(10);
  });

  it('returns null for vessel fields when vessel not found', async () => {
    const mockRows = [{
      id: 1,
      imo: '9999999',
      alert_type: 'going_dark',
      triggered_at: new Date(),
      read_at: null,
      details: {},
      name: null,
      flag: null,
    }];
    mockQuery.mockResolvedValue({ rows: mockRows });

    const { getAlertsWithVessels } = await import('./alerts');
    const result = await getAlertsWithVessels('user-123');

    expect(result[0].vesselName).toBeNull();
    expect(result[0].flag).toBeNull();
  });
});
