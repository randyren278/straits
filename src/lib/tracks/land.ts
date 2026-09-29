/**
 * Land raster (0.01°) and routing water grid (0.02°) for the Straits region.
 * SERVER-ONLY: imports ~1 MB of polygons. Never import from client code.
 */
import polys from './land-me.json';
import { GRID_RES, LAND_RES, REGION } from './constants';

const LW = Math.round((REGION.maxLon - REGION.minLon) * LAND_RES);
const LH = Math.round((REGION.maxLat - REGION.minLat) * LAND_RES);

/** Even-odd scanline fill of every ring at cell-centre latitudes. */
function rasterize(rings: number[][][]): Uint8Array {
  const mask = new Uint8Array(LW * LH);
  const rows: number[][] = Array.from({ length: LH }, () => []);
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
      if (y1 === y2) continue;
      const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
      const r0 = Math.max(0, Math.floor((REGION.maxLat - hi) * LAND_RES - 0.5));
      const r1 = Math.min(LH - 1, Math.ceil((REGION.maxLat - lo) * LAND_RES - 0.5));
      for (let r = r0; r <= r1; r++) {
        const lat = REGION.maxLat - (r + 0.5) / LAND_RES;
        if (lat < lo || lat >= hi) continue;
        rows[r].push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
  }
  for (let r = 0; r < LH; r++) {
    const xs = rows[r].sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - REGION.minLon) * LAND_RES - 0.5));
      const c1 = Math.min(LW - 1, Math.floor((xs[k + 1] - REGION.minLon) * LAND_RES - 0.5));
      for (let c = c0; c <= c1; c++) mask[r * LW + c] = 1;
    }
  }
  return mask;
}

const landMask = rasterize(polys as number[][][]);

export function isLand(lon: number, lat: number): boolean {
  const c = Math.floor((lon - REGION.minLon) * LAND_RES), r = Math.floor((REGION.maxLat - lat) * LAND_RES);
  return c >= 0 && r >= 0 && c < LW && r < LH && landMask[r * LW + c] === 1;
}

// Routing grid: a 0.02° cell is water only if all four 0.01° sub-cells are water.
const GW = Math.round((REGION.maxLon - REGION.minLon) * GRID_RES);
const GH = Math.round((REGION.maxLat - REGION.minLat) * GRID_RES);
const water = new Uint8Array(GW * GH), coast = new Uint8Array(GW * GH);
for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) {
  let land = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    const mr = r * 2 + a, mc = c * 2 + b;
    if (mr < LH && mc < LW && landMask[mr * LW + mc]) land = 1;
  }
  water[r * GW + c] = land ? 0 : 1;
}
for (let r = 1; r < GH - 1; r++) for (let c = 1; c < GW - 1; c++) {
  const i = r * GW + c; if (!water[i]) continue;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (!water[i + a * GW + b]) coast[i] = 1;
}
export const grid = { w: GW, h: GH, water, coast };

export const inGrid = (c: number, r: number) => c >= 0 && r >= 0 && c < GW && r < GH;
export const cellOf = (lon: number, lat: number): [number, number] =>
  [Math.floor((lon - REGION.minLon) * GRID_RES), Math.floor((REGION.maxLat - lat) * GRID_RES)];
export const cellCenter = (c: number, r: number): [number, number] =>
  [REGION.minLon + (c + 0.5) / GRID_RES, REGION.maxLat - (r + 0.5) / GRID_RES];

export function nearestWater(c: number, r: number, maxRad = 4): [number, number] | null {
  for (let rad = 0; rad <= maxRad; rad++) for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) {
    if (Math.max(Math.abs(a), Math.abs(b)) !== rad) continue;
    const cc = c + b, rr = r + a;
    if (inGrid(cc, rr) && water[rr * GW + cc]) return [cc, rr];
  }
  return null;
}

/** On land and more than one grid cell (~1 nm) from any water: likely GPS interference. */
export function deepInland(lon: number, lat: number): boolean {
  if (!isLand(lon, lat)) return false;
  const [c, r] = cellOf(lon, lat);
  return !nearestWater(c, r, 1);
}
