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
  const g = c.getContext('2d'); if (!g) return c;
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
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
  useEffect(() => { vesselsRef.current = vessels; }, [vessels]);

  useEffect(() => {
    const cv = canvas.current, ctx = cv?.getContext('2d');
    // No 2D canvas (blocked by the browser, or a test DOM): the dot layer still works alone.
    if (!cv || !ctx) return;
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
          ctx.globalAlpha = s.mmsi === selected ? 1 : s.age < 60 ? 1 : s.age < 180 ? 0.62 : 0.38; ctx.strokeStyle = '#fff6e3'; ctx.lineWidth = 1.1; ctx.stroke();
        } else {
          ctx.globalAlpha = [1, 0.8, 0.5][s.tier] ?? 0.5; ctx.fillStyle = s.color; ctx.fill();
        }
      }
      // Selection lock for a moving ship, drawn where the ship is drawn (same look as the map's ring layer).
      if (f.sel) {
        const rr = 9 + 7 * Math.max(0, Math.min(1, (map.getZoom() - 3) / 7));
        ctx.beginPath(); ctx.arc(f.sel.x, f.sel.y, rr, 0, Math.PI * 2);
        ctx.globalAlpha = 0.08; ctx.fillStyle = AMBER; ctx.fill();
        ctx.globalAlpha = 0.95; ctx.strokeStyle = AMBER; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.strokeStyle = AMBER;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [map, frameRef]);

  return <canvas ref={canvas} data-testid="motion-overlay" aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none z-[1]" />;
}
