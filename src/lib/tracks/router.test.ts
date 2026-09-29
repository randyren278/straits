import { describe, expect, it } from 'vitest';
import { clearPath, route } from './router';
import { nmBetween } from './proj';

describe('route', () => {
  it('goes around Musandam instead of across it', () => {
    const from: [number, number] = [55.75, 25.95], to: [number, number] = [56.6, 25.95];
    expect(clearPath(...from, ...to)).toBe(false);          // the straight line crosses land
    const p = route(...from, ...to, null)!;
    expect(p).not.toBeNull();
    for (let k = 1; k < p.length; k++) expect(clearPath(p[k - 1][0], p[k - 1][1], p[k][0], p[k][1])).toBe(true);
    let len = 0; for (let k = 1; k < p.length; k++) len += nmBetween(p[k - 1][0], p[k - 1][1], p[k][0], p[k][1]);
    expect(len).toBeGreaterThan(nmBetween(...from, ...to) * 1.3);
  });

  it('keeps open-water routes close to straight', () => {
    const p = route(57.0, 25.0, 57.6, 24.6, null)!;
    let len = 0; for (let k = 1; k < p.length; k++) len += nmBetween(p[k - 1][0], p[k - 1][1], p[k][0], p[k][1]);
    expect(len).toBeLessThan(nmBetween(57.0, 25.0, 57.6, 24.6) * 1.08);
  });
});
