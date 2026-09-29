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
