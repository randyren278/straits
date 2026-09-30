'use client';
/**
 * Phone peek card for the selected ship: who it is, what it is doing, and whether the
 * position is real or estimated, in ~150 px so the map stays visible. Swipe up (or tap
 * Details) for the full dossier; swipe down to dismiss.
 */
import { useEffect, useRef, useState } from 'react';
import { X, ChevronUp } from 'lucide-react';
import { useVesselStore } from '@/stores/vessel';
import { useTrackStore } from '@/stores/tracks';
import { compactAge } from '@/components/ui/StatusChip';

export function VesselPeek({ onExpand }: { onExpand: () => void }) {
  const vessel = useVesselStore((s) => s.selectedVessel);
  const setSelectedVessel = useVesselStore((s) => s.setSelectedVessel);
  const track = useTrackStore((s) => (vessel ? s.byMmsi.get(vessel.mmsi) : undefined));
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNowMs(Date.now()), 30_000); return () => clearInterval(id); }, []);
  const startY = useRef<number | null>(null);
  if (!vessel) return null;

  const fixTime = vessel.position?.time ? new Date(vessel.position.time) : null;
  const sinceFix = track ? Math.max(0, Math.round(nowMs / 60000 - track.lastRealAt)) : null;
  const underway = track?.state === 'underway';
  const state = underway ? `Underway · ${track!.sog.toFixed(1)} kn · ${String(track!.cog).padStart(3, '0')}°` : track ? 'At rest' : 'Last known position';
  const basis = underway && sinceFix !== null && sinceFix > 10
    ? `Estimated · ${sinceFix} min since last fix · ±${(0.15 + track!.uncert * sinceFix).toFixed(1)} nm`
    : underway
      ? 'On real data'
      : fixTime && !Number.isNaN(fixTime.getTime()) ? `Observed ${compactAge(fixTime, nowMs)} ago` : 'No recent fix';

  return (
    <div
      data-testid="vessel-peek"
      className="px-4 pt-2 pb-3 font-mono select-none touch-pan-x"
      onPointerDown={(e) => { startY.current = e.clientY; }}
      onPointerUp={(e) => {
        if (startY.current === null) return;
        const dy = e.clientY - startY.current; startY.current = null;
        if (dy < -30) onExpand(); else if (dy > 40) setSelectedVessel(null);
      }}
    >
      <div className="mx-auto mb-2 h-1 w-10 bg-amber-500/50" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-white text-base truncate">{vessel.name || vessel.mmsi}</div>
          <div className="text-[11px] uppercase tracking-wider text-amber-500 mt-0.5">{state}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{basis}{vessel.destination ? ` · → ${vessel.destination}` : ''}</div>
        </div>
        <button type="button" aria-label="Close" onClick={() => setSelectedVessel(null)} className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 flex items-center justify-center text-gray-400">
          <X className="w-5 h-5" />
        </button>
      </div>
      <button type="button" onClick={onExpand} className="mt-2 w-full min-h-[40px] border border-amber-500/40 text-amber-500 text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5">
        <ChevronUp className="w-4 h-4" /> Details
      </button>
    </div>
  );
}
