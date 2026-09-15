'use client';

/**
 * One line under an analytics chart saying how well the region behind it is
 * observed. A chart of distinct contacts per day means nothing without this:
 * a dip can be fewer ships or a quiet receiver, and only the collection record
 * tells them apart.
 */
import { QualityChip } from '@/components/ui/QualityChip';
import { ObservationStrip } from '@/components/ui/ObservationHeatmap';
import type { ChokepointCoverage } from '@/lib/hooks/useCoverageQuality';
import type { RegionHistory } from '@/lib/hooks/useCoverageHistory';

interface ChartQualityRowProps {
  chokepointId: string;
  coverage: ChokepointCoverage | null | undefined;
  /** 7-day hourly record for this chokepoint; renders the strip when present. */
  history?: RegionHistory | null;
}

export function ChartQualityRow({ chokepointId, coverage, history = null }: ChartQualityRowProps) {
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
        <div className="mt-2 overflow-x-auto" title="Hour-by-hour collection record, last 7 days">
          <ObservationStrip rows={[{ id: history.id, label: '7d', hours: history.hours }]} windowHours={168} cell={5} gap={1} showLabels={false} testId={`chart-heat-${chokepointId}`} />
        </div>
      )}
    </div>
  );
}
