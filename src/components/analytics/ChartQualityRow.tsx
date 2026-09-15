'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * One line under an analytics chart saying how well the region behind it is
 * observed. A chart of distinct contacts per day means nothing without this:
 * a dip can be fewer ships or a quiet receiver, and only the collection record
 * tells them apart.
 */
import { QualityChip } from '@/components/ui/QualityChip';
import { ObservationWeeks } from '@/components/ui/ObservationHeatmap';
import type { ChokepointCoverage } from '@/lib/hooks/useCoverageQuality';
import type { RegionHistory } from '@/lib/hooks/useCoverageHistory';

interface ChartQualityRowProps {
  chokepointId: string;
  coverage: ChokepointCoverage | null | undefined;
  /** 7-day hourly record for this chokepoint; renders the strip when present. */
  history?: RegionHistory | null;
}

export function ChartQualityRow({ chokepointId, coverage, history = null }: ChartQualityRowProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      data-testid={`chart-quality-${chokepointId}`}
      className="px-4 py-1.5 border border-t-0 border-amber-500/20 bg-black text-[11px] font-mono"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="uppercase tracking-wider text-gray-500">Observation quality · last 24h</span>
        {coverage ? (
          <QualityChip id={`chart-${chokepointId}`} quality={coverage.quality} basis={coverage.basis} variant="full" />
        ) : (
          <span className="text-gray-600">loading collection record…</span>
        )}
      </div>
      {history && (
        <div ref={gridRef} className="mt-2" data-testid={`chart-heat-${chokepointId}`} title="Hour-by-hour collection record, last 7 days (UTC)">
          {width > 0 && <ObservationWeeks row={{ id: `chart-${history.id}`, label: history.name, hours: history.hours }} width={width} cellHeight={10} gap={2} />}
        </div>
      )}
    </div>
  );
}
