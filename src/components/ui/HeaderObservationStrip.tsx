'use client';

/**
 * The 24-hour observation record, one row per chokepoint, in the header's
 * second row. Sits next to the freshness readout so "how fresh" and "how well
 * observed" are read together; the full 7-day grid lives in the rail panel.
 */
import { useCoverageHistory } from '@/lib/hooks/useCoverageHistory';
import { ObservationStrip } from './ObservationHeatmap';

export function HeaderObservationStrip() {
  const history = useCoverageHistory(24);
  if (!history) return null;
  const SHORT: Record<string, string> = { hormuz: 'Hormuz', babel_mandeb: 'Bab el-M', suez: 'Suez', gulf_of_aden: 'Aden' };
  const rows = history.map((r) => ({ id: r.id, label: SHORT[r.id] ?? r.name, hours: r.hours }));
  return (
    <div data-testid="header-observation" className="flex flex-col gap-1" title="Observation record, last 24 h. Amber = contacts heard that hour; grey = attempted, nothing heard; black = harvester did not run.">
      <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">Observed · 24h</span>
      <ObservationStrip rows={rows} windowHours={24} cell={7} gap={2} />
    </div>
  );
}
