import { describe, it, expect } from 'vitest';
import { isInChokepoint, CHOKEPOINTS } from './chokepoints';

describe('Chokepoints', () => {
  describe('isInChokepoint', () => {
    it('returns true for point inside Hormuz bounds', () => {
      expect(isInChokepoint(26.5, 56.0, CHOKEPOINTS.hormuz.bounds)).toBe(true);
    });

    it('returns false for point outside Hormuz bounds', () => {
      expect(isInChokepoint(25.0, 56.0, CHOKEPOINTS.hormuz.bounds)).toBe(false);
    });

    it.todo('returns true for point inside Bab el-Mandeb bounds');
    it.todo('returns true for point inside Suez bounds');
    it.todo('returns false for point at edge of bounds (exclusive)');
  });

  describe('CHOKEPOINTS constant', () => {
    it('contains three chokepoints', () => {
      expect(Object.keys(CHOKEPOINTS)).toHaveLength(3);
    });

    it.todo('has valid bounds for each chokepoint');
  });
});
