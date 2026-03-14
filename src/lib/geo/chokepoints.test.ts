import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isInChokepoint, CHOKEPOINTS } from './chokepoints';

// Mock the database module
vi.mock('../db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('Chokepoints', () => {
  describe('isInChokepoint', () => {
    it('returns true for point inside Hormuz bounds', () => {
      expect(isInChokepoint(26.5, 56.0, CHOKEPOINTS.hormuz.bounds)).toBe(true);
    });

    it('returns false for point outside Hormuz bounds', () => {
      // 22.0 lat is south of minLat=23.5 in the new wider bounds
      expect(isInChokepoint(22.0, 56.0, CHOKEPOINTS.hormuz.bounds)).toBe(false);
    });

    it('returns true for point in expanded Hormuz southern area', () => {
      // 25.0 lat is inside the new bounds (minLat=23.5), was outside old bounds (minLat=26.0)
      expect(isInChokepoint(25.0, 56.5, CHOKEPOINTS.hormuz.bounds)).toBe(true);
    });

    it('returns true for point in expanded Bab-el-Mandeb bounds', () => {
      expect(isInChokepoint(11.5, 43.5, CHOKEPOINTS.babel_mandeb.bounds)).toBe(true);
    });

    it('returns true for point in expanded Bab-el-Mandeb wider longitude', () => {
      expect(isInChokepoint(12.5, 44.5, CHOKEPOINTS.babel_mandeb.bounds)).toBe(true);
    });

    it('returns true for point in expanded Suez Canal bounds', () => {
      expect(isInChokepoint(30.0, 32.8, CHOKEPOINTS.suez.bounds)).toBe(true);
    });

    it('returns true for point inside Bab el-Mandeb bounds', () => {
      expect(isInChokepoint(12.7, 43.3, CHOKEPOINTS.babel_mandeb.bounds)).toBe(true);
    });

    it('returns true for point inside Suez bounds', () => {
      expect(isInChokepoint(30.5, 32.4, CHOKEPOINTS.suez.bounds)).toBe(true);
    });

    it('returns true for point at edge of bounds (inclusive)', () => {
      // Edge case: exactly on minLat boundary
      expect(isInChokepoint(26.0, 56.0, CHOKEPOINTS.hormuz.bounds)).toBe(true);
      // Edge case: exactly on maxLat boundary
      expect(isInChokepoint(27.0, 56.5, CHOKEPOINTS.hormuz.bounds)).toBe(true);
    });
  });

  describe('CHOKEPOINTS constant', () => {
    it('contains three chokepoints', () => {
      expect(Object.keys(CHOKEPOINTS)).toHaveLength(3);
    });

    it('has valid bounds for each chokepoint', () => {
      for (const cp of Object.values(CHOKEPOINTS)) {
        expect(cp.bounds.minLat).toBeLessThan(cp.bounds.maxLat);
        expect(cp.bounds.minLon).toBeLessThan(cp.bounds.maxLon);
      }
    });
  });

  describe('countVesselsInChokepoint', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns count of vessels within bounding box', async () => {
      const { pool } = await import('../db');
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ total: 15, tankers: 8 }],
      });

      const { countVesselsInChokepoint } = await import('./chokepoints');
      const result = await countVesselsInChokepoint(CHOKEPOINTS.hormuz.bounds);

      expect(result.total).toBe(15);
      expect(result.tankers).toBe(8);
    });

    it('separates tanker count from total', async () => {
      const { pool } = await import('../db');
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ total: 20, tankers: 12 }],
      });

      const { countVesselsInChokepoint } = await import('./chokepoints');
      const result = await countVesselsInChokepoint(CHOKEPOINTS.babel_mandeb.bounds);

      expect(result.total).toBe(20);
      expect(result.tankers).toBe(12);
    });

    it('returns zero counts when no vessels found', async () => {
      const { pool } = await import('../db');
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [],
      });

      const { countVesselsInChokepoint } = await import('./chokepoints');
      const result = await countVesselsInChokepoint(CHOKEPOINTS.suez.bounds);

      expect(result.total).toBe(0);
      expect(result.tankers).toBe(0);
    });
  });

  describe('getChokepointStats', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns stats for all three chokepoints', async () => {
      const { pool } = await import('../db');
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ total: 10, tankers: 5 }],
      });

      const { getChokepointStats } = await import('./chokepoints');
      const stats = await getChokepointStats();

      expect(stats).toHaveLength(3);
      expect(stats.map(s => s.id)).toContain('hormuz');
      expect(stats.map(s => s.id)).toContain('babel_mandeb');
      expect(stats.map(s => s.id)).toContain('suez');
    });

    it('includes bounds in response', async () => {
      const { pool } = await import('../db');
      (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ total: 5, tankers: 2 }],
      });

      const { getChokepointStats } = await import('./chokepoints');
      const stats = await getChokepointStats();

      for (const stat of stats) {
        expect(stat.bounds).toBeDefined();
        expect(stat.bounds.minLat).toBeDefined();
        expect(stat.bounds.maxLat).toBeDefined();
        expect(stat.bounds.minLon).toBeDefined();
        expect(stat.bounds.maxLon).toBeDefined();
      }
    });
  });
});
