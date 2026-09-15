'use client';

/**
 * Observation-quality label for a region. Says whether Straits is *observing*
 * the region — never how much traffic is there. Same DOM shape as the
 * DataFreshness readout so the two sit together naturally.
 */
import { QUALITY_LABEL, type ObservationQuality } from '@/lib/constants/coverage';
import type { CoverageBasis } from '@/lib/hooks/useCoverageQuality';

const TONE: Record<ObservationQuality, { text: string; dot: string; border: string }> = {
  recent: { text: 'text-green-400', dot: 'bg-green-400', border: 'border-green-400/40' },
  intermittent: { text: 'text-yellow-300', dot: 'bg-yellow-300', border: 'border-yellow-300/40' },
  insufficient: { text: 'text-gray-500', dot: 'bg-gray-600', border: 'border-gray-700' },
};

export function describeBasis(basis: CoverageBasis): string {
  const fix = basis.latestFixAgeMinutes === null
    ? 'no fix in 24h'
    : basis.latestFixAgeMinutes < 60
      ? `latest fix ${basis.latestFixAgeMinutes}m ago`
      : `latest fix ${Math.round(basis.latestFixAgeMinutes / 60)}h ago`;
  return `${fix} · ${basis.nonEmptyLast6h}/6 hourly windows with data · ${basis.bucketsLast6h} collection windows attempted`;
}

interface QualityChipProps {
  id: string;
  quality: ObservationQuality;
  basis: CoverageBasis;
  /** Compact: dot + short label. Full: adds the basis inline. */
  variant?: 'compact' | 'full';
}

export function QualityChip({ id, quality, basis, variant = 'compact' }: QualityChipProps) {
  const tone = TONE[quality];
  const detail = describeBasis(basis);
  return (
    <span
      data-testid={`quality-chip-${id}`}
      data-quality={quality}
      title={detail}
      className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider ${tone.text} ${variant === 'full' ? `border ${tone.border} px-1.5 py-0.5` : ''}`}
    >
      <span className={`w-1.5 h-1.5 flex-shrink-0 ${tone.dot}`} aria-hidden="true" />
      <span>{QUALITY_LABEL[quality]}</span>
      {variant === 'full' && <span className="normal-case tracking-normal text-gray-500">· {detail}</span>}
    </span>
  );
}
