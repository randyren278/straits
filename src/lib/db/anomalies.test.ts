/**
 * Anomaly CRUD Tests
 *
 * Tests for anomaly database operations with mocked pool.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database pool
vi.mock('./index', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from './index';
import {
  upsertAnomaly,
  getActiveAnomalies,
  resolveAnomaly,
  getAnomaliesForVessels,
} from './anomalies';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

describe('upsertAnomaly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts new anomaly when none exists for vessel/type', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await upsertAnomaly({
      imo: '1234567',
      anomalyType: 'going_dark',
      confidence: 'suspected',
      detectedAt: new Date('2026-03-12T00:00:00Z'),
      details: { gapMinutes: 150, lastPosition: { lat: 26.0, lon: 51.0 }, coverageZone: 'persian_gulf' },
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO vessel_anomalies');
    expect(sql).toContain('ON CONFLICT');
    expect(params[0]).toBe('1234567');
    expect(params[1]).toBe('going_dark');
  });

  it('updates existing active anomaly with new details', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await upsertAnomaly({
      imo: '1234567',
      anomalyType: 'going_dark',
      confidence: 'confirmed', // Upgraded confidence
      detectedAt: new Date(),
      details: { gapMinutes: 300, lastPosition: { lat: 26.0, lon: 51.0 }, coverageZone: 'persian_gulf' },
    });

    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('DO UPDATE SET');
    expect(sql).toContain('confidence = EXCLUDED.confidence');
  });

  it('stores JSONB details correctly', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const details = { gapMinutes: 200, lastPosition: { lat: 26.0, lon: 51.0 }, coverageZone: 'persian_gulf' };
    await upsertAnomaly({
      imo: '1234567',
      anomalyType: 'going_dark',
      confidence: 'suspected',
      detectedAt: new Date(),
      details,
    });

    const params = mockQuery.mock.calls[0][1];
    expect(params[4]).toBe(JSON.stringify(details));
  });

  it('does not update resolved anomalies (via ON CONFLICT WHERE)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await upsertAnomaly({
      imo: '1234567',
      anomalyType: 'going_dark',
      confidence: 'suspected',
      detectedAt: new Date(),
      details: { gapMinutes: 150, lastPosition: { lat: 26.0, lon: 51.0 }, coverageZone: 'persian_gulf' },
    });

    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('resolved_at IS NULL');
  });
});

describe('getActiveAnomalies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all active anomalies when no imo filter', async () => {
    const mockRows = [
      { id: 1, imo: '1111111', anomaly_type: 'going_dark', confidence: 'suspected', detected_at: new Date(), resolved_at: null, details: {} },
      { id: 2, imo: '2222222', anomaly_type: 'loitering', confidence: 'confirmed', detected_at: new Date(), resolved_at: null, details: {} },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockRows });

    const result = await getActiveAnomalies();

    expect(result).toHaveLength(2);
    expect(result[0].anomalyType).toBe('going_dark');
    expect(result[1].anomalyType).toBe('loitering');
  });

  it('returns only anomalies for specified imo', async () => {
    const mockRows = [
      { id: 1, imo: '1111111', anomaly_type: 'going_dark', confidence: 'suspected', detected_at: new Date(), resolved_at: null, details: {} },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockRows });

    const result = await getActiveAnomalies('1111111');

    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('imo = $1'), ['1111111']);
    expect(result).toHaveLength(1);
  });

  it('excludes resolved anomalies (query filters by resolved_at IS NULL)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await getActiveAnomalies();

    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('resolved_at IS NULL');
  });

  it('orders by detected_at DESC', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await getActiveAnomalies();

    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('ORDER BY detected_at DESC');
  });

  it('returns empty array when no active anomalies', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getActiveAnomalies();

    expect(result).toEqual([]);
  });
});

describe('resolveAnomaly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets resolved_at to current timestamp', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await resolveAnomaly('1234567', 'going_dark');

    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('resolved_at = NOW()');
  });

  it('only resolves matching imo and anomaly_type', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await resolveAnomaly('1234567', 'going_dark');

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('imo = $1');
    expect(sql).toContain('anomaly_type = $2');
    expect(params).toEqual(['1234567', 'going_dark']);
  });

  it('is idempotent - filters by resolved_at IS NULL', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await resolveAnomaly('1234567', 'going_dark');

    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('resolved_at IS NULL');
  });

  it('does not resolve other anomaly types for same vessel', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await resolveAnomaly('1234567', 'going_dark');

    const params = mockQuery.mock.calls[0][1];
    expect(params[1]).toBe('going_dark');
    // Only this specific type should be resolved
  });
});

describe('getAnomaliesForVessels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns anomalies for multiple imos', async () => {
    const mockRows = [
      { id: 1, imo: '1111111', anomaly_type: 'going_dark', confidence: 'suspected', detected_at: new Date(), resolved_at: null, details: {} },
      { id: 2, imo: '2222222', anomaly_type: 'loitering', confidence: 'confirmed', detected_at: new Date(), resolved_at: null, details: {} },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockRows });

    const result = await getAnomaliesForVessels(['1111111', '2222222']);

    expect(result).toHaveLength(2);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('IN ($1, $2)');
  });

  it('returns empty array for empty imos input', async () => {
    const result = await getAnomaliesForVessels([]);

    expect(result).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('excludes resolved anomalies', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await getAnomaliesForVessels(['1111111']);

    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('resolved_at IS NULL');
  });

  it('handles imos with no anomalies', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getAnomaliesForVessels(['9999999']);

    expect(result).toEqual([]);
  });
});
