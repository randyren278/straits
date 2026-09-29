import { describe, expect, it } from 'vitest';
import { predictWith, type VesselState } from './estimate';
import { isLand } from './land';
import { projAt, toLat, toLon, toX, toY } from './proj';

const at = (lon: number, lat: number, vxKn: number, vyKn: number): VesselState => {
  const proj = projAt(lat);
  return { t: 0, x: toX(proj, lon), y: toY(lat), vx: vxKn, vy: vyKn, spd: Math.hypot(vxKn, vyKn), proj };
};
const onLand = (st: VesselState, pts: { x: number; y: number }[]) => pts.filter((p) => isLand(toLon(st.proj, p.x), toLat(p.y))).length;

describe('estimators', () => {
  it('hybrid equals straight on course in open water', () => {
    const st = at(57.3, 24.8, 10, 0);                  // Gulf of Oman, heading east
    const pts = predictWith('hybrid', st, 60, null, 60);
    expect(pts).toHaveLength(31);
    expect(pts.at(-1)!.x - pts[0].x).toBeCloseTo(10, 1);
  });

  it('hybrid bends through water instead of running aground', () => {
    const st = at(55.85, 25.95, 12, 0);                // heading east into Musandam
    const pts = predictWith('hybrid', st, 120, null, 60);
    expect(onLand(st, pts)).toBe(0);
    expect(pts.length).toBeGreaterThan(20);
  });

  it('damped slows toward a stop', () => {
    const st = at(57.3, 24.8, 10, 0);
    const pts = predictWith('damped', st, 240, null, 60);
    const early = pts[5].x - pts[0].x, late = pts[pts.length - 1].x - pts[pts.length - 6].x;
    expect(late).toBeLessThan(early / 3);
  });
});
