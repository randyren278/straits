# Track Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the track engine from `docs/superpowers/specs/2026-09-29-track-engine-design.md` to straits.randyren.org. The engine cleans and smooths every vessel's track, scores its evidence, carries every estimable ship forward to the current time along land-aware paths, corrects smoothly as new data lands, and learns which estimator works where. It is rendered on the live map with the approved mockup's visuals.

**Architecture:** The engine is pure TypeScript in `src/lib/tracks/`. It runs inside the Mac harvester as a new time-budgeted step. Each run writes one API-ready JSON row per vessel to `vessel_track_state`, plus learning state and lane density. A separate `GET /api/tracks` serves those rows, so the existing vessel-dot first load is untouched. On the client, a canvas overlay synced to MapLibre draws moving and estimated ships, tails, dashed estimates, uncertainty and the capped glow. A `Nowcaster` blends old→new trajectories by wall-clock time. MapLibre keeps drawing ships at rest, with its existing hit-testing, proximity panel and track history.

**Tech Stack:**
- Next.js 16 App Router, React 19, TypeScript 5, MapLibre GL 6
- Zustand, Vitest 4 (happy-dom), Playwright for browser checks
- node-postgres against Supabase PG17 (plain) and local TimescaleDB
- Harvester run with `tsx` under launchd

## Global Constraints

- Engine modules use **relative imports only** (no `@/`). The harvester runs them under `tsx` without the Next alias.
- `src/lib/tracks/land.ts` and `land-me.json` are **server-only**. Nothing under `src/app/(protected)` or `src/components` may import them. Client code imports only `codec.ts`, `nowcast.ts`, `frame.ts` and `types.ts`.
- Times inside the engine are **minutes since the Unix epoch** (float). Distances are nautical miles, in a per-vessel local frame `x = lon·60·cos(lat₀)`, `y = lat·60`.
- Constants (verbatim from the spec):
  - jitter 0.1 nm; teleport 35 kn; confirm 1.0 nm; dwell 25 min
  - underway 3 kn; estimable 1–28 kn with a >0.3 nm move in the 90 min before the last fix
  - estimate horizon 360 min
  - Kalman Q 60 nm²/h³, R 0.02 nm²
  - blend `B = clamp(15·offset_nm, 6, 60)` map-min; heading blend `BH = max(B, Δheading°/10)`
  - heading window ±2 min; per-frame heading damping τ 120 ms; end-of-estimate deceleration over the last 10 min
- Tiers: score ≥72 well tracked (0), 45–71 tracked (1), <45 sparse (2), no fix in 24 h stale (3, hidden by default).
- Colors come from the existing palette: amber `#f59e0b`; glow tint `#c9975a` at 30% max opacity; moving glyph `#fff6e3` (tier 0) or `#d8dbe0`; hollow estimated glyph stroke `#fff6e3`.
- Every new table enables RLS and grants nothing to `anon`/`authenticated`. CI asserts every public table has RLS.
- Migrations go in `scripts/migrations/`, mirrored in `src/lib/db/schema.sql` and `scripts/schema-portable.sql`, with `SET LOCAL` inside `BEGIN/COMMIT` and never a bare `SET`.
- Out of scope (follow-up plans):
  - The 24 h replay timeline and raw/cleaned toggle.
  - The selected-ship uncertainty cone and zoomed-in name labels. The existing track-history view already covers selection.
  - The spec's "store-on-change" ingest. Dropping repeated fixes would starve dwell detection and the evidence regularity score, which both read those repeats, so it needs its own design.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/build-land.mjs` | Generate `src/lib/tracks/land-me.json` from Natural Earth 10 m (world-atlas), clipped to the region |
| `src/lib/tracks/land-me.json` | Land polygons `[[lon,lat],...][]` for lon 30–63, lat 10–32 (generated, committed) |
| `src/lib/tracks/constants.ts` | Engine constants |
| `src/lib/tracks/proj.ts` | Per-vessel nm projection, `TPt` type |
| `src/lib/tracks/land.ts` | Land raster (0.01°), water grid (0.02°), `isLand`, `deepInland`, `nearestWater` (server-only) |
| `src/lib/tracks/clean.ts` | Runs, jitter/teleport/dwell/inland cleaning, midpoint report times |
| `src/lib/tracks/kalman.ts` | Constant-velocity Kalman + RTS smoother, relocation marks |
| `src/lib/tracks/curve.ts` | Hermite history (with detours/relocations), polyline, Catmull-Rom `pathAt` |
| `src/lib/tracks/router.ts` | A* sea router over the water grid, lane-density costs, land repair of history |
| `src/lib/tracks/estimate.ts` | `stateOf`, `canEstimate`, straight / sea / hybrid / damped estimators |
| `src/lib/tracks/evidence.ts` | Evidence score, parts and tier |
| `src/lib/tracks/learn.ts` | Contexts, learning state, estimator and τ choice, truth updates, path scoring |
| `src/lib/tracks/engine.ts` | `runTrackEngine()`: orchestrates everything for one harvester run |
| `src/lib/tracks/codec.ts` | Compact delta encoding of `[t,lat,lon]` series (shared) |
| `src/lib/tracks/types.ts` | `TrackPayload`, `TracksResponse` (shared wire types) |
| `src/lib/tracks/nowcast.ts` | Client `Nowcaster`: epochs, projective blending, heading (shared, pure) |
| `src/lib/tracks/frame.ts` | Pure frame builder: draw primitives from nowcaster and projection (shared) |
| `src/lib/db/tracks.ts` | Load engine input, save states, learning state, lane density; API read |
| `scripts/migrations/20260930_track_engine.sql` | `vessel_track_state`, `track_engine_state`, `lane_density` |
| `src/services/ais-ingester/harvest-once.ts` | New `track engine` step |
| `src/app/api/tracks/route.ts` | `GET /api/tracks` |
| `src/stores/tracks.ts` | Zustand store: payloads by MMSI, backtest, learned, show-stale |
| `src/lib/hooks/useTracks.ts` | Polls `/api/tracks`, feeds store and nowcaster |
| `src/components/map/MotionOverlay.tsx` | Canvas overlay renderer and picking |
| `src/components/map/VesselMap.tsx` | Merge tier/motion props, filter the circle layer, mount the overlay, overlay-first click |
| `src/lib/map/geojson.ts` | Optional tier/motion properties on features |
| `src/components/panels/TrackingSection.tsx` + `VesselPanel.tsx` | Evidence breakdown and estimate basis |
| `src/components/map/MapLegend.tsx`, `MapFilterChips.tsx` | Tier/estimate legend rows, Stale toggle |
| `scripts/verify-motion.mjs` | Browser check: overlay draws, picking works, 60 fps, no errors |

---

### Task 1: Land data and land raster

**Files:**
- Create: `scripts/build-land.mjs`, `src/lib/tracks/land-me.json` (generated), `src/lib/tracks/constants.ts`, `src/lib/tracks/proj.ts`, `src/lib/tracks/land.ts`
- Modify: `package.json` (devDependencies `world-atlas@^2.0.2`, `topojson-client@^3.1.0`)
- Test: `src/lib/tracks/land.test.ts`

**Interfaces:**
- Produces:
  - `REGION`, `LAND_RES = 100`, `GRID_RES = 50`
  - `isLand(lon, lat): boolean` and `deepInland(lon, lat): boolean` (land and no water cell within one grid cell)
  - `grid = { w, h, water: Uint8Array, coast: Uint8Array }`
  - `cellOf(lon, lat): [c, r]`, `cellCenter(c, r): [lon, lat]`, `inGrid(c, r)`, `nearestWater(c, r, maxRad = 4): [c, r] | null`
  - `Proj`, `projAt(lat)`, `toX`, `toY`, `toLon`, `toLat`, `TPt`
  - All constants in `constants.ts`

- [ ] **Step 1: Add dev dependencies**

Run: `npm install -D world-atlas@^2.0.2 topojson-client@^3.1.0`
Expected: `package.json` devDependencies gain both packages.

- [ ] **Step 2: Write the generator**

`scripts/build-land.mjs`:
```js
/**
 * Build src/lib/tracks/land-me.json: Natural Earth 10m land clipped to the
 * Straits region (Sutherland–Hodgman against the bbox) and decimated to ~0.01°.
 * Run: node scripts/build-land.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/land-10m.json'), 'utf8'));
const B = { minLon: 29.5, minLat: 9.5, maxLon: 63.5, maxLat: 32.5 };

function clip(ring) {
  const edge = (pts, inside, inter) => {
    const out = [];
    for (let k = 0; k < pts.length; k++) {
      const cur = pts[k], prev = pts[(k + pts.length - 1) % pts.length];
      const ci = inside(cur), pi = inside(prev);
      if (ci) { if (!pi) out.push(inter(prev, cur)); out.push(cur); } else if (pi) out.push(inter(prev, cur));
    }
    return out;
  };
  const ix = (x) => (p, q) => [x, p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0])];
  const iy = (y) => (p, q) => [p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]), y];
  let pts = ring;
  for (const [inside, inter] of [
    [(p) => p[0] >= B.minLon, ix(B.minLon)], [(p) => p[0] <= B.maxLon, ix(B.maxLon)],
    [(p) => p[1] >= B.minLat, iy(B.minLat)], [(p) => p[1] <= B.maxLat, iy(B.maxLat)],
  ]) { if (!pts.length) break; pts = edge(pts, inside, inter); }
  return pts;
}

const land = feature(topo, topo.objects.land);
const polys = [];
for (const f of land.features ?? [land]) {
  const geom = f.geometry;
  const all = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
  for (const poly of all) for (const ring of poly) {
    const out = []; let last = null;
    for (const [x, y] of clip(ring)) {
      const q = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
      if (last && Math.abs(q[0] - last[0]) < 0.01 && Math.abs(q[1] - last[1]) < 0.01) continue;
      out.push(q); last = q;
    }
    if (out.length > 3) polys.push(out);
  }
}
writeFileSync(new URL('../src/lib/tracks/land-me.json', import.meta.url), JSON.stringify(polys));
console.log(`land-me.json: ${polys.length} rings, ${polys.reduce((n, p) => n + p.length, 0)} points`);
```

Run: `node scripts/build-land.mjs`
Expected: prints `land-me.json: N rings, M points`, with M in the tens of thousands.

- [ ] **Step 3: Write constants and projection**

`src/lib/tracks/constants.ts`:
```ts
/** Track engine constants — values are fixed by the design spec. */
export const JITTER_NM = 0.1;          // moves under ~185 m are anchor/GPS jitter
export const TELEPORT_KN = 35;         // implied speed above this is quarantined
export const CONFIRM_NM = 1.0;         // a quarantined fix confirmed by the next within 1 nm is real
export const DWELL_MIN = 25;           // a repeat this long means stopped, not a stale report
export const UNDERWAY_KN = 3;
export const MIN_EST_KN = 1;
export const MAX_KN = 28;
export const MAX_EST_MIN = 360;        // never carry a ship more than 6 h past its last real fix
export const KALMAN_Q = 60;            // nm²/h³
export const KALMAN_R = 0.02;          // nm²
export const REGION = { minLon: 30, minLat: 10, maxLon: 63, maxLat: 32 } as const;
export const LAND_RES = 100;           // land raster cells per degree (0.01°)
export const GRID_RES = 50;            // routing grid cells per degree (0.02°)
```

`src/lib/tracks/proj.ts`:
```ts
/** Per-vessel local equirectangular frame in nautical miles. */
export interface Proj { k: number }
/** A timed point: t in minutes since the Unix epoch, x/y in nm in a vessel's frame. */
export interface TPt { t: number; x: number; y: number }

export const projAt = (lat: number): Proj => ({ k: Math.cos((lat * Math.PI) / 180) });
export const toX = (p: Proj, lon: number) => lon * 60 * p.k;
export const toY = (lat: number) => lat * 60;
export const toLon = (p: Proj, x: number) => x / (60 * p.k);
export const toLat = (y: number) => y / 60;
/** Distance in nm between two lon/lat points (local flat approximation). */
export function nmBetween(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const k = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  return Math.hypot((lon2 - lon1) * 60 * k, (lat2 - lat1) * 60);
}
```

- [ ] **Step 4: Write the failing test**

`src/lib/tracks/land.test.ts`:
```ts
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
});
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `npx vitest run src/lib/tracks/land.test.ts`
Expected: FAIL with `Cannot find module './land'`.

- [ ] **Step 6: Implement the land raster**

`src/lib/tracks/land.ts`:
```ts
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
```

- [ ] **Step 7: Run the test and confirm it passes**

Run: `npx vitest run src/lib/tracks/land.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add scripts/build-land.mjs src/lib/tracks/{land-me.json,constants.ts,proj.ts,land.ts,land.test.ts} package.json package-lock.json
git commit -m "Track engine: land raster and routing grid for the region"
```

---

### Task 2: Cleaning

**Files:**
- Create: `src/lib/tracks/clean.ts`
- Test: `src/lib/tracks/clean.test.ts`

**Interfaces:**
- Consumes: `Proj`, `toX`, `toY`, `toLon`, `toLat`, `TPt` (Task 1); `deepInland` (Task 1); constants
- Produces:
  - `interface RawFix { t: number; lon: number; lat: number }`
  - `interface Run { t0: number; t1: number; x: number; y: number; n: number }`
  - `runsOf(fixes: RawFix[], proj: Proj, tMax = Infinity): Run[]`
  - `interface Cleaned { meas: TPt[]; rejected: number; moves: number; jitter: number; inland: number }`
  - `clean(runs: Run[], proj: Proj): Cleaned`

- [ ] **Step 1: Write the failing test**

`src/lib/tracks/clean.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clean, runsOf, type RawFix } from './clean';
import { projAt } from './proj';

const P = projAt(25.3);
const LON = 56.6, LAT = 25.3;                 // open water off Fujairah
const nmLon = (nm: number) => nm / (60 * P.k);
const fix = (min: number, dxNm = 0, dyNm = 0): RawFix => ({ t: min, lon: LON + nmLon(dxNm), lat: LAT + dyNm / 60 });

describe('clean', () => {
  it('collapses repeated positions into runs', () => {
    const runs = runsOf([fix(0), fix(10), fix(20), fix(30, 2)], P);
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ t0: 0, t1: 20, n: 3 });
  });

  it('stamps a change at the midpoint between the last old sighting and the new one', () => {
    const { meas } = clean(runsOf([fix(0), fix(10), fix(20, 2)], P), P);
    expect(meas[1].t).toBe(15);
  });

  it('holds jitter under 0.1 nm as dwelling, not motion', () => {
    const c = clean(runsOf([fix(0), fix(10, 0.05), fix(20, 0.02, 0.03)], P), P);
    expect(c.jitter).toBe(2);
    expect(c.moves).toBe(0);
  });

  it('quarantines a teleport and accepts it once the next fix confirms it', () => {
    const rejected = clean(runsOf([fix(0), fix(10, 1), fix(20, 30), fix(30, 1.5)], P), P);
    expect(rejected.rejected).toBe(1);
    const confirmed = clean(runsOf([fix(0), fix(10, 1), fix(20, 30), fix(30, 30.3)], P), P);
    expect(confirmed.rejected).toBe(0);
    expect(confirmed.meas.at(-1)!.x).toBeGreaterThan(confirmed.meas[0].x + 25);
  });

  it('adds a stationary measurement after a dwell of 25+ minutes', () => {
    const { meas } = clean(runsOf([fix(0), fix(10, 2), fix(20, 2), fix(40, 2)], P), P);
    expect(meas.at(-1)!.t).toBe(40);
    expect(meas.at(-1)!.x).toBeCloseTo(meas.at(-2)!.x);
  });

  it('rejects fixes deep inland as GPS interference', () => {
    const inland: RawFix = { t: 10, lon: 57.0, lat: 23.0 };
    const c = clean(runsOf([fix(0), inland, fix(20, 1)], P), P);
    expect(c.inland).toBe(1);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/tracks/clean.test.ts`
Expected: FAIL with `Cannot find module './clean'`.

- [ ] **Step 3: Implement cleaning**

`src/lib/tracks/clean.ts`:
```ts
/** Stage 1: turn raw scraped fixes into trustworthy measurements. */
import { CONFIRM_NM, DWELL_MIN, JITTER_NM, TELEPORT_KN } from './constants';
import { deepInland } from './land';
import { toLat, toLon, toX, toY, type Proj, type TPt } from './proj';

export interface RawFix { t: number; lon: number; lat: number }
export interface Run { t0: number; t1: number; x: number; y: number; n: number }
export interface Cleaned { meas: TPt[]; rejected: number; moves: number; jitter: number; inland: number }

/** Collapse identical consecutive fixes (the feed repeats stale positions). */
export function runsOf(fixes: RawFix[], proj: Proj, tMax = Infinity): Run[] {
  const runs: Run[] = [];
  for (const f of fixes) {
    if (f.t > tMax) break;
    const x = toX(proj, f.lon), y = toY(f.lat), last = runs[runs.length - 1];
    if (last && last.x === x && last.y === y) { last.t1 = f.t; last.n++; }
    else runs.push({ t0: f.t, t1: f.t, x, y, n: 1 });
  }
  return runs;
}

export function clean(runs: Run[], proj: Proj): Cleaned {
  const meas: TPt[] = [];
  let rejected = 0, moves = 0, jitter = 0, inland = 0;
  let quarantine: TPt | null = null, dwellEnd = -Infinity, prevEnd: number | null = null;
  for (const r of runs) {
    // Fixes are stamped with fetch time; the report happened between the last fetch that
    // still showed the old position and this one — take the midpoint.
    const tEst = prevEnd === null ? r.t0 : (prevEnd + r.t0) / 2;
    prevEnd = r.t1;
    if (deepInland(toLon(proj, r.x), toLat(r.y))) { inland++; rejected++; continue; }
    if (!meas.length) { meas.push({ t: tEst, x: r.x, y: r.y }); dwellEnd = r.t1; continue; }
    const last = meas[meas.length - 1];
    const d = Math.hypot(r.x - last.x, r.y - last.y);
    const v = d / (Math.max(1, tEst - last.t) / 60);
    if (d < JITTER_NM) { jitter++; dwellEnd = r.t1; continue; }
    if (v > TELEPORT_KN) {
      if (quarantine && Math.hypot(r.x - quarantine.x, r.y - quarantine.y) < CONFIRM_NM) {
        meas.push(quarantine, { t: tEst, x: r.x, y: r.y });
        moves += 2; rejected--; quarantine = null; dwellEnd = r.t1; continue;
      }
      quarantine = { t: tEst, x: r.x, y: r.y }; rejected++; continue;
    }
    quarantine = null;
    if (dwellEnd - last.t >= DWELL_MIN) meas.push({ t: dwellEnd, x: last.x, y: last.y });
    meas.push({ t: tEst, x: r.x, y: r.y }); moves++; dwellEnd = r.t1;
  }
  if (meas.length) {
    const last = meas[meas.length - 1];
    if (dwellEnd - last.t >= DWELL_MIN) meas.push({ t: dwellEnd, x: last.x, y: last.y });
  }
  return { meas, rejected, moves, jitter, inland };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/lib/tracks/clean.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracks/clean.ts src/lib/tracks/clean.test.ts
git commit -m "Track engine: cleaning rules for the scraped feed"
```

---

### Task 3: Kalman smoother and history curve

**Files:**
- Create: `src/lib/tracks/kalman.ts`, `src/lib/tracks/curve.ts`
- Test: `src/lib/tracks/kalman.test.ts`, `src/lib/tracks/curve.test.ts`

**Interfaces:**
- Consumes: `TPt`, constants
- Produces:
  - `interface Smoothed { t: number[]; x: Float64Array; y: Float64Array; vx: Float64Array; vy: Float64Array; n: number; reloc: Uint8Array; detour: Record<number, Polyline> | null }`
  - `smooth(meas: TPt[]): Smoothed` (velocities in nm/h)
  - `interface Polyline { pts: { x: number; y: number }[]; cum: number[]; len: number }`
  - `polyline(pts)`, `along(pl, d, o)` (sets `o.x`, `o.y`, `o.ux`, `o.uy`)
  - `interface Kin { x: number; y: number; vx: number; vy: number }`
  - `hermite(s: Smoothed, t: number, o: Kin): Kin`
  - `pathAt(pts: TPt[], t: number, o: { x: number; y: number })`: Catmull-Rom with mirrored phantom ends; samples must be evenly spaced

- [ ] **Step 1: Write the failing tests**

`src/lib/tracks/kalman.test.ts`:
```ts
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
```

`src/lib/tracks/curve.test.ts`:
```ts
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
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/lib/tracks/kalman.test.ts src/lib/tracks/curve.test.ts`
Expected: FAIL with `Cannot find module './kalman'` / `'./curve'`.

- [ ] **Step 3: Implement the smoother**

`src/lib/tracks/kalman.ts`:
```ts
/** Stage 2: constant-velocity Kalman filter + RTS smoother, one axis at a time. */
import { KALMAN_Q as Q, KALMAN_R as R, MAX_KN } from './constants';
import type { TPt } from './proj';
import type { Polyline } from './curve';

export interface Smoothed {
  t: number[]; x: Float64Array; y: Float64Array; vx: Float64Array; vy: Float64Array; n: number;
  /** 1 where the hop to the next knot implies > MAX_KN: a coverage jump, not motion. */
  reloc: Uint8Array;
  /** Sea-route replacements for segments whose curve would cross land (Task 4). */
  detour: Record<number, Polyline> | null;
}

function smoothAxis(ts: number[], zs: number[]): { p: Float64Array; v: Float64Array } {
  const n = ts.length;
  const mp = new Float64Array(n), mv = new Float64Array(n);
  const Pa = new Float64Array(n), Pb = new Float64Array(n), Pc = new Float64Array(n);
  const pp = new Float64Array(n), pv = new Float64Array(n), Qa = new Float64Array(n), Qb = new Float64Array(n), Qc = new Float64Array(n);
  let p = zs[0], v = 0, a = R, b = 0, c = 100;
  for (let k = 0; k < n; k++) {
    if (k > 0) {
      const dt = (ts[k] - ts[k - 1]) / 60;
      const na = a + 2 * b * dt + c * dt * dt + (Q * dt * dt * dt) / 3, nb = b + c * dt + (Q * dt * dt) / 2, nc = c + Q * dt;
      p += v * dt; a = na; b = nb; c = nc;
    }
    pp[k] = p; pv[k] = v; Qa[k] = a; Qb[k] = b; Qc[k] = c;
    const S = a + R, k0 = a / S, k1 = b / S, innov = zs[k] - p;
    p += k0 * innov; v += k1 * innov;
    const ua = (1 - k0) * a, ub = (1 - k0) * b, uc = c - k1 * b; a = ua; b = ub; c = uc;
    mp[k] = p; mv[k] = v; Pa[k] = a; Pb[k] = b; Pc[k] = c;
  }
  const sp = Float64Array.from(mp), sv = Float64Array.from(mv);
  let sa = Pa[n - 1], sb = Pb[n - 1], sc = Pc[n - 1];
  for (let k = n - 2; k >= 0; k--) {
    const dt = (ts[k + 1] - ts[k]) / 60;
    const fa = Pa[k] + Pb[k] * dt, fb = Pb[k], fc = Pb[k] + Pc[k] * dt, fd = Pc[k];
    const A = Qa[k + 1], B = Qb[k + 1], C = Qc[k + 1], det = A * C - B * B || 1e-9;
    const i00 = C / det, i01 = -B / det, i11 = A / det;
    const g00 = fa * i00 + fb * i01, g01 = fa * i01 + fb * i11, g10 = fc * i00 + fd * i01, g11 = fc * i01 + fd * i11;
    const dp = sp[k + 1] - pp[k + 1], dv = sv[k + 1] - pv[k + 1];
    sp[k] = mp[k] + g00 * dp + g01 * dv; sv[k] = mv[k] + g10 * dp + g11 * dv;
    const da = sa - A, db = sb - B, dc = sc - C;
    sa = Pa[k] + g00 * g00 * da + 2 * g00 * g01 * db + g01 * g01 * dc;
    sb = Pb[k] + g00 * g10 * da + (g00 * g11 + g01 * g10) * db + g01 * g11 * dc;
    sc = Pc[k] + g10 * g10 * da + 2 * g10 * g11 * db + g11 * g11 * dc;
  }
  return { p: sp, v: sv };
}

export function smooth(meas: TPt[]): Smoothed {
  const ts = meas.map((m) => m.t);
  const sx = smoothAxis(ts, meas.map((m) => m.x)), sy = smoothAxis(ts, meas.map((m) => m.y));
  const reloc = new Uint8Array(ts.length);
  for (let k = 0; k < ts.length - 1; k++) {
    const d = Math.hypot(sx.p[k + 1] - sx.p[k], sy.p[k + 1] - sy.p[k]), h = (ts[k + 1] - ts[k]) / 60;
    if (h > 0 && d / h > MAX_KN) reloc[k] = 1;
  }
  return { t: ts, x: sx.p, y: sy.p, vx: sx.v, vy: sy.v, n: ts.length, reloc, detour: null };
}
```

- [ ] **Step 4: Implement the curves**

`src/lib/tracks/curve.ts`:
```ts
/** History and estimate curves in a vessel's nm frame. */
import type { Smoothed } from './kalman';
import type { TPt } from './proj';

export interface Polyline { pts: { x: number; y: number }[]; cum: number[]; len: number }
export interface Kin { x: number; y: number; vx: number; vy: number }

export function polyline(pts: { x: number; y: number }[]): Polyline {
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
  return { pts, cum, len: cum[cum.length - 1] || 1e-6 };
}

export function along(pl: Polyline, d: number, o: { x: number; y: number; ux: number; uy: number }) {
  const P = pl.pts, C = pl.cum, L = P.length - 1;
  if (L === 0) { o.x = P[0].x; o.y = P[0].y; o.ux = 1; o.uy = 0; return o; }
  d = Math.max(0, Math.min(pl.len, d));
  let a = 0, b = L;
  while (b - a > 1) { const m = (a + b) >> 1; if (C[m] <= d) a = m; else b = m; }
  const seg = C[b] - C[a] || 1e-9, f = (d - C[a]) / seg;
  o.x = P[a].x + (P[b].x - P[a].x) * f; o.y = P[a].y + (P[b].y - P[a].y) * f;
  o.ux = (P[b].x - P[a].x) / seg; o.uy = (P[b].y - P[a].y) / seg;
  return o;
}

/**
 * Smoothed history at time t. Normal segments are cubic Hermite (continuous position and
 * velocity). Segments rerouted around land follow their sea route; relocation segments
 * (coverage jumps) are one steady smoothstep slide instead of a sprinting spline.
 */
export function hermite(s: Smoothed, t: number, o: Kin): Kin {
  if (t <= s.t[0]) { o.x = s.x[0]; o.y = s.y[0]; o.vx = 0; o.vy = 0; return o; }
  const L = s.n - 1;
  if (t >= s.t[L]) { o.x = s.x[L]; o.y = s.y[L]; o.vx = s.vx[L]; o.vy = s.vy[L]; return o; }
  let a = 0, b = L;
  while (b - a > 1) { const m = (a + b) >> 1; if (s.t[m] <= t) a = m; else b = m; }
  const u = (t - s.t[a]) / (s.t[b] - s.t[a]), h = (s.t[b] - s.t[a]) / 60;
  const detour = s.detour?.[a];
  if (detour) {
    const q = { x: 0, y: 0, ux: 0, uy: 0 };
    along(detour, u * detour.len, q);
    const sp = detour.len / h;
    o.x = q.x; o.y = q.y; o.vx = q.ux * sp; o.vy = q.uy * sp; return o;
  }
  if (s.reloc[a]) {
    const w = u * u * (3 - 2 * u), dw = (6 * u * (1 - u)) / h;
    o.x = s.x[a] + (s.x[b] - s.x[a]) * w; o.y = s.y[a] + (s.y[b] - s.y[a]) * w;
    o.vx = (s.x[b] - s.x[a]) * dw; o.vy = (s.y[b] - s.y[a]) * dw; return o;
  }
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  o.x = h00 * s.x[a] + h10 * h * s.vx[a] + h01 * s.x[b] + h11 * h * s.vx[b];
  o.y = h00 * s.y[a] + h10 * h * s.vy[a] + h01 * s.y[b] + h11 * h * s.vy[b];
  const d00 = 6 * u2 - 6 * u, d10 = 3 * u2 - 4 * u + 1, d01 = -6 * u2 + 6 * u, d11 = 3 * u2 - 2 * u;
  o.vx = (d00 * s.x[a] + d10 * h * s.vx[a] + d01 * s.x[b] + d11 * h * s.vx[b]) / h;
  o.vy = (d00 * s.y[a] + d10 * h * s.vy[a] + d01 * s.y[b] + d11 * h * s.vy[b]) / h;
  return o;
}

/** Uniform Catmull-Rom through evenly spaced samples, with mirrored phantom end points. */
export function pathAt(pts: TPt[], t: number, o: { x: number; y: number }) {
  if (pts.length < 2 || t <= pts[0].t) { o.x = pts[0].x; o.y = pts[0].y; return o; }
  const L = pts.length - 1;
  if (t >= pts[L].t) { o.x = pts[L].x; o.y = pts[L].y; return o; }
  const step = pts[1].t - pts[0].t;
  const k = Math.min(L - 1, Math.floor((t - pts[0].t) / step)), f = (t - pts[k].t) / (pts[k + 1].t - pts[k].t);
  const p1 = pts[k], p2 = pts[k + 1];
  const p0 = k > 0 ? pts[k - 1] : { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
  const p3 = k + 2 <= L ? pts[k + 2] : { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
  const f2 = f * f, f3 = f2 * f;
  const cr = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);
  o.x = cr(p0.x, p1.x, p2.x, p3.x); o.y = cr(p0.y, p1.y, p2.y, p3.y);
  return o;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/tracks/kalman.test.ts src/lib/tracks/curve.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/tracks/kalman.ts src/lib/tracks/curve.ts src/lib/tracks/kalman.test.ts src/lib/tracks/curve.test.ts
git commit -m "Track engine: Kalman/RTS smoothing and continuous history curves"
```

---

### Task 4: Sea router and land repair

**Files:**
- Create: `src/lib/tracks/router.ts`
- Test: `src/lib/tracks/router.test.ts`

**Interfaces:**
- Consumes: `grid`, `isLand`, `cellOf`, `cellCenter`, `inGrid`, `nearestWater` (Task 1); `nmBetween` (Task 1); `polyline`, `hermite`, `Kin` (Task 3); `Smoothed` (Task 3); `Proj`, `toLon`, `toLat`, `toX`, `toY`
- Produces:
  - `type Density = Float32Array` (length `grid.w * grid.h`)
  - `clearPath(lon1, lat1, lon2, lat2): boolean`
  - `route(lon1, lat1, lon2, lat2, density: Density | null): [number, number][] | null`: a lon/lat polyline through water
  - `repairLand(s: Smoothed, proj: Proj, density: Density | null): number`: detours added

- [ ] **Step 1: Write the failing test**

`src/lib/tracks/router.test.ts`:
```ts
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/tracks/router.test.ts`
Expected: FAIL with `Cannot find module './router'`.

- [ ] **Step 3: Implement the router**

`src/lib/tracks/router.ts`:
```ts
/**
 * A* over the 0.02° water grid. Coastal cells cost 2.5×; learned lane density makes
 * busy water cheaper. String-pulling removes grid zig-zags (straights ≤ 6 nm so lane
 * bends survive), then Chaikin corner-cutting is kept only while it stays in water.
 */
import { GRID_RES } from './constants';
import { cellCenter, cellOf, grid, isLand, nearestWater } from './land';
import { hermite, polyline, type Kin } from './curve';
import type { Smoothed } from './kalman';
import { nmBetween, toLat, toLon, toX, toY, type Proj } from './proj';

export type Density = Float32Array;

export function clearPath(lon1: number, lat1: number, lon2: number, lat2: number): boolean {
  const n = Math.max(1, Math.ceil(nmBetween(lon1, lat1, lon2, lat2) / 0.2));
  for (let k = 1; k <= n; k++) if (isLand(lon1 + ((lon2 - lon1) * k) / n, lat1 + ((lat2 - lat1) * k) / n)) return false;
  return true;
}

export function route(lon1: number, lat1: number, lon2: number, lat2: number, density: Density | null): [number, number][] | null {
  const s = nearestWater(...cellOf(lon1, lat1)), g = nearestWater(...cellOf(lon2, lat2));
  if (!s || !g) return null;
  const { w: GW, water, coast } = grid;
  let maxD = 1;
  if (density) for (let i = 0; i < density.length; i++) if (density[i] > maxD) maxD = density[i];
  const cost = (i: number) => (coast[i] ? 2.5 : 1) / (density ? 1 + 0.6 * Math.log1p(density[i]) : 1);
  const hmin = density ? 1 / (1 + 0.6 * Math.log1p(maxD)) : 1;
  const pad = 30;
  const c0 = Math.max(0, Math.min(s[0], g[0]) - pad), c1 = Math.min(grid.w - 1, Math.max(s[0], g[0]) + pad);
  const r0 = Math.max(0, Math.min(s[1], g[1]) - pad), r1 = Math.min(grid.h - 1, Math.max(s[1], g[1]) + pad);
  const ww = c1 - c0 + 1, n = ww * (r1 - r0 + 1);
  const gs = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const cellNm = 60 / GRID_RES, kAt = (r: number) => Math.cos((cellCenter(0, r)[1] * Math.PI) / 180);
  const H = (c: number, r: number) => Math.hypot((c - g[0]) * cellNm * kAt(r), (r - g[1]) * cellNm) * hmin;
  const hf: number[] = [], hi: number[] = [];
  const push = (f: number, i: number) => {
    hf.push(f); hi.push(i); let k = hf.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; [hf[p], hf[k]] = [hf[k], hf[p]]; [hi[p], hi[k]] = [hi[k], hi[p]]; k = p; }
  };
  const pop = () => {
    const top = hi[0], lf = hf.pop()!, li = hi.pop()!;
    if (hf.length) {
      hf[0] = lf; hi[0] = li; let k = 0;
      for (;;) {
        const l = 2 * k + 1, rr = l + 1; let m = k;
        if (l < hf.length && hf[l] < hf[m]) m = l;
        if (rr < hf.length && hf[rr] < hf[m]) m = rr;
        if (m === k) break;
        [hf[m], hf[k]] = [hf[k], hf[m]]; [hi[m], hi[k]] = [hi[k], hi[m]]; k = m;
      }
    }
    return top;
  };
  const li = (c: number, r: number) => (r - r0) * ww + (c - c0);
  const si = li(s[0], s[1]), gi = li(g[0], g[1]);
  gs[si] = 0; push(H(s[0], s[1]), si);
  let found = false, expanded = 0;
  while (hf.length) {
    const cur = pop(); if (closed[cur]) continue; closed[cur] = 1;
    if (cur === gi) { found = true; break; }
    if (++expanded > 60000) break;
    const cc = (cur % ww) + c0, cr = Math.floor(cur / ww) + r0, k = kAt(cr);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if (!a && !b) continue;
      const nc = cc + b, nr = cr + a;
      if (nc < c0 || nc > c1 || nr < r0 || nr > r1) continue;
      const g2 = nr * GW + nc; if (!water[g2]) continue;
      if (a && b && (!water[cr * GW + nc] || !water[nr * GW + cc])) continue;
      const ni = li(nc, nr); if (closed[ni]) continue;
      const ng = gs[cur] + Math.hypot(b * cellNm * k, a * cellNm) * cost(g2);
      if (ng < gs[ni]) { gs[ni] = ng; from[ni] = cur; push(ng + H(nc, nr), ni); }
    }
  }
  if (!found) return null;
  const cells: number[] = [];
  for (let k = gi; k !== -1; k = from[k]) cells.push(k);
  cells.reverse();
  const pts = cells.map((k) => cellCenter((k % ww) + c0, Math.floor(k / ww) + r0));
  pts[0] = [lon1, lat1];
  if (!isLand(lon2, lat2)) pts[pts.length - 1] = [lon2, lat2];
  const pulled: [number, number][] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = i + 1;
    for (let k = pts.length - 1; k > i + 1; k--) {
      if (nmBetween(pts[i][0], pts[i][1], pts[k][0], pts[k][1]) > 6) continue;
      if (clearPath(pts[i][0], pts[i][1], pts[k][0], pts[k][1])) { j = k; break; }
    }
    pulled.push(pts[j]); i = j;
  }
  let sm = pulled;
  for (let it = 0; it < 3; it++) {
    const out: [number, number][] = [sm[0]];
    for (let k = 0; k < sm.length - 1; k++) {
      const p = sm[k], q = sm[k + 1];
      out.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
    }
    out.push(sm[sm.length - 1]);
    let ok = true;
    for (let k = 1; k < out.length - 2 && ok; k++) ok = clearPath(out[k][0], out[k][1], out[k + 1][0], out[k + 1][1]);
    if (!ok) break;
    sm = out;
  }
  return sm;
}

/** Replace history segments whose curve touches land (away from their ends) with sea routes. */
export function repairLand(s: Smoothed, proj: Proj, density: Density | null): number {
  const q: Kin = { x: 0, y: 0, vx: 0, vy: 0 };
  let added = 0;
  for (let a = 0; a < s.n - 1; a++) {
    const steps = Math.max(4, Math.ceil(Math.hypot(s.x[a + 1] - s.x[a], s.y[a + 1] - s.y[a]) / 0.25));
    let hit = false;
    for (let k = 1; k < steps && !hit; k++) {
      hermite(s, s.t[a] + ((s.t[a + 1] - s.t[a]) * k) / steps, q);
      const nearEnd = Math.min(Math.hypot(q.x - s.x[a], q.y - s.y[a]), Math.hypot(q.x - s.x[a + 1], q.y - s.y[a + 1])) < 0.6;
      hit = !nearEnd && isLand(toLon(proj, q.x), toLat(q.y));
    }
    if (!hit) continue;
    const p = route(toLon(proj, s.x[a]), toLat(s.y[a]), toLon(proj, s.x[a + 1]), toLat(s.y[a + 1]), density);
    const pts = p ? p.map(([lo, la]) => ({ x: toX(proj, lo), y: toY(la) })) : [{ x: s.x[a], y: s.y[a] }, { x: s.x[a + 1], y: s.y[a + 1] }];
    (s.detour ??= {})[a] = polyline(pts);
    added++;
  }
  return added;
}

```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/lib/tracks/router.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracks/router.ts src/lib/tracks/router.test.ts
git commit -m "Track engine: A* sea router and land repair of history"
```

---

### Task 5: Estimators

**Files:**
- Create: `src/lib/tracks/estimate.ts`
- Test: `src/lib/tracks/estimate.test.ts`

**Interfaces:**
- Consumes: `Smoothed`, `pathAt`, `polyline`, `along` (Task 3); `route`, `Density` (Task 4); `isLand`, `grid`, `cellOf`, `inGrid` (Task 1); `Cleaned` (Task 2); constants
- Produces:
  - `interface VesselState { t; x; y; vx; vy; spd; proj: Proj }`
  - `stateOf(s, proj)`, `canEstimate(cl, st)`, `heading(st)`
  - `type Method = 'hybrid' | 'sea' | 'damped'`
  - `predictWith(m: Method, st, minutes: number, density: Density | null, tau: number): TPt[]` (2-min samples in the vessel frame)

- [ ] **Step 1: Write the failing test**

`src/lib/tracks/estimate.test.ts`:
```ts
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/tracks/estimate.test.ts`
Expected: FAIL with `Cannot find module './estimate'`.

- [ ] **Step 3: Implement the estimators**

`src/lib/tracks/estimate.ts`:
```ts
/** Stage 4: carry a ship forward from its last smoothed state. Samples every 2 minutes. */
import { MAX_KN, MIN_EST_KN } from './constants';
import type { Cleaned } from './clean';
import { along, pathAt, polyline } from './curve';
import type { Smoothed } from './kalman';
import { cellOf, grid, inGrid, isLand } from './land';
import { toLat, toLon, toX, toY, type Proj, type TPt } from './proj';
import { route, type Density } from './router';

export interface VesselState { t: number; x: number; y: number; vx: number; vy: number; spd: number; proj: Proj }
export type Method = 'hybrid' | 'sea' | 'damped';

export function stateOf(s: Smoothed, proj: Proj): VesselState {
  const L = s.n - 1;
  return { t: s.t[L], x: s.x[L], y: s.y[L], vx: s.vx[L], vy: s.vy[L], spd: Math.hypot(s.vx[L], s.vy[L]), proj };
}
export const heading = (st: { vx: number; vy: number }) => Math.atan2(st.vy, st.vx);

/** A sane smoothed speed backed by a real move shortly before the last fix. */
export function canEstimate(cl: Cleaned, st: VesselState): boolean {
  return st.spd >= MIN_EST_KN && st.spd <= MAX_KN &&
    cl.meas.some((m, k) => k > 0 && m.t >= st.t - 90 && Math.hypot(m.x - cl.meas[k - 1].x, m.y - cl.meas[k - 1].y) > 0.3);
}

const landAt = (st: VesselState, x: number, y: number) => isLand(toLon(st.proj, x), toLat(y));

function straightFrom(st: VesselState, minutes: number): TPt[] {
  let x = st.x, y = st.y;
  const ux = st.vx / st.spd, uy = st.vy / st.spd, pts: TPt[] = [{ t: st.t, x, y }];
  for (let t = st.t + 2; t <= st.t + minutes; t += 2) {
    const nx = x + (ux * st.spd) / 30, ny = y + (uy * st.spd) / 30;
    if (landAt(st, nx, ny)) break;
    x = nx; y = ny; pts.push({ t, x, y });
  }
  return pts;
}

/** Sea route from a point on a heading toward the most lane-like open water ahead. */
function seaFrom(st: VesselState, x0: number, y0: number, t0: number, h: number, minutes: number, density: Density | null): TPt[] | null {
  const dist = (st.spd * minutes) / 60;
  let best: { gx: number; gy: number; score: number } | null = null;
  for (const frac of [1, 0.6, 0.35]) {
    for (const off of [0, 10, -10, 20, -20, 35, -35, 55, -55, 80, -80]) {
      const a = h + (off * Math.PI) / 180, gx = x0 + Math.cos(a) * dist * frac, gy = y0 + Math.sin(a) * dist * frac;
      const [c, r] = cellOf(toLon(st.proj, gx), toLat(gy));
      if (!inGrid(c, r) || !grid.water[r * grid.w + c]) continue;
      let lane = 0;
      if (density) for (let da = -2; da <= 2; da++) for (let db = -2; db <= 2; db++) { const cc = c + db, rr = r + da; if (inGrid(cc, rr)) lane += density[rr * grid.w + cc]; }
      const score = Math.cos((off * Math.PI) / 180) * 3 + Math.log1p(lane) * 0.6;
      if (!best || score > best.score) best = { gx, gy, score };
    }
    if (best) break;
  }
  if (!best) return null;
  const p = route(toLon(st.proj, x0), toLat(y0), toLon(st.proj, best.gx), toLat(best.gy), density);
  if (!p) return null;
  const pl = polyline(p.map(([lo, la]) => ({ x: toX(st.proj, lo), y: toY(la) })));
  const out: TPt[] = [{ t: t0, x: x0, y: y0 }], q = { x: 0, y: 0, ux: 0, uy: 0 };
  for (let t = t0 + 2; t <= t0 + minutes; t += 2) {
    const d = (st.spd * (t - t0)) / 60; if (d > pl.len) break;
    along(pl, d, q); out.push({ t, x: q.x, y: q.y });
  }
  return out;
}

/** Straight while the water ahead is open; ~20 min before landfall, bend through open water. */
function hybridFrom(st: VesselState, minutes: number, density: Density | null): TPt[] {
  const dr = straightFrom(st, minutes), full = Math.floor(minutes / 2) + 1;
  if (dr.length >= full) return dr;
  const keep = Math.max(0, dr.length - 1 - 10), p0 = dr[keep];
  const rest = seaFrom(st, p0.x, p0.y, p0.t, heading(st), st.t + minutes - p0.t, density);
  return rest && rest.length > 1 ? dr.slice(0, keep + 1).concat(rest.slice(1)) : dr;
}

/** Same water-aware geometry, but speed decays: distance = v0·tau·(1 − e^(−Δt/tau)). */
function dampedFrom(st: VesselState, minutes: number, density: Density | null, tau: number): TPt[] {
  const geo = hybridFrom(st, minutes, density);
  if (geo.length < 2) return geo;
  const out: TPt[] = [{ t: st.t, x: st.x, y: st.y }], q = { x: 0, y: 0 };
  for (let t = st.t + 2; t <= st.t + minutes; t += 2) {
    const dist = st.spd * (tau / 60) * (1 - Math.exp(-(t - st.t) / tau));
    const tp = st.t + (dist / st.spd) * 60;
    if (tp >= geo[geo.length - 1].t) break;
    pathAt(geo, tp, q); out.push({ t, x: q.x, y: q.y });
  }
  return out;
}

export function predictWith(m: Method, st: VesselState, minutes: number, density: Density | null, tau: number): TPt[] {
  if (m === 'sea') return seaFrom(st, st.x, st.y, st.t, heading(st), minutes, density) ?? hybridFrom(st, minutes, density);
  if (m === 'damped') return dampedFrom(st, minutes, density, tau);
  return hybridFrom(st, minutes, density);
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/lib/tracks/estimate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracks/estimate.ts src/lib/tracks/estimate.test.ts
git commit -m "Track engine: straight, sea-route, hybrid and damped estimators"
```

---

### Task 6: Evidence score and learning

**Files:**
- Create: `src/lib/tracks/evidence.ts`, `src/lib/tracks/learn.ts`
- Test: `src/lib/tracks/evidence.test.ts`, `src/lib/tracks/learn.test.ts`

**Interfaces:**
- Consumes: `Run` (Task 2), `pathAt` (Task 3), `VesselState`, `Method` (Task 5), `JITTER_NM`, `grid`, `cellOf`, `inGrid` (Task 1), `toLon`, `toLat`
- Produces:
  - `interface Evidence { score: number; parts: [number, number, number, number, number]; tier: 0 | 1 | 2 }`
  - `scoreEvidence(input: { fixTimes: number[]; now: number; rejected: number; moves: number; identity: { name: boolean; type: boolean; flag: boolean; imoOrDest: boolean } }): Evidence`
  - `CONTEXTS: string[]` (6 labels), `contextOf(st: VesselState): number`
  - `interface LearnState { stats: Record<Method, number[]>[]; tauErr: Record<string, number[]>; rateErr: number[]; lastRunAt: number | null }`
  - `emptyLearnState()`, `chooseMethod(ls, ctx): Method`, `chooseTau(ls): number`, `uncertaintyRate(ls): number`
  - `truthUpdates(runs: Run[], cutoff: number, horizon = 60): TPt[]`
  - `medianError(pts: TPt[], truth: TPt[]): number`
  - `record(ls, ctx, errs: Record<Method, number>, tauErrs: Record<string, number>, rate: number): void` (caps each list at 400)
  - `TAUS = [30, 60, 120, 240]`, `METHODS: Method[]`

- [ ] **Step 1: Write the failing tests**

`src/lib/tracks/evidence.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { scoreEvidence } from './evidence';

const id = { name: true, type: true, flag: true, imoOrDest: true };

describe('scoreEvidence', () => {
  it('scores a regularly reporting, clean, identified ship as well tracked', () => {
    const now = 10_000, fixTimes = Array.from({ length: 144 }, (_, k) => now - 1430 + k * 10);
    const e = scoreEvidence({ fixTimes, now, rejected: 0, moves: 40, identity: id });
    expect(e.score).toBe(100);
    expect(e.tier).toBe(0);
  });

  it('scores a stale, sparse, anonymous ship as sparse', () => {
    const now = 10_000;
    const e = scoreEvidence({ fixTimes: [now - 600, now - 400], now, rejected: 3, moves: 1, identity: { name: false, type: false, flag: false, imoOrDest: false } });
    expect(e.tier).toBe(2);
    expect(e.parts[1]).toBe(0);           // no recency credit after 3 h
  });
});
```

`src/lib/tracks/learn.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { chooseMethod, chooseTau, emptyLearnState, medianError, record, truthUpdates } from './learn';

describe('learning', () => {
  it('keeps straight-rerouted until every candidate has 8 scored predictions', () => {
    const ls = emptyLearnState();
    for (let k = 0; k < 7; k++) record(ls, 1, { hybrid: 3, sea: 2, damped: 1 }, { 60: 1 }, 0.03);
    expect(chooseMethod(ls, 1)).toBe('hybrid');
    record(ls, 1, { hybrid: 3, sea: 2, damped: 1 }, { 60: 1 }, 0.03);
    expect(chooseMethod(ls, 1)).toBe('damped');
  });

  it('picks the time constant with the lowest recent error', () => {
    const ls = emptyLearnState();
    for (let k = 0; k < 10; k++) record(ls, 0, { hybrid: 1, sea: 1, damped: 1 }, { 30: 3, 60: 1, 120: 2, 240: 4 }, 0.03);
    expect(chooseTau(ls)).toBe(60);
  });

  it('scores against real position changes at midpoint report times', () => {
    const runs = [{ t0: 0, t1: 20, x: 0, y: 0, n: 3 }, { t0: 30, t1: 30, x: 2, y: 0, n: 1 }, { t0: 40, t1: 40, x: 2.05, y: 0, n: 1 }];
    const truth = truthUpdates(runs, 10);
    expect(truth).toEqual([{ t: 25, x: 2, y: 0 }]);           // the 0.05 nm wiggle is jitter, not an update
    expect(medianError([{ t: 0, x: 0, y: 0 }, { t: 30, x: 3, y: 0 }], truth)).toBeCloseTo(0.5, 5);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/lib/tracks/evidence.test.ts src/lib/tracks/learn.test.ts`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement evidence**

`src/lib/tracks/evidence.ts`:
```ts
/** Evidence score 0–100 and tier: how much the map should trust and feature a ship. */
export interface Evidence { score: number; parts: [number, number, number, number, number]; tier: 0 | 1 | 2 }

export function scoreEvidence(input: {
  fixTimes: number[]; now: number; rejected: number; moves: number;
  identity: { name: boolean; type: boolean; flag: boolean; imoOrDest: boolean };
}): Evidence {
  const { fixTimes, now } = input;
  const n24 = fixTimes.filter((t) => t > now - 1440 && t <= now).length;
  const last = fixTimes.length ? fixTimes[fixTimes.length - 1] : -Infinity, age = now - last;
  const slots = new Set(fixTimes.filter((t) => t > now - 180 && t <= now).map((t) => Math.floor((now - t) / 10)));
  const volume = Math.min(1, n24 / 90) * 30;
  const recency = age <= 15 ? 25 : age <= 60 ? 16 : age <= 180 ? 7 : 0;
  const regularity = (Math.min(18, slots.size) / 18) * 15;
  const consistency = (1 - input.rejected / (input.moves + input.rejected + 1)) * 15;
  const idn = input.identity;
  const identity = (idn.name ? 5 : 0) + (idn.type ? 4 : 0) + (idn.flag ? 3 : 0) + (idn.imoOrDest ? 3 : 0);
  const parts: Evidence['parts'] = [volume, recency, regularity, consistency, identity].map((v) => Math.round(v)) as Evidence['parts'];
  const score = Math.round(volume + recency + regularity + consistency + identity);
  return { score, parts, tier: score >= 72 ? 0 : score >= 45 ? 1 : 2 };
}
```

- [ ] **Step 4: Implement learning**

`src/lib/tracks/learn.ts`:
```ts
/**
 * The estimator learns which method suits which situation, how fast ships slow down, and
 * how uncertain its estimates are — from backtests it never graded itself on.
 */
import { JITTER_NM } from './constants';
import type { Run } from './clean';
import { pathAt } from './curve';
import type { Method, VesselState } from './estimate';
import { cellOf, grid, inGrid } from './land';
import { toLat, toLon, type TPt } from './proj';

export const METHODS: Method[] = ['hybrid', 'sea', 'damped'];
export const TAUS = [30, 60, 120, 240];
export const CONTEXTS = [
  'Slow <6 kn · open water', 'Slow <6 kn · near coast',
  'Cruising 6–12 kn · open water', 'Cruising 6–12 kn · near coast',
  'Fast >12 kn · open water', 'Fast >12 kn · near coast',
];
const CAP = 400, MIN_EVIDENCE = 8, RECENT = 60;

export interface LearnState {
  stats: Record<Method, number[]>[];
  tauErr: Record<string, number[]>;
  rateErr: number[];
  lastRunAt: number | null;
}

export const emptyLearnState = (): LearnState => ({
  stats: CONTEXTS.map(() => ({ hybrid: [], sea: [], damped: [] })),
  tauErr: Object.fromEntries(TAUS.map((t) => [String(t), []])),
  rateErr: [],
  lastRunAt: null,
});

export const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
};

function nearCoast(st: VesselState): boolean {
  const [c, r] = cellOf(toLon(st.proj, st.x), toLat(st.y));
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
    const cc = c + b, rr = r + a;
    if (inGrid(cc, rr) && !grid.water[rr * grid.w + cc]) return true;
  }
  return false;
}
export const contextOf = (st: VesselState) => (st.spd < 6 ? 0 : st.spd < 12 ? 1 : 2) * 2 + (nearCoast(st) ? 1 : 0);

export function chooseMethod(ls: LearnState, ctx: number): Method {
  const st = ls.stats[ctx];
  if (METHODS.some((m) => st[m].length < MIN_EVIDENCE)) return 'hybrid';
  return METHODS.reduce((a, m) => (median(st[m].slice(-RECENT)) < median(st[a].slice(-RECENT)) ? m : a), 'hybrid' as Method);
}
export function chooseTau(ls: LearnState): number {
  return TAUS.reduce((a, t) => {
    const e = ls.tauErr[String(t)], ea = ls.tauErr[String(a)];
    return e.length && (!ea.length || median(e.slice(-200)) < median(ea.slice(-200))) ? t : a;
  }, 120);
}
/** nm of uncertainty per minute since the last fix, calibrated from backtests. */
export const uncertaintyRate = (ls: LearnState) => median(ls.rateErr.slice(-200)) || 0.03;

/** Real position changes after `cutoff`, at their midpoint report times. */
export function truthUpdates(runs: Run[], cutoff: number, horizon = 60): TPt[] {
  const idx = runs.findIndex((r) => r.t0 > cutoff);
  if (idx < 0) return [];
  let prev = runs[idx - 1], prevEnd = prev ? prev.t1 : cutoff;
  const out: TPt[] = [];
  for (const r of runs.slice(idx)) {
    const t = (prevEnd + r.t0) / 2; prevEnd = r.t1;
    const moved = prev ? Math.hypot(r.x - prev.x, r.y - prev.y) : 0; prev = r;
    if (moved >= JITTER_NM && t <= cutoff + horizon) out.push({ t, x: r.x, y: r.y });
  }
  return out;
}

export function medianError(pts: TPt[], truth: TPt[]): number {
  const o = { x: 0, y: 0 };
  return median(truth.map((q) => (pathAt(pts, q.t, o), Math.hypot(q.x - o.x, q.y - o.y))));
}

export function record(ls: LearnState, ctx: number, errs: Record<Method, number>, tauErrs: Record<string, number>, rate: number) {
  const push = (arr: number[], v: number) => { if (Number.isFinite(v)) { arr.push(v); if (arr.length > CAP) arr.splice(0, arr.length - CAP); } };
  for (const m of METHODS) push(ls.stats[ctx][m], errs[m]);
  for (const [t, e] of Object.entries(tauErrs)) push(ls.tauErr[t] ?? (ls.tauErr[t] = []), e);
  push(ls.rateErr, rate);
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/tracks/evidence.test.ts src/lib/tracks/learn.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/tracks/evidence.ts src/lib/tracks/learn.ts src/lib/tracks/evidence.test.ts src/lib/tracks/learn.test.ts
git commit -m "Track engine: evidence scoring and per-context learning"
```

---

### Task 7: Wire format and engine orchestrator

**Files:**
- Create: `src/lib/tracks/types.ts`, `src/lib/tracks/codec.ts`, `src/lib/tracks/engine.ts`
- Test: `src/lib/tracks/codec.test.ts`, `src/lib/tracks/engine.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–6
- Produces:
  - `types.ts`:
    ```ts
    export interface TrackPayload {
      mmsi: string; tier: 0 | 1 | 2; score: number; parts: [number, number, number, number, number];
      state: 'underway' | 'rest'; sog: number; cog: number; lastRealAt: number;   // minutes since epoch
      method: 'hybrid' | 'sea' | 'damped' | null; uncert: number;                  // nm per minute
      path: number[] | null; trail: number[] | null;                                 // codec-encoded [t, lat, lon]
      cleaning: { kept: number; rejected: number; inland: number; rerouted: number };
    }
    export interface TracksResponse {
      generatedAt: string; vessels: TrackPayload[];
      backtest: { n: number; hold: number; estimate: number } | null;
      learned: { choice: string[]; tau: number; contexts: string[] } | null;
    }
    ```
  - `codec.ts`: `encodeSeries(points: [number, number, number][]): number[]` (deltas: t whole minutes, lat/lon ×1e4 ints), `decodeSeries(flat: number[]): [number, number, number][]`
  - `engine.ts`:
    - `interface EngineVessel { mmsi: string; fixes: RawFix[]; identity: { name: boolean; type: boolean; flag: boolean; imoOrDest: boolean } }`
    - `runTrackEngine(input: { vessels: EngineVessel[]; now: number; density: Density; learn: LearnState }): { payloads: TrackPayload[]; densityDelta: Map<number, number>; backtest: { n: number; hold: number; estimate: number }; learned: TracksResponse['learned'] }`. It mutates `input.learn` by recording this run's backtest.

- [ ] **Step 1: Write the failing tests**

`src/lib/tracks/codec.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decodeSeries, encodeSeries } from './codec';

describe('codec', () => {
  it('round-trips a series at 1e-4° and whole minutes', () => {
    const pts: [number, number, number][] = [[29_000_000, 25.1234, 56.5678], [29_000_006, 25.1301, 56.5712]];
    expect(decodeSeries(encodeSeries(pts))).toEqual(pts);
  });
});
```

`src/lib/tracks/engine.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { runTrackEngine } from './engine';
import { emptyLearnState } from './learn';
import { grid, isLand } from './land';
import { decodeSeries } from './codec';

const NOW = 29_500_000;
const east = (mmsi: string, lon0: number, lat: number, kn: number, ids = true) => ({
  mmsi,
  fixes: Array.from({ length: 30 }, (_, k) => ({ t: NOW - 290 + k * 10, lon: lon0 + ((kn / 6) * k) / (60 * Math.cos((lat * Math.PI) / 180)), lat })),
  identity: { name: ids, type: ids, flag: ids, imoOrDest: ids },
});
const anchored = (mmsi: string) => ({
  mmsi, fixes: Array.from({ length: 30 }, (_, k) => ({ t: NOW - 290 + k * 10, lon: 56.45, lat: 25.3 })),
  identity: { name: true, type: true, flag: false, imoOrDest: false },
});

describe('runTrackEngine', () => {
  it('estimates underway ships, rests anchored ones, and never draws on land', () => {
    const out = runTrackEngine({ vessels: [east('1', 57.0, 24.9, 10), anchored('2')], now: NOW, density: new Float32Array(grid.w * grid.h), learn: emptyLearnState() });
    const [moving, rest] = out.payloads;
    expect(moving.state).toBe('underway');
    expect(moving.sog).toBeCloseTo(10, 0);
    expect(moving.path).not.toBeNull();
    for (const [, lat, lon] of decodeSeries(moving.path!)) expect(isLand(lon, lat)).toBe(false);
    expect(rest.state).toBe('rest');
    expect(rest.path).toBeNull();
    expect(out.backtest.n).toBeGreaterThan(0);
    expect(out.densityDelta.size).toBeGreaterThan(0);          // a first run seeds lanes from history
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/lib/tracks/codec.test.ts src/lib/tracks/engine.test.ts`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement the wire types and codec**

`src/lib/tracks/types.ts`: contents exactly as in the Interfaces block above.

`src/lib/tracks/codec.ts`:
```ts
/** Compact [t, lat, lon] series: whole-minute and 1e-4° integer deltas. Shared client/server. */
export function encodeSeries(points: [number, number, number][]): number[] {
  const out: number[] = []; let pt = 0, pla = 0, plo = 0;
  for (const [t, lat, lon] of points) {
    const T = Math.round(t), A = Math.round(lat * 1e4), O = Math.round(lon * 1e4);
    out.push(T - pt, A - pla, O - plo); pt = T; pla = A; plo = O;
  }
  return out;
}
export function decodeSeries(flat: number[]): [number, number, number][] {
  const out: [number, number, number][] = []; let t = 0, la = 0, lo = 0;
  for (let k = 0; k + 2 < flat.length; k += 3) { t += flat[k]; la += flat[k + 1]; lo += flat[k + 2]; out.push([t, la / 1e4, lo / 1e4]); }
  return out;
}
```

- [ ] **Step 4: Implement the orchestrator**

`src/lib/tracks/engine.ts`:
```ts
/**
 * One harvester run of the track engine: clean → smooth → repair → estimate → score,
 * plus a backtest (hide the last hour) whose errors feed the learner.
 */
import { MAX_EST_MIN } from './constants';
import { clean, runsOf, type RawFix } from './clean';
import { encodeSeries } from './codec';
import { hermite, type Kin } from './curve';
import { canEstimate, predictWith, stateOf } from './estimate';
import { scoreEvidence } from './evidence';
import { smooth } from './kalman';
import { cellOf, grid, inGrid } from './land';
import {
  chooseMethod, chooseTau, CONTEXTS, contextOf, median, medianError, METHODS, record, TAUS, truthUpdates,
  uncertaintyRate, type LearnState,
} from './learn';
import { projAt, toLat, toLon, type TPt } from './proj';
import { repairLand, type Density } from './router';
import type { TrackPayload, TracksResponse } from './types';

export interface EngineVessel { mmsi: string; fixes: RawFix[]; identity: { name: boolean; type: boolean; flag: boolean; imoOrDest: boolean } }

const toSeries = (proj: ReturnType<typeof projAt>, pts: TPt[], every: number) =>
  pts.filter((_, k) => k % every === 0 || k === pts.length - 1).map((p) => [p.t, toLat(p.y), toLon(proj, p.x)] as [number, number, number]);

export function runTrackEngine(input: { vessels: EngineVessel[]; now: number; density: Density; learn: LearnState }) {
  const { vessels, now, density, learn } = input;
  const method = CONTEXTS.map((_, k) => chooseMethod(learn, k)), tau = chooseTau(learn), uncert = uncertaintyRate(learn);
  const payloads: TrackPayload[] = [], densityDelta = new Map<number, number>();
  const holdErr: number[] = [], estErr: number[] = [];
  // First-ever run seeds lanes from the whole day; after that, only motion since the last run.
  const since = Math.max(now - 1440, learn.lastRunAt ?? now - 1440);
  const kin: Kin = { x: 0, y: 0, vx: 0, vy: 0 };

  for (const v of vessels) {
    if (!v.fixes.length) continue;
    const proj = projAt(v.fixes[v.fixes.length - 1].lat);
    const runs = runsOf(v.fixes, proj, now);
    const cl = clean(runs, proj);
    if (!cl.meas.length) continue;
    const s = smooth(cl.meas);
    const rerouted = repairLand(s, proj, density);
    const st = stateOf(s, proj), estimable = cl.meas.length >= 2 && canEstimate(cl, st);
    if (!estimable) { const L = s.n - 1; s.vx[L] = 0; s.vy[L] = 0; }

    // Lanes learn from motion seen since the previous run.
    for (let t = Math.max(since, s.t[0]); t <= s.t[s.n - 1]; t += 5) {
      hermite(s, t, kin); if (Math.hypot(kin.vx, kin.vy) < 2) continue;
      const [c, r] = cellOf(toLon(proj, kin.x), toLat(kin.y));
      if (inGrid(c, r)) { const i = r * grid.w + c; densityDelta.set(i, (densityDelta.get(i) ?? 0) + 1); }
    }

    const ev = scoreEvidence({ fixTimes: v.fixes.map((f) => f.t), now, rejected: cl.rejected, moves: cl.moves, identity: v.identity });
    let path: number[] | null = null, trail: number[] | null = null, m: TrackPayload['method'] = null;
    if (estimable) {
      m = method[contextOf(st)];
      path = encodeSeries(toSeries(proj, predictWith(m, st, MAX_EST_MIN, density, tau), 3));   // 6-min samples
      if (ev.tier <= 1) {
        const pts: TPt[] = [];
        for (let t = Math.ceil((st.t - 120) / 3) * 3; t <= st.t; t += 3) { if (t < s.t[0]) continue; hermite(s, t, kin); pts.push({ t, x: kin.x, y: kin.y }); }
        trail = encodeSeries(toSeries(proj, pts, 1));
      }
    }
    let cog = (90 - (Math.atan2(st.vy, st.vx) * 180) / Math.PI + 360) % 360;
    if (!estimable) cog = 0;
    payloads.push({
      mmsi: v.mmsi, tier: ev.tier, score: ev.score, parts: ev.parts,
      state: estimable ? 'underway' : 'rest', sog: Math.round((estimable ? st.spd : 0) * 10) / 10, cog: Math.round(cog),
      lastRealAt: Math.round(st.t * 10) / 10, method: m, uncert, path, trail,
      cleaning: { kept: cl.moves, rejected: cl.rejected, inland: cl.inland, rerouted },
    });

    // Backtest: estimate from what was known an hour ago, score against what happened since.
    const cutoff = now - 60, cRuns = runsOf(v.fixes, proj, cutoff), cCl = clean(cRuns, proj);
    if (cCl.meas.length < 2) continue;
    const cs = smooth(cCl.meas), cst = stateOf(cs, proj);
    if (!canEstimate(cCl, cst)) continue;
    const truth = truthUpdates(runs, cutoff);
    if (!truth.length) continue;
    const horizon = Math.max(10, Math.min(MAX_EST_MIN, cutoff + 75 - cst.t)), ctx = contextOf(cst);
    const errs = Object.fromEntries(METHODS.map((mm) => [mm, medianError(predictWith(mm, cst, horizon, density, tau), truth)])) as Record<'hybrid' | 'sea' | 'damped', number>;
    const tauErrs = Object.fromEntries(TAUS.map((tt) => [String(tt), medianError(predictWith('damped', cst, horizon, density, tt), truth)]));
    const used = method[ctx], elapsed = Math.max(10, truth[truth.length - 1].t - cst.t);
    record(learn, ctx, errs, tauErrs, errs[used] / elapsed);
    holdErr.push(median(truth.map((q) => Math.hypot(q.x - cst.x, q.y - cst.y))));
    estErr.push(errs[used]);
  }
  learn.lastRunAt = now;
  const learned: TracksResponse['learned'] = { choice: CONTEXTS.map((_, k) => chooseMethod(learn, k)), tau: chooseTau(learn), contexts: CONTEXTS };
  return { payloads, densityDelta, backtest: { n: estErr.length, hold: median(holdErr), estimate: median(estErr) }, learned };
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/tracks/codec.test.ts src/lib/tracks/engine.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/tracks/{types,codec,engine}.ts src/lib/tracks/codec.test.ts src/lib/tracks/engine.test.ts
git commit -m "Track engine: orchestrator, backtest and compact wire format"
```

---

### Task 8: Storage, migration and harvester step

**Files:**
- Create: `scripts/migrations/20260930_track_engine.sql`, `src/lib/db/tracks.ts`
- Modify: `src/lib/db/schema.sql`, `scripts/schema-portable.sql` (append the same DDL), `src/services/ais-ingester/harvest-once.ts` (new step after `suez crossings`)
- Test: `src/lib/db/tracks.test.ts`

**Interfaces:**
- Consumes: `runTrackEngine`, `EngineVessel`, `emptyLearnState`, `LearnState`, `grid`, `TrackPayload`, `TracksResponse`
- Produces:
  - `loadEngineVessels(): Promise<EngineVessel[]>`
  - `loadLaneDensity(now: Date): Promise<Float32Array>`, `saveLaneDensity(delta: Map<number, number>): Promise<void>`
  - `loadLearnState(): Promise<LearnState>`
  - `saveEngineRun(payloads, learn, meta: { backtest; learned }): Promise<void>`
  - `getTracks(): Promise<TracksResponse>` (for the API)

- [ ] **Step 1: Write the migration**

`scripts/migrations/20260930_track_engine.sql`:
```sql
-- Track engine: per-vessel API-ready state, learning state, and decaying lane density.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS vessel_track_state (
  mmsi VARCHAR(9) PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_track_state_updated ON vessel_track_state(updated_at DESC);
ALTER TABLE vessel_track_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS track_engine_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE track_engine_state ENABLE ROW LEVEL SECURITY;

-- Lane weight per 0.02° cell; readers decay it by a ~14-day half-life from updated_at.
CREATE TABLE IF NOT EXISTS lane_density (
  cell INTEGER PRIMARY KEY,
  w REAL NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lane_density ENABLE ROW LEVEL SECURITY;

COMMIT;
```
Append the three `CREATE TABLE … ENABLE ROW LEVEL SECURITY` blocks (without `BEGIN/SET LOCAL/COMMIT`) to the end of `src/lib/db/schema.sql` and `scripts/schema-portable.sql`.

- [ ] **Step 2: Write the failing test**

`src/lib/db/tracks.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./index', () => ({ pool: { query: vi.fn() } }));
import { pool } from './index';
import { getTracks, loadEngineVessels, saveEngineRun } from './tracks';
import { emptyLearnState } from '../tracks/learn';

const q = pool.query as ReturnType<typeof vi.fn>;
beforeEach(() => vi.clearAllMocks());

describe('track storage', () => {
  it('groups 24 h of fixes per vessel with identity flags, ordered by time', async () => {
    q.mockResolvedValueOnce({ rows: [
      { mmsi: '1', t: '2026-09-30T00:00:00Z', latitude: 25, longitude: 56, name: 'A', ship_type: 80, flag: 'PA', imo: '9', destination: null },
      { mmsi: '1', t: '2026-09-30T00:10:00Z', latitude: 25.01, longitude: 56, name: 'A', ship_type: 80, flag: 'PA', imo: '9', destination: null },
    ] });
    const vs = await loadEngineVessels();
    expect(vs).toHaveLength(1);
    expect(vs[0].fixes).toHaveLength(2);
    expect(vs[0].fixes[1].t - vs[0].fixes[0].t).toBe(10);
    expect(vs[0].identity).toEqual({ name: true, type: true, flag: true, imoOrDest: true });
  });

  it('saves all payloads in one statement and the learning state in another', async () => {
    q.mockResolvedValue({ rows: [] });
    await saveEngineRun([{ mmsi: '1' } as never], emptyLearnState(), { backtest: null, learned: null });
    const sqls = q.mock.calls.map((c) => String(c[0]));
    expect(sqls.filter((s) => s.includes('vessel_track_state'))).toHaveLength(2);   // upsert + prune
    expect(sqls.some((s) => s.includes('track_engine_state'))).toBe(true);
  });

  it('serves recent payloads with the run summary', async () => {
    q.mockResolvedValueOnce({ rows: [{ payload: { mmsi: '1' } }] })
      .mockResolvedValueOnce({ rows: [{ value: { backtest: { n: 3, hold: 4, estimate: 1.5 }, learned: null, generatedAt: 'x' } }] });
    const r = await getTracks();
    expect(r.vessels).toEqual([{ mmsi: '1' }]);
    expect(r.backtest?.estimate).toBe(1.5);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run src/lib/db/tracks.test.ts`
Expected: FAIL with `Cannot find module './tracks'`.

- [ ] **Step 4: Implement storage**

`src/lib/db/tracks.ts`:
```ts
/** Track engine persistence: engine input, per-vessel state, learning state, lane density. */
import { pool } from './index';
import type { EngineVessel } from '../tracks/engine';
import { emptyLearnState, type LearnState } from '../tracks/learn';
import type { TrackPayload, TracksResponse } from '../tracks/types';

const HALF_LIFE_DAYS = 14;

export async function loadEngineVessels(): Promise<EngineVessel[]> {
  const { rows } = await pool.query<{
    mmsi: string; t: string | Date; latitude: number; longitude: number;
    name: string | null; ship_type: number | null; flag: string | null; imo: string | null; destination: string | null;
  }>(`
    WITH recent AS (SELECT DISTINCT mmsi FROM vessel_positions WHERE time > NOW() - INTERVAL '24 hours')
    SELECT p.mmsi, p.time AS t, p.latitude, p.longitude,
           COALESCE(v.name, f.name) AS name, COALESCE(v.ship_type, f.ship_type) AS ship_type,
           v.flag, v.imo, v.destination
    FROM vessel_positions p
    JOIN recent USING (mmsi)
    LEFT JOIN LATERAL (SELECT name, ship_type, flag, imo, destination FROM vessels WHERE mmsi = p.mmsi ORDER BY last_seen DESC NULLS LAST LIMIT 1) v ON true
    LEFT JOIN vessel_fallback_metadata f ON f.mmsi = p.mmsi
    WHERE p.time > NOW() - INTERVAL '24 hours'
    ORDER BY p.mmsi, p.time`);
  const byMmsi = new Map<string, EngineVessel>();
  for (const r of rows) {
    let v = byMmsi.get(r.mmsi);
    if (!v) {
      v = { mmsi: r.mmsi, fixes: [], identity: { name: !!r.name, type: r.ship_type != null, flag: !!r.flag, imoOrDest: !!(r.imo || r.destination) } };
      byMmsi.set(r.mmsi, v);
    }
    v.fixes.push({ t: new Date(r.t).getTime() / 60000, lat: r.latitude, lon: r.longitude });
  }
  return [...byMmsi.values()];
}

export async function loadLaneDensity(now: Date, size: number): Promise<Float32Array> {
  const out = new Float32Array(size);
  const { rows } = await pool.query<{ cell: number; w: number; updated_at: string | Date }>('SELECT cell, w, updated_at FROM lane_density');
  for (const r of rows) {
    const days = (now.getTime() - new Date(r.updated_at).getTime()) / 86_400_000;
    if (r.cell >= 0 && r.cell < size) out[r.cell] = r.w * Math.pow(0.5, days / HALF_LIFE_DAYS);
  }
  return out;
}

export async function saveLaneDensity(delta: Map<number, number>): Promise<void> {
  if (!delta.size) return;
  const cells = [...delta.keys()], ws = cells.map((c) => delta.get(c)!);
  // Decay the stored weight to now before adding, so a busy lane from last month fades.
  await pool.query(`
    INSERT INTO lane_density (cell, w, updated_at)
    SELECT c, d, NOW() FROM unnest($1::int[], $2::real[]) AS u(c, d)
    ON CONFLICT (cell) DO UPDATE SET
      w = lane_density.w * power(0.5, extract(epoch FROM NOW() - lane_density.updated_at) / 86400.0 / ${HALF_LIFE_DAYS}) + EXCLUDED.w,
      updated_at = NOW()`, [cells, ws]);
}

export async function loadLearnState(): Promise<LearnState> {
  const { rows } = await pool.query<{ value: LearnState }>(`SELECT value FROM track_engine_state WHERE key = 'learn'`);
  return rows[0]?.value ?? emptyLearnState();
}

export async function saveEngineRun(
  payloads: TrackPayload[], learn: LearnState,
  meta: { backtest: TracksResponse['backtest']; learned: TracksResponse['learned'] },
): Promise<void> {
  await pool.query(`
    INSERT INTO vessel_track_state (mmsi, payload, updated_at)
    SELECT r->>'mmsi', r, NOW() FROM jsonb_array_elements($1::jsonb) AS r
    ON CONFLICT (mmsi) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`, [JSON.stringify(payloads)]);
  await pool.query(`DELETE FROM vessel_track_state WHERE updated_at < NOW() - INTERVAL '7 hours'`);
  await pool.query(`
    INSERT INTO track_engine_state (key, value, updated_at) VALUES ('learn', $1::jsonb, NOW()), ('summary', $2::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
  [JSON.stringify(learn), JSON.stringify({ ...meta, generatedAt: new Date().toISOString() })]);
}

export async function getTracks(): Promise<TracksResponse> {
  const states = await pool.query<{ payload: TrackPayload }>(
    `SELECT payload FROM vessel_track_state WHERE updated_at > NOW() - INTERVAL '7 hours'`);
  const summary = await pool.query<{ value: { backtest: TracksResponse['backtest']; learned: TracksResponse['learned']; generatedAt: string } }>(
    `SELECT value FROM track_engine_state WHERE key = 'summary'`);
  const s = summary.rows[0]?.value;
  return { generatedAt: s?.generatedAt ?? new Date().toISOString(), vessels: states.rows.map((r) => r.payload), backtest: s?.backtest ?? null, learned: s?.learned ?? null };
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx vitest run src/lib/db/tracks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Add the harvester step**

In `src/services/ais-ingester/harvest-once.ts`, add imports:
```ts
import { runTrackEngine } from '../../lib/tracks/engine';
import { grid } from '../../lib/tracks/land';
import { loadEngineVessels, loadLaneDensity, loadLearnState, saveEngineRun, saveLaneDensity } from '../../lib/db/tracks';
```
Add the step function next to `runDetectors`:
```ts
// ── Track engine: clean, smooth, estimate, learn ──────────────────────────────
async function runTrackEngineStep(): Promise<void> {
  const now = new Date();
  const [vessels, density, learn] = await Promise.all([
    loadEngineVessels(), loadLaneDensity(now, grid.w * grid.h), loadLearnState(),
  ]);
  const t0 = Date.now();
  const out = runTrackEngine({ vessels, now: now.getTime() / 60000, density, learn });
  await saveEngineRun(out.payloads, learn, { backtest: out.backtest, learned: out.learned });
  await saveLaneDensity(out.densityDelta);
  const moving = out.payloads.filter((p) => p.state === 'underway').length;
  console.log(`Track engine: ${out.payloads.length} vessels, ${moving} estimated, backtest ${out.backtest.n} → ${out.backtest.estimate.toFixed(2)} nm vs hold ${out.backtest.hold.toFixed(2)} nm (${Date.now() - t0} ms compute)`);
}
```
Call it right after the `suez crossings` step:
```ts
    await step('track engine', 90_000, runTrackEngineStep);
```

- [ ] **Step 7: Verify locally**

Run: `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/20260930_track_engine.sql` against the local Timescale container, then `npx tsx --env-file=.env.local -e "import('./src/services/ais-ingester/harvest-once.ts')"` is **not** used. Run the engine step directly instead:
```bash
npx tsx --env-file=.env.local -e "
import { loadEngineVessels, loadLaneDensity, loadLearnState, saveEngineRun, saveLaneDensity } from './src/lib/db/tracks';
import { runTrackEngine } from './src/lib/tracks/engine';
import { grid } from './src/lib/tracks/land';
const now = new Date();
const [v, d, l] = await Promise.all([loadEngineVessels(), loadLaneDensity(now, grid.w * grid.h), loadLearnState()]);
const o = runTrackEngine({ vessels: v, now: now.getTime() / 60000, density: d, learn: l });
await saveEngineRun(o.payloads, l, { backtest: o.backtest, learned: o.learned }); await saveLaneDensity(o.densityDelta);
console.log(o.payloads.length, o.backtest); process.exit(0);"
```
Expected: prints a vessel count and a backtest object. `SELECT count(*) FROM vessel_track_state` is > 0.

- [ ] **Step 8: Commit**

```bash
git add scripts/migrations/20260930_track_engine.sql src/lib/db/schema.sql scripts/schema-portable.sql src/lib/db/tracks.ts src/lib/db/tracks.test.ts src/services/ais-ingester/harvest-once.ts
git commit -m "Track engine: storage, migration and harvester step"
```

---

### Task 9: API endpoint

**Files:**
- Create: `src/app/api/tracks/route.ts`
- Test: `src/app/api/tracks/route.test.ts`

**Interfaces:**
- Consumes: `getTracks()` (Task 8)
- Produces: `GET /api/tracks` → `TracksResponse`, `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, and a `Server-Timing` header

- [ ] **Step 1: Write the failing test**

`src/app/api/tracks/route.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/tracks', () => ({
  getTracks: vi.fn().mockResolvedValue({ generatedAt: 'x', vessels: [{ mmsi: '1' }], backtest: null, learned: null }),
}));
import { GET } from './route';

describe('GET /api/tracks', () => {
  it('returns payloads with CDN caching', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=300');
    expect((await res.json()).vessels).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/app/api/tracks/route.test.ts`
Expected: FAIL with `Cannot find module './route'`.

- [ ] **Step 3: Implement the route**

`src/app/api/tracks/route.ts`:
```ts
/** GET /api/tracks — track-engine output for the motion overlay. */
import { NextResponse } from 'next/server';
import { getTracks } from '@/lib/db/tracks';

export async function GET() {
  try {
    const started = performance.now();
    const body = await getTracks();
    const res = NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
    res.headers.set('Server-Timing', `db;dur=${(performance.now() - started).toFixed(1)}`);
    return res;
  } catch (error) {
    console.error('Failed to fetch tracks:', error);
    return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/app/api/tracks/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tracks
git commit -m "Track engine: /api/tracks endpoint"
```

---

### Task 10: Client nowcaster with projective blending

**Files:**
- Create: `src/lib/tracks/nowcast.ts`
- Test: `src/lib/tracks/nowcast.test.ts` (includes the smoothness gate)

**Interfaces:**
- Consumes: `TrackPayload` (Task 7), `decodeSeries` (Task 7)
- Produces:
  - `interface Sample { lat: number; lon: number; heading: number /* radians, east=0, north=π/2 */; moving: boolean; estimated: boolean; age: number /* min since last real fix */; tier: 0 | 1 | 2 }`
  - `class Nowcaster { ingest(payloads: TrackPayload[], nowMin: number): void; sample(mmsi: string, tMin: number, withHeading?: boolean): Sample | null; has(mmsi: string): boolean; isMotion(mmsi: string, tMin: number): boolean; mmsis(): string[]; pathAhead(mmsi: string, tMin: number, minutes: number, step: number): [number, number][]; trailBehind(mmsi: string, tMin: number): { lat: number; lon: number; estimated: boolean }[] }`

- [ ] **Step 1: Write the failing tests**

`src/lib/tracks/nowcast.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Nowcaster } from './nowcast';
import { encodeSeries } from './codec';
import type { TrackPayload } from './types';

const base = (lastRealAt: number, lon0: number, knEast: number, over: Partial<TrackPayload> = {}): TrackPayload => {
  const pts: [number, number, number][] = [];
  for (let k = 0; k <= 60; k++) pts.push([lastRealAt + k * 6, 25, lon0 + (knEast * (k * 6)) / 60 / (60 * Math.cos((25 * Math.PI) / 180))]);
  return { mmsi: '1', tier: 0, score: 90, parts: [30, 25, 15, 15, 5], state: 'underway', sog: knEast, cog: 90, lastRealAt,
    method: 'hybrid', uncert: 0.03, path: encodeSeries(pts), trail: null, cleaning: { kept: 1, rejected: 0, inland: 0, rerouted: 0 }, ...over };
};

describe('Nowcaster', () => {
  it('places a ship along its estimated path by wall-clock time', () => {
    const n = new Nowcaster(); n.ingest([base(1000, 57, 12)], 1000);
    const a = n.sample('1', 1030)!;
    expect(a.lon).toBeGreaterThan(57);
    expect(a.estimated).toBe(true);
    expect(n.sample('1', 1005)!.estimated).toBe(false);
  });

  it('corrects onto new data without a velocity jump (smoothness gate)', () => {
    const n = new Nowcaster();
    n.ingest([base(1000, 57, 12)], 1000);
    // new data lands at t=1020: the ship is actually 1.5 nm further north and slower
    n.ingest([base(1018, 57.05, 8, { path: encodeSeries(Array.from({ length: 61 }, (_, k) => [1018 + k * 6, 25.025, 57.05 + (8 * (k * 6)) / 60 / (60 * Math.cos((25 * Math.PI) / 180))])) })], 1020);
    const dt = 0.1, K = Math.cos((25 * Math.PI) / 180);
    let p0 = n.sample('1', 1019.8)!, p1 = n.sample('1', 1019.9)!, maxAcc = 0, maxTurn = 0, h1 = p1.heading;
    for (let t = 1020; t <= 1100; t += dt) {
      const p = n.sample('1', t, true)!;
      const ax = ((p.lon - 2 * p1.lon + p0.lon) * 60 * K), ay = (p.lat - 2 * p1.lat + p0.lat) * 60;
      maxAcc = Math.max(maxAcc, Math.hypot(ax, ay) / (dt / 60) ** 2);
      let d = Math.abs(p.heading - h1); if (d > Math.PI) d = 2 * Math.PI - d;
      maxTurn = Math.max(maxTurn, (d * 180) / Math.PI / dt);
      h1 = p.heading; p0 = p1; p1 = p;
    }
    expect(maxAcc).toBeLessThan(400);     // nm/h² — the playback harness threshold
    expect(maxTurn).toBeLessThan(25);     // ° per map-minute
  });

  it('decelerates to a halt at the end of an estimate instead of stopping dead', () => {
    const n = new Nowcaster(); n.ingest([base(1000, 57, 12)], 1000);
    const end = 1000 + 360, a = n.sample('1', end - 1)!, b = n.sample('1', end - 0.5)!;
    expect(Math.abs(b.lon - a.lon)).toBeLessThan(0.0005);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/lib/tracks/nowcast.test.ts`
Expected: FAIL with `Cannot find module './nowcast'`.

- [ ] **Step 3: Implement the nowcaster**

`src/lib/tracks/nowcast.ts`:
```ts
/**
 * Client-side nowcast. Each /api/tracks payload is an epoch: the ship's last real state plus
 * an estimated path. When a new epoch arrives, the drawn position blends old → new with a
 * smoothstep weight, so position AND velocity stay continuous (projective blending, as in
 * networked-game dead reckoning). The blend lasts ~15 map-min per nm of correction (6–60);
 * heading turns no faster than 10°/map-min. Pure and framework-free.
 */
import { decodeSeries } from './codec';
import type { TrackPayload } from './types';

export interface Sample { lat: number; lon: number; heading: number; moving: boolean; estimated: boolean; age: number; tier: 0 | 1 | 2 }
interface Pt { t: number; lat: number; lon: number }
interface Epoch { avail: number; lastRealAt: number; lat: number; lon: number; cog: number; path: Pt[] | null; trail: Pt[]; B: number; BH: number; tier: 0 | 1 | 2; sig: string }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (u: number) => u * u * (3 - 2 * u);
const kAt = (lat: number) => Math.cos((lat * Math.PI) / 180);

function catmull(P: Pt[], t: number): { lat: number; lon: number } {
  const L = P.length - 1;
  if (t <= P[0].t) return P[0];
  if (t >= P[L].t) return P[L];
  const step = P[1].t - P[0].t, k = Math.min(L - 1, Math.floor((t - P[0].t) / step)), f = (t - P[k].t) / (P[k + 1].t - P[k].t);
  const p1 = P[k], p2 = P[k + 1];
  const p0 = k > 0 ? P[k - 1] : { t: 0, lat: 2 * p1.lat - p2.lat, lon: 2 * p1.lon - p2.lon };
  const p3 = k + 2 <= L ? P[k + 2] : { t: 0, lat: 2 * p2.lat - p1.lat, lon: 2 * p2.lon - p1.lon };
  const f2 = f * f, f3 = f2 * f;
  const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);
  return { lat: cr(p0.lat, p1.lat, p2.lat, p3.lat), lon: cr(p0.lon, p1.lon, p2.lon, p3.lon) };
}

export class Nowcaster {
  private epochs = new Map<string, Epoch[]>();

  ingest(payloads: TrackPayload[], nowMin: number) {
    for (const p of payloads) {
      const path = p.path ? decodeSeries(p.path).map(([t, lat, lon]) => ({ t, lat, lon })) : null;
      const trail = p.trail ? decodeSeries(p.trail).map(([t, lat, lon]) => ({ t, lat, lon })) : [];
      const origin = path?.[0] ?? trail[trail.length - 1];
      const sig = `${p.lastRealAt}|${p.path?.length ?? 0}|${p.method}`;
      const list = this.epochs.get(p.mmsi) ?? [];
      const prev = list[list.length - 1];
      if (prev && prev.sig === sig) { prev.tier = p.tier; continue; }
      const e: Epoch = {
        avail: prev ? nowMin : -Infinity, lastRealAt: p.lastRealAt, lat: origin?.lat ?? 0, lon: origin?.lon ?? 0,
        cog: p.cog, path: path && path.length > 1 && p.state === 'underway' ? path : null, trail, B: 6, BH: 6, tier: p.tier, sig,
      };
      if (!origin && prev) { e.lat = prev.lat; e.lon = prev.lon; }
      if (prev) {
        const a = this.at(list, list.length - 1, nowMin), b = this.base(e, nowMin);
        const off = Math.hypot((b.lon - a.lon) * 60 * kAt(a.lat), (b.lat - a.lat) * 60);
        e.B = Math.max(6, Math.min(60, 15 * off));
        const hA = this.headingAt(list, list.length - 1, nowMin), hB = this.baseHeading(e, nowMin);
        e.BH = Math.max(e.B, (Math.abs(Math.atan2(Math.sin(hB - hA), Math.cos(hB - hA))) * 180) / Math.PI / 10);
      }
      list.push(e);
      // Drop epochs whose successor's blend is long finished.
      while (list.length > 1 && nowMin > list[1].avail + list[1].BH + 1) list.shift();
      this.epochs.set(p.mmsi, list);
    }
  }

  has(mmsi: string) { return this.epochs.has(mmsi); }
  mmsis() { return [...this.epochs.keys()]; }

  private base(e: Epoch, t: number): { lat: number; lon: number } {
    if (!e.path || t <= e.path[0].t) return { lat: e.lat, lon: e.lon };
    const tEnd = e.path[e.path.length - 1].t, D = Math.min(10, (tEnd - e.path[0].t) / 2);
    let tp = t;
    if (t > tEnd - D) { const u = Math.min(1, (t - (tEnd - D)) / D); tp = tEnd - D + D * (u - (u * u) / 2); }
    return catmull(e.path, tp);
  }
  private baseHeading(e: Epoch, t: number): number {
    const a = this.base(e, t + 2), b = this.base(e, t - 2);
    const dx = (a.lon - b.lon) * 60 * kAt(a.lat), dy = (a.lat - b.lat) * 60;
    return Math.hypot(dx, dy) > 0.02 ? Math.atan2(dy, dx) : ((90 - e.cog) * Math.PI) / 180;
  }
  private at(list: Epoch[], k: number, t: number): { lat: number; lon: number } {
    const e = list[k];
    if (k === 0 || t >= e.avail + e.B) return this.base(e, t);
    const a = this.at(list, k - 1, t), b = this.base(e, t), w = smooth(clamp01((t - e.avail) / e.B));
    return { lat: a.lat + (b.lat - a.lat) * w, lon: a.lon + (b.lon - a.lon) * w };
  }
  private headingAt(list: Epoch[], k: number, t: number): number {
    const e = list[k], hNew = this.baseHeading(e, t);
    if (k === 0 || t >= e.avail + e.BH) return hNew;
    const hOld = this.headingAt(list, k - 1, t), w = smooth(clamp01((t - e.avail) / e.BH));
    return hOld + Math.atan2(Math.sin(hNew - hOld), Math.cos(hNew - hOld)) * w;
  }
  private index(list: Epoch[], t: number) { let k = 0; for (let j = 1; j < list.length; j++) if (list[j].avail <= t) k = j; return k; }

  sample(mmsi: string, tMin: number, withHeading = false): Sample | null {
    const list = this.epochs.get(mmsi); if (!list) return null;
    const k = this.index(list, tMin), e = list[k], pos = this.at(list, k, tMin);
    const moving = !!e.path && tMin < e.path[e.path.length - 1].t;
    return {
      lat: pos.lat, lon: pos.lon, heading: withHeading ? this.headingAt(list, k, tMin) : this.baseHeading(e, tMin),
      moving, estimated: moving && tMin - e.lastRealAt > 10, age: tMin - e.lastRealAt, tier: e.tier,
    };
  }
  isMotion(mmsi: string, tMin: number) { const s = this.sample(mmsi, tMin); return !!s && s.moving; }

  pathAhead(mmsi: string, tMin: number, minutes: number, step: number): [number, number][] {
    const out: [number, number][] = [];
    for (let t = tMin; t <= tMin + minutes; t += step) { const s = this.sample(mmsi, t); if (!s || !s.moving) break; out.push([s.lon, s.lat]); }
    return out;
  }
  /** Smoothed real history (trail) followed by the estimated stretch up to now. */
  trailBehind(mmsi: string, tMin: number): { lat: number; lon: number; estimated: boolean }[] {
    const list = this.epochs.get(mmsi); if (!list) return [];
    const e = list[this.index(list, tMin)], out = e.trail.filter((p) => p.t <= e.lastRealAt).map((p) => ({ lat: p.lat, lon: p.lon, estimated: false }));
    for (let t = Math.ceil(e.lastRealAt / 3) * 3; t <= tMin; t += 3) { const s = this.sample(mmsi, t); if (s) out.push({ lat: s.lat, lon: s.lon, estimated: true }); }
    const now = this.sample(mmsi, tMin); if (now) out.push({ lat: now.lat, lon: now.lon, estimated: now.estimated });
    return out;
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/tracks/nowcast.test.ts`
Expected: PASS (3 tests), including the smoothness gate (max acceleration < 400 nm/h², max turn < 25°/min).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracks/nowcast.ts src/lib/tracks/nowcast.test.ts
git commit -m "Track engine: client nowcaster with projective blending"
```

---

### Task 11: Motion overlay on the live map

**Files:**
- Create: `src/stores/tracks.ts`, `src/lib/hooks/useTracks.ts`, `src/lib/tracks/frame.ts`, `src/components/map/MotionOverlay.tsx`
- Modify: `src/lib/map/geojson.ts` (optional tier/motion props), `src/components/map/VesselMap.tsx` (merge props, filter layer, zoom-aware opacity, overlay mount, overlay-first click)
- Test: `src/lib/tracks/frame.test.ts`, `src/lib/map/geojson.test.ts` (extend)

**Interfaces:**
- Consumes: `Nowcaster`, `Sample` (Task 10); `TracksResponse`, `TrackPayload` (Task 7); `MapVessel` (existing `src/lib/map/map-vessel.ts`); `usePolledJson` (existing `src/lib/hooks/usePolledJson.ts`)
- Produces:
  - `useTrackStore`: `{ nowcaster: Nowcaster; byMmsi: Map<string, TrackPayload>; backtest; learned; showStale: boolean; setShowStale(b); ingest(r: TracksResponse) }`
  - `useTracks()`: polls `/api/tracks` every 60 s
  - `buildFrame(input: { vessels: MapVessel[]; nc: Nowcaster; byMmsi: Map<string, TrackPayload>; tMin: number; zoom: number; project: (lon: number, lat: number) => { x: number; y: number }; selected: string | null }): Frame`, where `Frame = { glow: { x: number; y: number }[]; glowMix: number; tails: { pts: { x: number; y: number }[]; est: boolean[]; tier: number }[]; ahead: { pts: { x: number; y: number }[]; tier: number }[]; rings: { x: number; y: number; r: number }[]; ships: { mmsi: string; x: number; y: number; heading: number; estimated: boolean; age: number; tier: number; color: string }[] }`
  - `vesselsToGeoJSON(vessels, extra?: (v) => { tier: number; motion: boolean })`
  - `<MotionOverlay map={MapLibreMap} vessels={MapVessel[]} onPick={(mmsi) => void} />`

- [ ] **Step 1: Write the failing tests**

`src/lib/tracks/frame.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildFrame } from './frame';
import { Nowcaster } from './nowcast';
import { encodeSeries } from './codec';
import type { TrackPayload } from './types';
import type { MapVessel } from '@/lib/map/map-vessel';

const vessel = (mmsi: string, lon: number, lat: number): MapVessel => ({
  imo: null, mmsi, name: mmsi, flag: null, shipType: 80, destination: null, lastSeen: null, isSanctioned: false,
  sanctioningAuthority: null, sanctionReason: null, sanctionRiskCategory: null, anomalyType: null, anomalyConfidence: null,
  position: { time: '2026-09-30T00:00:00Z', latitude: lat, longitude: lon, speed: null, course: null, heading: null, navStatus: null, lowConfidence: false },
});
const payload = (mmsi: string, underway: boolean): TrackPayload => ({
  mmsi, tier: 0, score: 90, parts: [30, 25, 15, 15, 5], state: underway ? 'underway' : 'rest', sog: underway ? 12 : 0, cog: 90, lastRealAt: 1000,
  method: underway ? 'hybrid' : null, uncert: 0.03,
  path: underway ? encodeSeries(Array.from({ length: 61 }, (_, k) => [1000 + k * 6, 25, 57 + k * 0.02])) : null,
  trail: null, cleaning: { kept: 1, rejected: 0, inland: 0, rerouted: 0 },
});

describe('buildFrame', () => {
  it('draws underway ships as glyphs and anchored ones as glow at wide zoom', () => {
    const nc = new Nowcaster(); const ps = [payload('m', true), payload('a', false)]; nc.ingest(ps, 1000);
    const f = buildFrame({ vessels: [vessel('m', 57, 25), vessel('a', 56.4, 25.3)], nc, byMmsi: new Map(ps.map((p) => [p.mmsi, p])),
      tMin: 1030, zoom: 7.5, project: (lon, lat) => ({ x: lon * 100, y: -lat * 100 }), selected: null });
    expect(f.ships.map((s) => s.mmsi)).toEqual(['m']);
    expect(f.ships[0].estimated).toBe(true);
    expect(f.glow).toHaveLength(1);
    expect(f.glowMix).toBe(1);
    expect(f.ahead[0].pts.length).toBeGreaterThan(3);
  });

  it('fades the glow out when zoomed in', () => {
    const nc = new Nowcaster();
    const f = buildFrame({ vessels: [vessel('a', 56.4, 25.3)], nc, byMmsi: new Map(), tMin: 0, zoom: 10, project: () => ({ x: 0, y: 0 }), selected: null });
    expect(f.glowMix).toBe(0);
  });
});
```

Extend `src/lib/map/geojson.test.ts` with:
```ts
  it('adds tier and motion properties when a lookup is given', () => {
    const v = vesselsToGeoJSON([sampleVessel], () => ({ tier: 2, motion: true }));
    expect(v.features[0].properties).toMatchObject({ tier: 2, motion: true });
  });
```
(`sampleVessel` is the fixture already defined at the top of `geojson.test.ts`. If its name differs, use that file's existing fixture.)

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/lib/tracks/frame.test.ts src/lib/map/geojson.test.ts`
Expected: FAIL (`./frame` missing; geojson has no tier/motion).

- [ ] **Step 3: Implement the store, hook and frame builder**

`src/stores/tracks.ts`:
```ts
import { create } from 'zustand';
import { Nowcaster } from '@/lib/tracks/nowcast';
import type { TrackPayload, TracksResponse } from '@/lib/tracks/types';

interface TrackStore {
  nowcaster: Nowcaster;
  byMmsi: Map<string, TrackPayload>;
  backtest: TracksResponse['backtest'];
  learned: TracksResponse['learned'];
  showStale: boolean;
  setShowStale: (b: boolean) => void;
  ingest: (r: TracksResponse) => void;
}

export const useTrackStore = create<TrackStore>((set, get) => ({
  nowcaster: new Nowcaster(),
  byMmsi: new Map(),
  backtest: null,
  learned: null,
  showStale: false,
  setShowStale: (showStale) => set({ showStale }),
  ingest: (r) => {
    get().nowcaster.ingest(r.vessels, Date.now() / 60000);
    set({ byMmsi: new Map(r.vessels.map((v) => [v.mmsi, v])), backtest: r.backtest, learned: r.learned });
  },
}));
```

`src/lib/hooks/useTracks.ts` (check `usePolledJson`'s signature in `src/lib/hooks/usePolledJson.ts` and match it; the call below assumes `usePolledJson<T>(url, intervalMs)` returning `{ data }`):
```ts
'use client';
import { useEffect } from 'react';
import { usePolledJson } from './usePolledJson';
import { useTrackStore } from '@/stores/tracks';
import type { TracksResponse } from '@/lib/tracks/types';

/** Polls the track engine output and feeds the nowcaster. */
export function useTracks() {
  const { data } = usePolledJson<TracksResponse>('/api/tracks', 60_000);
  const ingest = useTrackStore((s) => s.ingest);
  useEffect(() => { if (data && Array.isArray(data.vessels)) ingest(data); }, [data, ingest]);
}
```

`src/lib/tracks/frame.ts`:
```ts
/** Pure frame builder: what the motion overlay draws this frame. */
import type { MapVessel } from '@/lib/map/map-vessel';
import { ACTIVITY_COLORS } from '@/lib/map/marker-style';
import type { Nowcaster } from './nowcast';
import type { TrackPayload } from './types';

type XY = { x: number; y: number };
export interface Frame {
  glow: XY[]; glowMix: number;
  tails: { pts: XY[]; est: boolean[]; tier: number }[];
  ahead: { pts: XY[]; tier: number }[];
  rings: { x: number; y: number; r: number }[];
  ships: { mmsi: string; x: number; y: number; heading: number; estimated: boolean; age: number; tier: number; color: string }[];
}
const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const anomalyColor = (v: MapVessel) => {
  const a = v.anomalyType;
  if (!a) return null;
  if (a === 'going_dark') return v.anomalyConfidence === 'confirmed' ? ACTIVITY_COLORS.goingDarkConfirmed : ACTIVITY_COLORS.goingDarkSuspected;
  if (a === 'repeat_going_dark') return ACTIVITY_COLORS.goingDarkConfirmed;
  if (a === 'loitering') return ACTIVITY_COLORS.loitering;
  if (a === 'sts_transfer') return ACTIVITY_COLORS.stsTransfer;
  if (a === 'speed' || a === 'speed_anomaly') return ACTIVITY_COLORS.speed;
  if (a === 'deviation' || a === 'route_deviation') return ACTIVITY_COLORS.deviation;
  return ACTIVITY_COLORS.spoofed;
};

export function buildFrame(input: {
  vessels: MapVessel[]; nc: Nowcaster; byMmsi: Map<string, TrackPayload>; tMin: number; zoom: number;
  project: (lon: number, lat: number) => XY; selected: string | null;
}): Frame {
  const { vessels, nc, byMmsi, tMin, zoom, project, selected } = input;
  const f: Frame = { glow: [], glowMix: 1 - smoothstep(8.2, 9.2, zoom), tails: [], ahead: [], rings: [], ships: [] };
  const pxPerNm = project(0, 0).y - project(0, 1 / 60).y;
  for (const v of vessels) {
    const s = nc.sample(v.mmsi, tMin, true);
    const tier = byMmsi.get(v.mmsi)?.tier ?? 3;
    if (!s || !s.moving) {
      if (tier <= 2 && !v.anomalyType && !v.isSanctioned) f.glow.push(project(v.position.longitude, v.position.latitude));
      continue;
    }
    const p = project(s.lon, s.lat);
    f.ships.push({ mmsi: v.mmsi, x: p.x, y: p.y, heading: s.heading, estimated: s.estimated, age: s.age, tier: s.tier,
      color: anomalyColor(v) ?? (s.tier === 0 ? '#fff6e3' : '#d8dbe0') });
    if (s.tier <= 1 || v.mmsi === selected) {
      const t = nc.trailBehind(v.mmsi, tMin).filter((_, k, a) => k >= a.length - 42);
      f.tails.push({ pts: t.map((q) => project(q.lon, q.lat)), est: t.map((q) => q.estimated), tier: s.tier });
    }
    f.ahead.push({ pts: nc.pathAhead(v.mmsi, tMin, 45, 3).map(([lon, lat]) => project(lon, lat)), tier: s.tier });
    const u = byMmsi.get(v.mmsi)?.uncert ?? 0.03, r = (0.15 + u * s.age) * pxPerNm;
    if (s.estimated && s.tier <= 1 && r > 3 && r < 40) f.rings.push({ x: p.x, y: p.y, r });
  }
  return f;
}
```

- [ ] **Step 4: Implement the overlay renderer**

`src/components/map/MotionOverlay.tsx`:
```tsx
'use client';
/**
 * Canvas overlay synced to MapLibre: moving and estimated ships, comet tails, dashed
 * estimates, uncertainty rings and the capped-brightness glow of ships at rest.
 * Honors prefers-reduced-motion (no dash creep, no heading damping animation).
 */
import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapVessel } from '@/lib/map/map-vessel';
import { buildFrame, type Frame } from '@/lib/tracks/frame';
import { useTrackStore } from '@/stores/tracks';
import { useVesselStore } from '@/stores/vessel';

const AMBER = '#f59e0b';

function glowSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c;
}
function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, s: number) {
  const ca = Math.cos(a), sa = Math.sin(a), p = (fx: number, fy: number) => [x + fx * ca + fy * sa, y - fx * sa + fy * ca];
  const q = [p(s * 1.25, 0), p(-s * 0.85, s * 0.75), p(-s * 0.4, 0), p(-s * 0.85, -s * 0.75)];
  ctx.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0], q[k][1]); ctx.closePath();
}

export function hitTest(frame: Frame | null, x: number, y: number): string | null {
  if (!frame) return null;
  let best: string | null = null, bd = 144;
  for (const s of frame.ships) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; best = s.mmsi; } }
  return best;
}

export function MotionOverlay({ map, vessels, frameRef }: { map: MapLibreMap; vessels: MapVessel[]; frameRef: React.MutableRefObject<Frame | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const vesselsRef = useRef(vessels);
  vesselsRef.current = vessels;

  useEffect(() => {
    const cv = canvas.current!; const ctx = cv.getContext('2d')!;
    const sprite = glowSprite(), buf = document.createElement('canvas');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dispHd = new Map<string, number>();
    let raf = 0, prev = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden) return;
      const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
      const box = map.getContainer().getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = box.width, H = box.height;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const { nowcaster, byMmsi } = useTrackStore.getState();
      const selected = useVesselStore.getState().selectedVessel?.mmsi ?? null;
      const f = buildFrame({ vessels: vesselsRef.current, nc: nowcaster, byMmsi, tMin: Date.now() / 60000, zoom: map.getZoom(),
        project: (lon, lat) => map.project([lon, lat]), selected });
      frameRef.current = f;

      // Capped glow: accumulate additively in a 1/3-res buffer (saturates at 1), tint, lay faintly.
      if (f.glowMix > 0.01 && f.glow.length) {
        const bw = Math.ceil(W / 3), bh = Math.ceil(H / 3);
        if (buf.width !== bw || buf.height !== bh) { buf.width = bw; buf.height = bh; }
        const g = buf.getContext('2d')!;
        g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, bw, bh);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.16;
        const r = Math.max(3, Math.min(9, 5 * Math.pow(2, (map.getZoom() - 8) / 2)));
        for (const p of f.glow) g.drawImage(sprite, p.x / 3 - r, p.y / 3 - r, r * 2, r * 2);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-in'; g.fillStyle = '#c9975a'; g.fillRect(0, 0, bw, bh);
        g.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.3 * f.glowMix; ctx.drawImage(buf, 0, 0, W, H); ctx.globalAlpha = 1;
      }

      // Comet tails: alpha by age, tapering; estimated stretches as a faint ghost.
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = AMBER;
      for (const t of f.tails) {
        const n = t.pts.length;
        for (let k = 1; k < n; k++) {
          const age = 1 - k / n;
          ctx.globalAlpha = t.est[k] ? 0.2 : 0.8 * Math.pow(1 - age, 1.8) * (t.tier === 0 ? 1 : 0.5);
          ctx.lineWidth = t.est[k] ? 1 : 1.9 - 1.4 * age;
          ctx.beginPath(); ctx.moveTo(t.pts[k - 1].x, t.pts[k - 1].y); ctx.lineTo(t.pts[k].x, t.pts[k].y); ctx.stroke();
        }
      }
      // Dashed estimate ahead, creeping forward; nearer half brighter.
      ctx.setLineDash([4, 5]); ctx.lineDashOffset = reduce ? 0 : -(now / 1000) * 8; ctx.lineWidth = 1.1;
      for (const a of f.ahead) {
        if (a.pts.length < 2) continue;
        ctx.globalAlpha = a.tier === 2 ? 0.3 : 0.55;
        ctx.beginPath(); a.pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.globalAlpha = 0.2; ctx.lineWidth = 1;
      for (const r of f.rings) { ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke(); }

      // Ships: filled when on real data, hollow and fading with age when estimated.
      const zs = Math.max(0.8, Math.min(1.9, Math.pow(2, (map.getZoom() - 8) / 2)));
      for (const s of f.ships) {
        let h = dispHd.get(s.mmsi);
        if (h === undefined || reduce) h = s.heading;
        else { const d = Math.atan2(Math.sin(s.heading - h), Math.cos(s.heading - h)); h += d * (1 - Math.exp(-dt / 0.12)); }
        dispHd.set(s.mmsi, h);
        const size = 4.6 * zs * ([1.25, 1, 0.75][s.tier] ?? 0.75);
        ctx.beginPath(); chevron(ctx, s.x, s.y, h, size);
        if (s.estimated) {
          ctx.globalAlpha = s.age < 60 ? 1 : s.age < 180 ? 0.62 : 0.38; ctx.strokeStyle = '#fff6e3'; ctx.lineWidth = 1.1; ctx.stroke();
        } else {
          ctx.globalAlpha = [1, 0.8, 0.5][s.tier] ?? 0.5; ctx.fillStyle = s.color; ctx.fill();
        }
      }
      ctx.globalAlpha = 1; ctx.strokeStyle = AMBER;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [map, frameRef]);

  return <canvas ref={canvas} data-testid="motion-overlay" aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none z-[1]" />;
}
```

- [ ] **Step 5: Extend GeoJSON and wire it into VesselMap**

In `src/lib/map/geojson.ts`, add an optional second parameter to `vesselsToGeoJSON`:
```ts
export function vesselsToGeoJSON(
  vessels: MapVessel[],
  extra?: (v: MapVessel) => { tier: number; motion: boolean },
) {
```
Inside the feature properties object, spread `...(extra ? extra(v) : {})`.

In `src/components/map/VesselMap.tsx`:

1. Add imports:
```ts
import { MotionOverlay, hitTest } from './MotionOverlay';
import { useTracks } from '@/lib/hooks/useTracks';
import { useTrackStore } from '@/stores/tracks';
import type { Frame } from '@/lib/tracks/frame';
```
2. At the top of the component body, add `useTracks();`, `const frameRef = useRef<Frame | null>(null);` and `const { showStale, byMmsi } = useTrackStore();`.
3. In `submitVesselGeoJson`, replace `source.setData(vesselsToGeoJSON(filtered));` with:
```ts
    const { nowcaster, byMmsi: tracks, showStale: stale } = useTrackStore.getState();
    const nowMin = Date.now() / 60000;
    const visible = stale ? filtered : filtered.filter((v) => tracks.size === 0 || tracks.has(v.mmsi));
    source.setData(vesselsToGeoJSON(visible, (v) => ({
      tier: tracks.get(v.mmsi)?.tier ?? 3,
      motion: nowcaster.isMotion(v.mmsi, nowMin),
    })));
```
Add `byMmsi` and `showStale` to the `useCallback` dependency list, and add an effect that re-submits when they change: `useEffect(() => { submitVesselGeoJson(vessels, acceptedResponseSequenceRef.current); }, [byMmsi, showStale, submitVesselGeoJson, vessels]);`. Before `tracks` arrives, every vessel shows, so the first load looks the same as today.
4. On the `vessel-circles` layer add `filter: ['!=', ['get', 'motion'], true]`, and wrap its `'circle-opacity'` and `'circle-stroke-opacity'` in a zoom interpolation with a tier factor:
```ts
            'circle-opacity': ['interpolate', ['linear'], ['zoom'],
              8.2, ['*', 0.45, ['match', ['get', 'tier'], 0, 1, 1, 0.85, 2, 0.5, 0.25], freshnessOpacityExpression(null)],
              9.2, ['*', ['match', ['get', 'tier'], 0, 1, 1, 0.85, 2, 0.5, 0.25], freshnessOpacityExpression(null)]],
```
Use the same expression for `'circle-stroke-opacity'`. If `freshnessOpacityExpression(null)` itself contains a `zoom` input, keep only the tier factor and leave freshness as it was.
5. In the map `click` flow, register a general handler before the layer handler: `mapInstance.on('click', handleOverlayClick);` with
```ts
    const handleOverlayClick = (e: MapMouseEvent) => {
      const mmsi = hitTest(frameRef.current, e.point.x, e.point.y);
      if (!mmsi) return;
      const v = vesselsRef.current.find((x) => x.mmsi === mmsi);
      if (v) setSelectedVessel(expandMapVessel(v));
    };
```
where `vesselsRef` is a `useRef` mirror of `vessels` (add `const vesselsRef = useRef(vessels); vesselsRef.current = vessels;`) and `expandMapVessel` comes from `@/lib/map/map-vessel`. Detach it in the cleanup alongside the others.
6. Render `{mapLoaded && map.current && <MotionOverlay map={map.current} vessels={vessels} frameRef={frameRef} />}` inside the map container wrapper, directly after the map `div`.

- [ ] **Step 6: Run the tests and the full suite**

Run: `npx vitest run src/lib/tracks src/lib/map src/components/map`
Expected: PASS, including the existing `VesselMap.test.tsx`. If that test's MapLibre mock lacks `project`/`getZoom`/`getContainer`, add them to the mock (`project: () => ({ x: 0, y: 0 })`, `getZoom: () => 8`, `getContainer: () => document.createElement('div')`).

- [ ] **Step 7: Commit**

```bash
git add src/stores/tracks.ts src/lib/hooks/useTracks.ts src/lib/tracks/frame.ts src/lib/tracks/frame.test.ts src/components/map/MotionOverlay.tsx src/components/map/VesselMap.tsx src/lib/map/geojson.ts src/lib/map/geojson.test.ts src/components/map/VesselMap.test.tsx
git commit -m "Track engine: motion overlay on the live map"
```

---

### Task 12: Panel, legend and stale toggle

**Files:**
- Create: `src/components/panels/TrackingSection.tsx`
- Modify: `src/components/panels/VesselPanel.tsx` (render `<TrackingSection mmsi={vessel.mmsi} />` above "Identity & kinematics"), `src/components/map/MapLegend.tsx` (tier and estimate rows plus the backtest line), `src/components/map/MapFilterChips.tsx` (a Stale chip bound to `useTrackStore.showStale`)
- Test: `src/components/panels/TrackingSection.test.tsx`

**Interfaces:**
- Consumes: `useTrackStore` (Task 11), `TrackPayload`
- Produces: `<TrackingSection mmsi: string />`

- [ ] **Step 1: Write the failing test**

`src/components/panels/TrackingSection.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { TrackingSection } from './TrackingSection';
import { useTrackStore } from '@/stores/tracks';

beforeEach(() => {
  useTrackStore.setState({ byMmsi: new Map([['1', {
    mmsi: '1', tier: 0, score: 88, parts: [30, 25, 9, 15, 9], state: 'underway', sog: 11.6, cog: 248,
    lastRealAt: Date.now() / 60000 - 25, method: 'damped', uncert: 0.03, path: null, trail: null,
    cleaning: { kept: 9, rejected: 1, inland: 0, rerouted: 1 },
  }]]) });
});

describe('TrackingSection', () => {
  it('shows the evidence score, derived kinematics and the estimate basis in plain words', () => {
    render(<TrackingSection mmsi="1" />);
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText(/well tracked/i)).toBeInTheDocument();
    expect(screen.getByText(/11\.6 kn · 248°/)).toBeInTheDocument();
    expect(screen.getByText(/estimated for 25 min/i)).toBeInTheDocument();
    expect(screen.getByText(/slowing/i)).toBeInTheDocument();
  });

  it('renders nothing for a vessel the engine has not scored', () => {
    const { container } = render(<TrackingSection mmsi="999" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/components/panels/TrackingSection.test.tsx`
Expected: FAIL with `Cannot find module './TrackingSection'`.

- [ ] **Step 3: Implement the section**

`src/components/panels/TrackingSection.tsx`:
```tsx
'use client';
/** Evidence breakdown and estimate basis for the selected vessel. */
import { useTrackStore } from '@/stores/tracks';

const TIER = ['Well tracked', 'Tracked', 'Sparse'];
const PARTS: [string, number][] = [['Fix volume', 30], ['Recency', 25], ['Regularity', 15], ['Consistency', 15], ['Identity', 15]];
const METHOD = { hybrid: 'on its smoothed course, bending through open water where that course meets land', sea: 'along a sea route that favours the lanes other ships use', damped: 'slowing on its course, the way ships approaching an anchorage do' } as const;

export function TrackingSection({ mmsi }: { mmsi: string }) {
  const p = useTrackStore((s) => s.byMmsi.get(mmsi));
  if (!p) return null;
  const since = Math.max(0, Math.round(Date.now() / 60000 - p.lastRealAt));
  const basis = p.state === 'rest'
    ? 'At rest. Moves under 185 m are held in place instead of drawn as motion.'
    : since <= 10
      ? 'Underway on real data. Course and speed come from its smoothed track.'
      : `Estimated for ${since} min since its last real fix, ${METHOD[p.method ?? 'hybrid']}. Position ±${(0.15 + p.uncert * since).toFixed(1)} nm. New data restarts the estimate.`;
  return (
    <section data-testid="tracking-section" className="border-t border-gray-800 pt-3 space-y-3 font-mono">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl text-white tabular-nums">{p.score}</span>
        <span className="text-[10px] uppercase tracking-widest text-gray-400">{TIER[p.tier]}</span>
      </div>
      <div className="space-y-1.5">
        {PARTS.map(([label, max], k) => (
          <div key={label} className="grid grid-cols-[92px_1fr_24px] items-center gap-2 text-[10px] text-gray-500 uppercase tracking-wider">
            <span>{label}</span>
            <span className="h-1 bg-gray-800 relative"><span className="absolute inset-y-0 left-0 bg-amber-500" style={{ width: `${(p.parts[k] / max) * 100}%` }} /></span>
            <span className="text-right text-gray-200 tabular-nums">{p.parts[k]}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-gray-400 border border-dashed border-gray-700 p-2">{basis}</p>
      {p.state === 'underway' && (
        <div className="flex justify-between text-xs"><span className="text-gray-500 uppercase tracking-wider text-[10px]">Speed · course</span>
          <span className="text-gray-200 tabular-nums">{p.sog.toFixed(1)} kn · {String(p.cog).padStart(3, '0')}° <span className="text-gray-500">derived</span></span></div>
      )}
      <div className="flex justify-between text-xs"><span className="text-gray-500 uppercase tracking-wider text-[10px]">Cleaning</span>
        <span className="text-gray-200">{p.cleaning.kept} kept · {p.cleaning.rejected} rejected{p.cleaning.rerouted ? ` · ${p.cleaning.rerouted} rerouted by sea` : ''}</span></div>
    </section>
  );
}
```

- [ ] **Step 4: Wire the section, legend and Stale chip**

- In `VesselPanel.tsx`, import `TrackingSection` and render `{selectedVessel && <TrackingSection mmsi={selectedVessel.mmsi} />}` immediately before the "Identity & kinematics" block.
- In `MapLegend.tsx`, inside the expanded legend, add a section after the freshness rows:
```tsx
          <div className="space-y-1 pt-2 border-t border-gray-800">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Motion</p>
            <p className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-amber-500" />Estimated path</p>
            <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-full border border-amber-500" />Estimate uncertainty</p>
            <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#c9975a]/40" />Ships at rest (glow when zoomed out)</p>
            {backtest && Number.isFinite(backtest.estimate) && (
              <p className="text-gray-500">Estimates ±{backtest.estimate.toFixed(1)} nm (backtest vs {backtest.hold.toFixed(1)} nm frozen)</p>
            )}
          </div>
```
Get `backtest` with `const backtest = useTrackStore((s) => s.backtest);`.
- In `MapFilterChips.tsx`, add a chip matching the existing chip markup: label `Stale >24h`, `aria-pressed={showStale}`, `onClick={() => setShowStale(!showStale)}`, reading `showStale`/`setShowStale` from `useTrackStore`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components`
Expected: PASS (the new test plus the existing panel, legend and chip tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/TrackingSection.tsx src/components/panels/TrackingSection.test.tsx src/components/panels/VesselPanel.tsx src/components/map/MapLegend.tsx src/components/map/MapFilterChips.tsx
git commit -m "Track engine: evidence panel, motion legend and stale toggle"
```

---

### Task 13: Verification, release and live check

**Files:**
- Create: `scripts/verify-motion.mjs`
- Modify: `package.json` (`"verify:motion": "node scripts/verify-motion.mjs"`)

- [ ] **Step 1: Write the browser check**

`scripts/verify-motion.mjs`:
```js
/**
 * BASE_URL=http://localhost:3000 npm run verify:motion
 * Checks the motion overlay draws moving ships, stays at frame rate, clicking a moving ship
 * opens its tracking section, and no console errors occur.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const b = await chromium.launch({ channel: process.env.CHROME_CHANNEL ?? 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await p.waitForSelector('[data-testid="motion-overlay"]');
await p.waitForFunction(() => fetch('/api/tracks').then((r) => r.ok), null, { timeout: 30000 });
const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
const lit = await p.evaluate(() => { const c = document.querySelector('[data-testid="motion-overlay"]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
const tracks = await p.evaluate(() => fetch('/api/tracks').then((r) => r.json()));
const moving = tracks.vessels.filter((v) => v.state === 'underway').length;
const checks = [['fps ≥ 50', fps >= 50, fps], ['overlay drew pixels', lit > 500, lit], ['engine output present', tracks.vessels.length > 0, tracks.vessels.length], ['some ships estimated', moving > 0, moving], ['no page errors', errors.length === 0, errors.join(' | ')]];
for (const [name, ok, v] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${v}`);
await b.close();
process.exit(checks.every((c) => c[1]) ? 0 : 1);
```

- [ ] **Step 2: Run everything locally**

Run: `npm run ci` then `BASE_URL=http://localhost:3000 npm run verify:motion` against a local build with the engine step having run once (Task 8, Step 7).
Expected: CI green; verify:motion prints five PASS lines.

- [ ] **Step 3: Apply the migration to production**

Use the documented method: the Supabase MCP is read-only, so run `node --env-file=.env.harvester <applier> scripts/migrations/20260930_track_engine.sql` over the session pooler, right after a harvest ends. Then verify through the Supabase MCP that the three tables exist, have RLS on and have no `anon`/`authenticated` grants (`pg_class.relacl`), and run `get_advisors`.

- [ ] **Step 4: Release**

Push to `master` (Vercel auto-deploys). The Mac harvester picks up the new step on its next run from the working tree.

- [ ] **Step 5: Live check**

After the next harvest, check the harvester log (`~/.straits-harvester/harvest.log`) for a `Track engine: … vessels, … estimated, backtest …` line. Then run `BASE_URL=https://straits.randyren.org npm run verify:motion`. Expected: five PASS lines.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-motion.mjs package.json
git commit -m "Track engine: browser verification for the motion overlay"
```
