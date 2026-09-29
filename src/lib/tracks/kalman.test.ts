import { describe, expect, it } from 'vitest';
import { smooth } from './kalman';

describe('smooth', () => {
  it('recovers speed and course of a ship moving at constant velocity', () => {
    // 12 kn due east, one fix every 10 minutes
    const meas = Array.from({ length: 8 }, (_, k) => ({ t: k * 10, x: k * 2, y: 0 }));
    const s = smooth(meas);
    expect(Math.hypot(s.vx[s.n - 1], s.vy[s.n - 1])).toBeCloseTo(12, 0);
    expect(Math.abs(s.vy[s.n - 1])).toBeLessThan(0.5);
  });

  it('marks knot-to-knot hops faster than 28 kn as relocations', () => {
    const s = smooth([{ t: 0, x: 0, y: 0 }, { t: 10, x: 1, y: 0 }, { t: 20, x: 20, y: 0 }, { t: 30, x: 21, y: 0 }]);
    expect(Array.from(s.reloc)).toContain(1);
  });
});
