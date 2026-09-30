'use client';
/**
 * Canvas overlay synced to MapLibre: moving and estimated ships, comet tails, dashed
 * estimates, uncertainty rings and the capped-brightness glow of ships at rest — live, or
 * replaying the last 24 h. Also: the intro fade-in, name labels, pings when fresh data lands,
 * the hover ring and the staged selection (brackets → the day's wake draws on → estimate cone).
 * Honors prefers-reduced-motion (no dash creep, no staging, no easing).
 */
import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapVessel } from '@/lib/map/map-vessel';
import { buildFrame, type Frame } from '@/lib/tracks/frame';
import { DOT_RADIUS, DOT_TIER_SIZE, zoomScale } from '@/lib/map/marker-style';
import { useTrackStore } from '@/stores/tracks';
import { useReplayStore } from '@/stores/replay';
import { useVesselStore } from '@/stores/vessel';

const AMBER = '#f59e0b';
/** Wakes and estimate lines are capped in screen length, so they read the same at every zoom. */
const TAIL_PX = 120, AHEAD_PX = 90;
/** Below this zoom a whole region is on screen: moving ships draw as dots, wakes fade out. */
const REGION_ZOOM = 6.3;

/** Index from which the last `maxPx` of a screen polyline starts. */
function tailStart(pts: { x: number; y: number }[], maxPx: number): number {
  let len = 0;
  for (let k = pts.length - 1; k > 0; k--) { len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y); if (len > maxPx) return k; }
  return 0;
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smoothstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (x: number) => 1 - (1 - x) ** 3;

function glowSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'); if (!g) return c;
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c;
}
function chevron(ctx: CanvasRenderingContext2D | Path2D, x: number, y: number, a: number, s: number) {
  const ca = Math.cos(a), sa = Math.sin(a), p = (fx: number, fy: number) => [x + fx * ca + fy * sa, y - fx * sa + fy * ca];
  const q = [p(s * 1.25, 0), p(-s * 0.85, s * 0.75), p(-s * 0.4, 0), p(-s * 0.85, -s * 0.75)];
  ctx.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0], q[k][1]); ctx.closePath();
}
function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alpha: number) {
  ctx.globalAlpha = alpha; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(text, x, y);
  ctx.fillStyle = '#e8e6e1'; ctx.fillText(text, x, y);
}

/** Nearest drawn ship (moving, or at rest while replaying) within 12 px. */
export function hitTest(frame: Frame | null, x: number, y: number): string | null {
  if (!frame) return null;
  let best: string | null = null, bd = 144;
  for (const s of frame.ships) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; best = s.mmsi; } }
  if (best) return best;
  for (const s of frame.dots) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; best = s.mmsi; } }
  return best;
}

export function MotionOverlay({ map, vessels, frameRef, hoverRef }: {
  map: MapLibreMap; vessels: MapVessel[]; frameRef: React.MutableRefObject<Frame | null>; hoverRef: React.MutableRefObject<string | null>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const vesselsRef = useRef(vessels);
  useEffect(() => { vesselsRef.current = vessels; }, [vessels]);

  useEffect(() => {
    const cv = canvas.current, ctx = cv?.getContext('2d');
    // No 2D canvas (blocked by the browser, or a test DOM): the dot layer still works alone.
    if (!cv || !ctx) return;
    const sprite = glowSprite(), buf = document.createElement('canvas');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dispHd = new Map<string, number>();
    const replayPings = new Map<string, number>();
    let raf = 0, prev = performance.now(), introAt = 0, lastSel: string | null = null, selAt = 0, prevReplayT = NaN;

    // While the camera moves, draw inside MapLibre's own render so the overlay never runs a
    // frame behind the basemap (the swim you see when zooming); otherwise our own loop animates.
    const loop = (now: number) => { raf = requestAnimationFrame(loop); if (!map.isMoving()) draw(now); };
    const onRender = () => { if (map.isMoving()) draw(performance.now()); };
    const draw = (now: number) => {
      if (document.hidden) return;
      const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
      const box = map.getContainer().getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = box.width, H = box.height, zoom = map.getZoom();
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);

      const replay = useReplayStore.getState();
      replay.tick(dt, reduce);
      const replaying = replay.active && !!replay.model;
      const { nowcaster, byMmsi, pings } = useTrackStore.getState();
      const selected = useVesselStore.getState().selectedVessel?.mmsi ?? null;
      const tMin = replaying ? replay.t : Date.now() / 60000;
      const source = replaying ? replay.model! : nowcaster;
      const f = buildFrame({ vessels: vesselsRef.current, nc: source, byMmsi, tMin, zoom, project: (lon, lat) => map.project([lon, lat]),
        selected, hovered: hoverRef.current, replay: replaying ? replay.model! : undefined });
      frameRef.current = f;

      if (!introAt && (f.ships.length || f.dots.length)) introAt = now;
      // Ships arrive by tier: best tracked first, over ~1 s.
      const intro = (tier: number) => (reduce ? 1 : easeOut(clamp01((now - introAt - tier * 180) / 650)));
      if (selected !== lastSel) { lastSel = selected; selAt = now; if (selected) void useReplayStore.getState().load(); }
      if (replaying) {
        if (Number.isFinite(prevReplayT) && replay.t > prevReplayT) for (const m of replay.model!.resumedBetween(prevReplayT, replay.t)) replayPings.set(m, now);
        prevReplayT = replay.t;
      } else prevReplayT = NaN;

      // Capped glow: accumulate additively in a 1/3-res buffer (saturates at 1), tint, lay faintly.
      if (f.glowMix > 0.01 && f.glow.length) {
        const bw = Math.ceil(W / 3), bh = Math.ceil(H / 3);
        if (buf.width !== bw || buf.height !== bh) { buf.width = bw; buf.height = bh; }
        const g = buf.getContext('2d')!;
        g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, bw, bh);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.16;
        const r = Math.max(3, Math.min(9, 5 * Math.pow(2, (zoom - 8) / 2)));
        for (const p of f.glow) g.drawImage(sprite, p.x / 3 - r, p.y / 3 - r, r * 2, r * 2);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-in'; g.fillStyle = '#c9975a'; g.fillRect(0, 0, bw, bh);
        g.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.3 * f.glowMix * intro(1); ctx.drawImage(buf, 0, 0, W, H); ctx.globalAlpha = 1;
      }

      const zs = zoomScale(zoom);
      // Detail that only reads up close: rings, then dashed estimates, fade out as you zoom out.
      const ringMix = smoothstep(8.3, 9.2, zoom), aheadMix = smoothstep(6.6, 7.6, zoom), tailMix = smoothstep(REGION_ZOOM - 0.5, REGION_ZOOM + 0.5, zoom);
      // Replay: ships at rest (live, the map's dot layer draws them), same size and greys.
      if (f.dots.length) {
        const byColor = new Map<string, Path2D>();
        for (const d of f.dots) {
          const r = DOT_RADIUS * zs * (DOT_TIER_SIZE[d.tier] ?? DOT_TIER_SIZE[3]);
          let p = byColor.get(d.color); if (!p) byColor.set(d.color, (p = new Path2D()));
          p.moveTo(d.x + r, d.y); p.arc(d.x, d.y, r, 0, Math.PI * 2);
        }
        ctx.globalAlpha = (1 - 0.3 * f.glowMix) * 0.85;
        for (const [c, p] of byColor) { ctx.fillStyle = c; ctx.fill(p); }
        ctx.globalAlpha = 1;
      }

      // Comet tails: alpha by age, tapering; estimated stretches as a faint ghost. They draw on during the intro.
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = AMBER;
      for (const t of tailMix > 0.01 ? f.tails : []) {
        const n = t.pts.length, k0 = tailStart(t.pts, TAIL_PX), span = n - k0, shown = Math.floor(span * intro(t.tier));
        for (let k = Math.max(k0 + 1, n - shown); k < n; k++) {
          const age = 1 - (k - k0) / span;
          ctx.globalAlpha = tailMix * (t.est[k] ? 0.2 : 0.8 * Math.pow(1 - age, 1.8) * (t.tier === 0 ? 1 : 0.5));
          ctx.lineWidth = (t.est[k] ? 1 : 1.9 - 1.4 * age) * Math.min(1, zs);
          ctx.beginPath(); ctx.moveTo(t.pts[k - 1].x, t.pts[k - 1].y); ctx.lineTo(t.pts[k].x, t.pts[k].y); ctx.stroke();
        }
      }
      // Dashed estimate ahead, creeping forward.
      ctx.setLineDash([4, 5]); ctx.lineDashOffset = reduce ? 0 : -(now / 1000) * 8; ctx.lineWidth = 1.1;
      for (const a of f.ahead) {
        if (a.pts.length < 2) continue;
        ctx.globalAlpha = (a.tier === 2 ? 0.3 : 0.55) * intro(a.tier) * aheadMix;
        if (ctx.globalAlpha < 0.01) continue;
        ctx.beginPath();
        let len = 0;
        for (let k = 0; k < a.pts.length; k++) {
          const p = a.pts[k];
          if (k) { len += Math.hypot(p.x - a.pts[k - 1].x, p.y - a.pts[k - 1].y); ctx.lineTo(p.x, p.y); if (len > AHEAD_PX) break; } else ctx.moveTo(p.x, p.y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      if (ringMix > 0.01) {
        ctx.globalAlpha = 0.2 * ringMix; ctx.lineWidth = 1;
        for (const r of f.rings) { ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke(); }
      }

      if (selected && f.sel) drawSelectionTrail(selected, tMin, now);

      // Ships: filled when on real data, hollow and fading with age when estimated.
      for (const s of f.ships) {
        let h = dispHd.get(s.mmsi);
        if (h === undefined || reduce) h = s.heading;
        else { const d = Math.atan2(Math.sin(s.heading - h), Math.cos(s.heading - h)); h += d * (1 - Math.exp(-dt / 0.12)); }
        dispHd.set(s.mmsi, h);
        const k = intro(s.tier), size = 4.6 * zs * ([1.25, 1, 0.75][s.tier] ?? 0.75) * (0.6 + 0.4 * k);
        ctx.beginPath();
        // A region view packs hundreds of chevrons into blobs; there, moving ships are bright dots.
        if (zoom < REGION_ZOOM) { const r = DOT_RADIUS * zs * 1.1; ctx.moveTo(s.x + r, s.y); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); }
        else chevron(ctx, s.x, s.y, h, size);
        if (s.estimated) {
          ctx.globalAlpha = k * (s.mmsi === selected ? 1 : s.age < 60 ? 1 : s.age < 180 ? 0.62 : 0.38); ctx.strokeStyle = '#fff6e3'; ctx.lineWidth = 1.1; ctx.stroke();
        } else {
          ctx.globalAlpha = k * ([1, 0.8, 0.5][s.tier] ?? 0.5); ctx.fillStyle = s.color; ctx.fill();
        }
      }

      // Names beside well-tracked moving ships once zoomed in, never overlapping each other.
      if (zoom >= 9) {
        ctx.font = '10px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
        const used: [number, number, number, number][] = [];
        for (const s of f.ships) {
          if (s.tier !== 0 || !s.name || s.mmsi === selected) continue;
          const x = s.x + 9, y = s.y - 9, w = ctx.measureText(s.name).width;
          if (x > W || y < 0 || used.some(([a, b, c, d]) => x < c && x + w > a && y - 6 < d && y + 6 > b)) continue;
          used.push([x, y - 6, x + w, y + 6]);
          haloText(ctx, s.name, x, y, 0.8 * intro(0));
        }
      }

      // Pings: a ring swells and fades where fresh real data just landed.
      const pingList: [string, number][] = [...replayPings, ...(replaying ? [] : [...pings])];
      if (pingList.length) {
        const pos = new Map<string, { x: number; y: number }>();
        for (const s of f.ships) pos.set(s.mmsi, s); for (const d of f.dots) pos.set(d.mmsi, d);
        ctx.strokeStyle = AMBER; ctx.lineWidth = 1.2;
        for (const [m, at] of pingList) {
          const a = (now - at) / 900;
          if (a >= 1) { replayPings.delete(m); continue; }
          const p = pos.get(m); if (!p || a < 0) continue;
          const e = easeOut(a);
          ctx.globalAlpha = 0.6 * (1 - e); ctx.beginPath(); ctx.arc(p.x, p.y, 3 + 13 * e, 0, Math.PI * 2); ctx.stroke();
        }
      }

      if (f.hov && hoverRef.current !== selected) {
        ctx.globalAlpha = 0.85; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(f.hov.x, f.hov.y, 8, 0, Math.PI * 2); ctx.stroke();
      }
      if (selected && f.sel) drawSelectionMark(f.sel.x, f.sel.y, now);
      ctx.globalAlpha = 1; ctx.strokeStyle = AMBER;
    };

    /** The selected ship's day: real track solid, silent stretches dashed, drawn on after the brackets land. */
    function drawSelectionTrail(mmsi: string, tMin: number, now: number) {
      const model = useReplayStore.getState().model;
      const drawOn = reduce ? 1 : easeOut(clamp01((now - selAt - 350) / 700));
      if (model && drawOn > 0) {
        const pts = model.trailBehind(mmsi, tMin, 1440), n = Math.floor(pts.length * drawOn);
        const real = new Path2D(), ghost = new Path2D();
        for (let k = 1; k < n; k++) {
          const a = map.project([pts[k - 1].lon, pts[k - 1].lat]), b = map.project([pts[k].lon, pts[k].lat]), p = pts[k].estimated ? ghost : real;
          p.moveTo(a.x, a.y); p.lineTo(b.x, b.y);
        }
        ctx!.strokeStyle = AMBER; ctx!.lineWidth = 2; ctx!.globalAlpha = 0.85; ctx!.stroke(real);
        ctx!.lineWidth = 1.2; ctx!.globalAlpha = 0.4; ctx!.setLineDash([2, 3]); ctx!.stroke(ghost); ctx!.setLineDash([]);
      }
      // Estimate cone: widening with time since the last fix, fading toward the horizon.
      const cone = reduce ? 1 : easeOut(clamp01((now - selAt - 850) / 450));
      const replay = useReplayStore.getState();
      const source = replay.active && replay.model ? replay.model : useTrackStore.getState().nowcaster;
      const ahead = source.pathAhead(mmsi, tMin, 60, 3), s0 = source.sample(mmsi, tMin);
      const u = useTrackStore.getState().byMmsi.get(mmsi)?.uncert ?? 0.03;
      if (cone <= 0 || ahead.length < 2 || !s0) return;
      const P = ahead.map(([lon, lat]) => map.project([lon, lat])), pxPerNm = map.project([0, 0]).y - map.project([0, 1 / 60]).y;
      const left: [number, number][] = [], right: [number, number][] = [];
      P.forEach((p, k) => {
        const a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)], dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1;
        const r = (0.15 + u * (s0.age + k * 3)) * pxPerNm * cone;
        left.push([p.x - (dy / m) * r, p.y + (dx / m) * r]); right.push([p.x + (dy / m) * r, p.y - (dx / m) * r]);
      });
      const grad = ctx!.createLinearGradient(P[0].x, P[0].y, P[P.length - 1].x, P[P.length - 1].y);
      grad.addColorStop(0, 'rgba(245,158,11,0.16)'); grad.addColorStop(1, 'rgba(245,158,11,0)');
      ctx!.beginPath(); ctx!.moveTo(left[0][0], left[0][1]);
      for (const p of left) ctx!.lineTo(p[0], p[1]);
      for (let k = right.length - 1; k >= 0; k--) ctx!.lineTo(right[k][0], right[k][1]);
      ctx!.closePath(); ctx!.globalAlpha = 1; ctx!.fillStyle = grad; ctx!.fill();
    }

    /** Corner brackets snap in around the selected ship. */
    function drawSelectionMark(x: number, y: number, now: number) {
      const ring = reduce ? 1 : easeOut(clamp01((now - selAt) / 180)), q = 13 + 16 * (1 - ring);
      ctx!.globalAlpha = 0.1 * ring; ctx!.fillStyle = AMBER; ctx!.beginPath(); ctx!.arc(x, y, q, 0, Math.PI * 2); ctx!.fill();
      ctx!.globalAlpha = ring; ctx!.strokeStyle = AMBER; ctx!.lineWidth = 1.5; ctx!.beginPath();
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx!.moveTo(x + dx * q, y + dy * (q - 5)); ctx!.lineTo(x + dx * q, y + dy * q); ctx!.lineTo(x + dx * (q - 5), y + dy * q);
      }
      ctx!.stroke();
    }

    raf = requestAnimationFrame(loop);
    map.on('render', onRender);
    return () => { cancelAnimationFrame(raf); map.off('render', onRender); };
  }, [map, frameRef, hoverRef]);

  return <canvas ref={canvas} data-testid="motion-overlay" aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none z-[1]" />;
}
