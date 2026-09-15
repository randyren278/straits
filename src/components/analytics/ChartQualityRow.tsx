'use client';

/**
 * One line under an analytics chart saying how well the region behind it is
 * observed. A chart of distinct contacts per day means nothing without this:
 * a dip can be fewer ships or a quiet receiver, and only the collection record
 * tells them apart.
 */
import { QualityChip } from '@/components/ui/QualityChip';
import type { ChokepointCoverage } from '@/lib/hooks/useCoverageQuality';

interface ChartQualityRowProps {
  chokepointId: string;
  coverage: ChokepointCoverage | null | undefined;
}

export function ChartQualityRow({ chokepointId, coverage }: ChartQualityRowProps) {
  return (
    <div
      data-testid={`chart-quality-${chokepointId}`}
      className="flex items-center justify-between gap-3 px-4 py-1.5 border border-t-0 border-amber-500/20 bg-black text-[11px] font-mono"
    >
      <span className="uppercase tracking-wider text-gray-500">Observation quality · last 24h</span>
      {coverage ? (
        <QualityChip id={`chart-${chokepointId}`} quality={coverage.quality} basis={coverage.basis} variant="full" />
      ) : (
        <span className="text-gray-600">loading collection record…</span>
      )}
    </div>
  );
}
