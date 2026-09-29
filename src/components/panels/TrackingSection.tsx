'use client';
/** Evidence breakdown and estimate basis for the selected vessel. */
import { useEffect, useState } from 'react';
import { useTrackStore } from '@/stores/tracks';

const TIER = ['Well tracked', 'Tracked', 'Sparse'];
const PARTS: [string, number][] = [['Fix volume', 30], ['Recency', 25], ['Regularity', 15], ['Consistency', 15], ['Identity', 15]];
const METHOD = { hybrid: 'on its smoothed course, bending through open water where that course meets land', sea: 'along a sea route that favours the lanes other ships use', damped: 'slowing on its course, the way ships approaching an anchorage do' } as const;

export function TrackingSection({ mmsi }: { mmsi: string }) {
  const p = useTrackStore((s) => s.byMmsi.get(mmsi));
  // A ticking clock keeps "estimated for N min" honest while the panel stays open.
  const [nowMin, setNowMin] = useState(() => Date.now() / 60000);
  useEffect(() => { const id = setInterval(() => setNowMin(Date.now() / 60000), 30_000); return () => clearInterval(id); }, []);
  if (!p) return null;
  const since = Math.max(0, Math.round(nowMin - p.lastRealAt));
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
