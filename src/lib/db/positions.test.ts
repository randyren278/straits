import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VesselPosition } from '@/types/vessel';

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

describe('Position CRUD Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('insertPosition', () => {
    it('writes VesselPosition to vessel_positions table', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { insertPosition } = await import('./positions');

      const position: VesselPosition = {
        time: new Date('2026-03-11T12:00:00Z'),
        mmsi: '123456789',
        imo: '1234567',
        latitude: 26.5,
        longitude: 56.25,
        speed: 12.5,
        course: 180,
        heading: 175,
        navStatus: 0,
        lowConfidence: false,
      };

      await insertPosition(position);

      expect(mockQuery).toHaveBeenCalled();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO vessel_positions');
      expect(params).toContain(position.time);
      expect(params).toContain(position.mmsi);
      expect(params).toContain(position.imo);
      expect(params).toContain(position.latitude);
      expect(params).toContain(position.longitude);
    });

    it('uses parameterized query (no SQL injection)', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { insertPosition } = await import('./positions');

      const maliciousPosition: VesselPosition = {
        time: new Date(),
        mmsi: "'); DROP TABLE vessels; --",
        imo: null,
        latitude: 26.5,
        longitude: 56.25,
        speed: null,
        course: null,
        heading: null,
        navStatus: null,
        lowConfidence: false,
      };

      await insertPosition(maliciousPosition);

      const [sql, params] = mockQuery.mock.calls[0];
      // SQL should use placeholders, not interpolated values
      expect(sql).toMatch(/\$\d+/);
      // The malicious string should be in params, not in SQL
      expect(params).toContain(maliciousPosition.mmsi);
      expect(sql).not.toContain('DROP TABLE');
    });
  });

  describe('getPositionHistory', () => {
    it('returns positions for given mmsi within time range', async () => {
      const mockPositions = [
        {
          time: new Date('2026-03-11T12:00:00Z'),
          mmsi: '123456789',
          imo: '1234567',
          latitude: 26.5,
          longitude: 56.25,
          speed: 12.5,
          course: 180,
          heading: 175,
          navStatus: 0,
          lowConfidence: false,
        },
      ];
      mockQuery.mockResolvedValue({ rows: mockPositions });

      const { getPositionHistory } = await import('./positions');
      const result = await getPositionHistory('123456789', 24);

      expect(result).toEqual(mockPositions);
      expect(mockQuery).toHaveBeenCalled();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('FROM vessel_positions');
      expect(sql).toContain('WHERE mmsi = $1');
      expect(params[0]).toBe('123456789');
    });

    it('orders by time DESC', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { getPositionHistory } = await import('./positions');
      await getPositionHistory('123456789');

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ORDER BY time DESC');
    });
  });

  describe('getLatestPositions', () => {
    it('returns most recent position per vessel', async () => {
      const mockPositions = [
        { mmsi: '123456789', latitude: 26.5, longitude: 56.25 },
        { mmsi: '987654321', latitude: 25.0, longitude: 55.0 },
      ];
      mockQuery.mockResolvedValue({ rows: mockPositions });

      const { getLatestPositions } = await import('./positions');
      const result = await getLatestPositions();

      expect(result).toEqual(mockPositions);
      expect(mockQuery).toHaveBeenCalled();
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('DISTINCT ON (mmsi)');
    });
  });
});
