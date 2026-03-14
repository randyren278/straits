import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTrafficByChokepoint, getTrafficByRoute, getPriceHistoryForOverlay } from './analytics';

// Mock the database pool
vi.mock('./index', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from './index';

describe('getTrafficByChokepoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for invalid chokepoint ID', async () => {
    const result = await getTrafficByChokepoint('invalid', '7d');
    expect(result).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('queries with correct time range for 7 days', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

    await getTrafficByChokepoint('hormuz', '7d');

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('time_bucket'),
      expect.arrayContaining(['7 days'])
    );
  });

  it('queries with correct time range for 30 days', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

    await getTrafficByChokepoint('hormuz', '30d');

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('time_bucket'),
      expect.arrayContaining(['30 days'])
    );
  });

  it('maps query results to DailyTrafficPoint format', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [
        { bucket_day: new Date('2026-03-01'), vessel_count: '10', tanker_count: '5' },
        { bucket_day: new Date('2026-03-02'), vessel_count: '15', tanker_count: '8' },
      ],
    });

    const result = await getTrafficByChokepoint('hormuz', '7d');

    expect(result).toEqual([
      { date: '2026-03-01', vesselCount: 10, tankerCount: 5 },
      { date: '2026-03-02', vesselCount: 15, tankerCount: 8 },
    ]);
  });

  it('uses chokepoint bounds in query', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

    await getTrafficByChokepoint('hormuz', '7d');

    // Hormuz bounds: minLat: 23.5, maxLat: 27.0, minLon: 55.5, maxLon: 57.5
    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([23.5, 27.0, 55.5, 57.5])
    );
  });
});

describe('getTrafficByRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries with correct time range', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

    await getTrafficByRoute('30d');

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('time_bucket'),
      expect.arrayContaining(['30 days'])
    );
  });

  it('aggregates by route classification', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [
        { bucket_day: new Date('2026-03-01'), destination: 'CHINA', vessel_count: '5', tanker_count: '3' },
        { bucket_day: new Date('2026-03-01'), destination: 'JAPAN', vessel_count: '3', tanker_count: '2' },
      ],
    });

    const result = await getTrafficByRoute('7d');

    // Both CHINA and JAPAN should aggregate to east_asia
    expect(result).toContainEqual({
      date: '2026-03-01',
      route: 'east_asia',
      vesselCount: 8,
      tankerCount: 5,
    });
  });

  it('handles null destinations as unknown route', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [
        { bucket_day: new Date('2026-03-01'), destination: null, vessel_count: '2', tanker_count: '1' },
      ],
    });

    const result = await getTrafficByRoute('7d');

    expect(result).toContainEqual({
      date: '2026-03-01',
      route: 'unknown',
      vesselCount: 2,
      tankerCount: 1,
    });
  });
});

describe('getPriceHistoryForOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries for WTI prices with correct range', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

    await getPriceHistoryForOverlay('WTI', '30d');

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('oil_prices'),
      expect.arrayContaining(['WTI', '30 days'])
    );
  });

  it('maps query results to date/price format', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [
        { date: new Date('2026-03-01'), price: '75.50' },
        { date: new Date('2026-03-02'), price: '76.25' },
      ],
    });

    const result = await getPriceHistoryForOverlay('WTI', '7d');

    expect(result).toEqual([
      { date: '2026-03-01', price: 75.50 },
      { date: '2026-03-02', price: 76.25 },
    ]);
  });
});
