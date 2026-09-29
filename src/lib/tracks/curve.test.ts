import { describe, expect, it } from 'vitest';
import { smooth } from './kalman';
import { along, hermite, pathAt, polyline } from './curve';

describe('curve', () => {
  it('interpolates history continuously through the knots', () => {
    const s = smooth(Array.from({ length: 6 }, (_, k) => ({ t: k * 10, x: k * 2, y: Math.sin(k) * 0.2 })));
    const o = { x: 0, y: 0, vx: 0, vy: 0 };
    let prev = hermite(s, 0, { ...o });
    for (let t = 0.5; t <= 50; t += 0.5) {
      const cur = hermite(s, t, { ...o });
      expect(Math.hypot(cur.x - prev.x, cur.y - prev.y)).toBeLessThan(0.25);
      prev = cur;
    }
  });

  it('walks a polyline by distance', () => {
    const pl = polyline([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }]);
    expect(pl.len).toBe(7);
    const o = { x: 0, y: 0, ux: 0, uy: 0 };
    along(pl, 5, o);
    expect(o).toMatchObject({ x: 3, y: 2, ux: 0, uy: 1 });
  });

  it('keeps full speed at the start of a Catmull-Rom path (mirrored phantom point)', () => {
    const pts = Array.from({ length: 5 }, (_, k) => ({ t: k * 2, x: k, y: 0 }));
    const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
    pathAt(pts, 0.1, a); pathAt(pts, 0.2, b);
    expect((b.x - a.x) / 0.1).toBeCloseTo(0.5, 2); // 1 nm per 2 min
  });
});
