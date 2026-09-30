import { describe, expect, it } from 'vitest';
import { isLand, deepInland, grid, cellOf, nearestWater } from './land';

describe('land raster', () => {
  it('knows sea from land around Hormuz', () => {
    expect(isLand(56.5, 25.25)).toBe(false);   // off Fujairah
    expect(isLand(57.0, 23.0)).toBe(true);     // Oman interior
    expect(isLand(56.2, 26.0)).toBe(true);     // Musandam
    expect(isLand(53.5, 26.5)).toBe(false);    // Persian Gulf
  });

  it('treats coastal berths as not deep inland', () => {
    expect(deepInland(57.0, 23.0)).toBe(true);
    expect(isLand(56.37, 25.15)).toBe(true);     // Fujairah waterline: land…
    expect(deepInland(56.37, 25.15)).toBe(false); // …but a berth, not interference
  });

  it('has a water grid with coast cells and a nearest-water search', () => {
    const [c, r] = cellOf(56.5, 25.25);
    expect(grid.water[r * grid.w + c]).toBe(1);
    const [lc, lr] = cellOf(57.0, 23.0);
    expect(grid.water[lr * grid.w + lc]).toBe(0);
    expect(nearestWater(lc, lr, 2)).toBeNull();
    expect(grid.coast.some((v) => v === 1)).toBe(true);
  });

  it('keeps the Suez Canal and its lakes navigable', () => {
    for (const [lon, lat] of [[32.3155, 30.88], [32.304, 30.56], [32.43, 30.30], [32.572, 30.06], [32.33, 31.26]]) {
      expect(isLand(lon, lat)).toBe(false);
    }
    expect(isLand(32.10, 30.50)).toBe(true);   // desert west of the canal stays land
  });
});

describe('routing through the Suez Canal', () => {
  it('finds a water route from Port Said to Suez along the canal', async () => {
    const { route } = await import('./router');
    const { isLand: onLand } = await import('./land');
    const r = route(32.33, 31.25, 32.56, 29.95, null);
    expect(r).not.toBeNull();
    let len = 0;
    for (let k = 1; k < r!.length; k++) len += Math.hypot((r![k][0] - r![k - 1][0]) * 60 * Math.cos(0.53), (r![k][1] - r![k - 1][1]) * 60);
    expect(len).toBeLessThan(110);                 // the canal is ~90 nm; a detour round Africa is not
    expect(r!.filter(([lo, la]) => onLand(lo, la)).length).toBeLessThanOrEqual(2);
  });
});
