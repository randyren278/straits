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
