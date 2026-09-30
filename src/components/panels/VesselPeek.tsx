'use client';
/**
 * Phone bar for the selected ship: one 56 px row — who it is, what it is doing, whether the
 * position is real or estimated — so the map stays the screen. Tap the row (or swipe up) to
 * open details beneath it, capped by the sheet; swipe down to fold, then to dismiss.
 */
import { useEffect, useRef, useState } from 'react';
import { X, ChevronUp } from 'lucide-react';
import { useVesselStore } from '@/stores/vessel';
import { useTrackStore } from '@/stores/tracks';
import { compactAge } from '@/components/ui/StatusChip';

export function VesselPeek({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
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
  const status = underway
    ? `${track!.sog.toFixed(1)} kn · ${String(track!.cog).padStart(3, '0')}° · ${sinceFix !== null && sinceFix > 10 ? `est ${sinceFix}m ±${(0.15 + track!.uncert * sinceFix).toFixed(1)} nm` : 'real'}`
    : `${track ? 'At rest' : 'Last known'}${fixTime && !Number.isNaN(fixTime.getTime()) ? ` · ${compactAge(fixTime, nowMs)} ago` : ''}`;

  return (
    <div
      data-testid="vessel-peek"
      className="sticky top-0 z-10 h-14 bg-black flex items-center gap-1 pl-4 font-mono select-none touch-pan-x border-b border-amber-500/20"
      onPointerDown={(e) => { startY.current = e.clientY; }}
      onPointerUp={(e) => {
        if (startY.current === null) return;
        const dy = e.clientY - startY.current; startY.current = null;
        if (dy < -30 && !expanded) onToggle();
        else if (dy > 30) { if (expanded) onToggle(); else setSelectedVessel(null); }
      }}
    >
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={expanded ? 'Hide details' : 'Show details'}
        className="min-w-0 flex-1 h-full text-left flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block text-white text-sm truncate">{vessel.name || vessel.mmsi}</span>
          <span className={`block text-[10px] uppercase tracking-wider truncate ${underway ? 'text-amber-500' : 'text-gray-400'}`}>{status}</span>
        </span>
        <ChevronUp className={`w-4 h-4 shrink-0 text-amber-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      <button type="button" aria-label="Close" onClick={() => setSelectedVessel(null)} className="h-14 w-12 shrink-0 flex items-center justify-center text-gray-400">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
