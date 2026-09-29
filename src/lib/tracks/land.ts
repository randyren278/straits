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

/**
 * Waterways too narrow for Natural Earth 10 m land data, which does not cut the Suez Canal:
 * without this, every canal transit reads as a ship on land. The centerline is the median of
 * 7 days of real fixes per 0.02° latitude band (Port Said → Ballah → Timsah → Bitter Lakes →
 * Suez). Half-width 0.015° (~1.6 km) covers both lanes of the doubled sections.
 */
export const WATERWAYS: { name: string; halfWidthDeg: number; points: [number, number][] }[] = [{
  name: 'Suez Canal',
  halfWidthDeg: 0.015,
  points: [
    [32.365, 31.30], [32.330, 31.26], [32.355, 31.22], [32.340, 31.18], [32.320, 31.14], [32.308, 31.10],
    [32.3095, 31.06], [32.311, 31.00], [32.313, 30.94], [32.3155, 30.88], [32.3175, 30.82], [32.326, 30.76],
    [32.350, 30.70], [32.336, 30.66], [32.325, 30.62], [32.320, 30.60], [32.304, 30.56], [32.315, 30.54],
    [32.335, 30.50], [32.352, 30.44], [32.362, 30.38], [32.390, 30.34], [32.409, 30.32], [32.430, 30.30],
    [32.452, 30.28], [32.497, 30.26], [32.537, 30.24], [32.563, 30.20], [32.570, 30.14], [32.572, 30.06],
    [32.586, 29.98], [32.560, 29.93],
  ],
}];

function carveWaterways(mask: Uint8Array) {
  for (const w of WATERWAYS) {
    const pts = w.points, hw = w.halfWidthDeg;
    for (let k = 0; k + 1 < pts.length; k++) {
      const [x1, y1] = pts[k], [x2, y2] = pts[k + 1];
      const c0 = Math.max(0, Math.floor((Math.min(x1, x2) - hw - REGION.minLon) * LAND_RES));
      const c1 = Math.min(LW - 1, Math.ceil((Math.max(x1, x2) + hw - REGION.minLon) * LAND_RES));
      const r0 = Math.max(0, Math.floor((REGION.maxLat - Math.max(y1, y2) - hw) * LAND_RES));
      const r1 = Math.min(LH - 1, Math.ceil((REGION.maxLat - Math.min(y1, y2) + hw) * LAND_RES));
      const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy || 1e-12;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const lon = REGION.minLon + (c + 0.5) / LAND_RES, lat = REGION.maxLat - (r + 0.5) / LAND_RES;
        const u = Math.max(0, Math.min(1, ((lon - x1) * dx + (lat - y1) * dy) / len2));
        if (Math.hypot(lon - (x1 + u * dx), lat - (y1 + u * dy)) <= hw) mask[r * LW + c] = 0;
      }
    }
  }
}

const landMask = rasterize(polys as number[][][]);
carveWaterways(landMask);

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
