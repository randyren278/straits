'use client';

/**
 * Observation record rail panel: the 7-day, hour-by-hour collection grid for
 * one chokepoint at a time. This is the evidence behind the quality chips —
 * a dip in traffic and a quiet receiver look identical on the map, and only
 * this grid tells them apart.
 */
import { useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import { useCoverageHistory } from '@/lib/hooks/useCoverageHistory';
import { useCoverageQuality } from '@/lib/hooks/useCoverageQuality';
import { ObservationWeeks, HeatLegend } from '@/components/ui/ObservationHeatmap';
import { QualityChip, describeBasis } from '@/components/ui/QualityChip';

export function ObservationPanel() {
  const history = useCoverageHistory(168);
  const quality = useCoverageQuality();
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState('suez');

  const region = history?.find((r) => r.id === active) ?? null;

  return (
    <div className="bg-black" role="region" aria-label="Observation record" data-testid="observation-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full px-3 py-1.5 border-b border-amber-500/20 flex items-center gap-2 hover:bg-amber-500/5"
      >
        <Activity className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">Observation record</span>
        <span className="ml-auto text-[10px] font-mono text-gray-500">7d · hourly</span>
        <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 py-2">
          <div className="flex gap-1 mb-2" role="tablist" aria-label="Chokepoint">
            {(history ?? []).map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={active === r.id}
                onClick={() => setActive(r.id)}
                className={`flex-1 text-[9px] font-mono uppercase tracking-wider px-1 py-1 border ${active === r.id ? 'border-amber-500 text-amber-500 bg-amber-500/10' : 'border-gray-800 text-gray-500 hover:bg-amber-500/5'}`}
              >
                {r.name.replace('Strait of ', '').replace(' Canal', '').replace('Bab el-Mandeb', 'Bab el-M.').replace('Gulf of ', '')}
              </button>
            ))}
          </div>
          {region && quality?.[region.id] && (
            <div className="mb-2 flex flex-col gap-0.5">
              <QualityChip id={`panel-${region.id}`} quality={quality[region.id].quality} basis={quality[region.id].basis} />
              <span className="text-[10px] font-mono text-gray-500 leading-snug">{describeBasis(quality[region.id].basis)}</span>
            </div>
          )}
          {region ? (
            <div className="overflow-x-auto">
              <ObservationWeeks row={{ id: region.id, label: region.name, hours: region.hours }} cell={9} gap={2} />
            </div>
          ) : (
            <p className="text-[11px] font-mono text-gray-600">loading collection record…</p>
          )}
          <div className="mt-2"><HeatLegend /></div>
        </div>
      )}
    </div>
  );
}
