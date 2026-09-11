'use client';

/**
 * Data freshness indicator.
 *
 * Two numbers, deliberately kept apart:
 *  - REFRESHED — when the vessel API last answered (the polling cadence).
 *  - LATEST FIX — the newest AIS observation in that answer (how current the
 *    picture actually is).
 *
 * The old widget showed only the first and called it freshness, so a response
 * assembled "less than a minute ago" could carry positions from six days back
 * with nothing to say so. Coverage health (live / degraded / offline) lives in
 * StatusChip; this component reports ages only.
 * Requirements: MAP-05
 */
import { useEffect, useState } from 'react';
import { useVesselStore } from '@/stores/vessel';
import { isValid } from 'date-fns';
import { compactAge } from './StatusChip';

/** Observation-age tone. Thresholds match the /api/status AIS thresholds. */
export function observationTone(ageMinutes: number): { text: string; dot: string } {
  if (ageMinutes <= 15) return { text: 'text-green-400', dot: 'bg-green-400' };
  if (ageMinutes <= 60) return { text: 'text-yellow-400', dot: 'bg-yellow-400' };
  return { text: 'text-red-400', dot: 'bg-red-400' };
}

interface Ages {
  refreshed: string;
  fix: string | null;
  fixTone: { text: string; dot: string } | null;
}

export function DataFreshness() {
  const lastUpdate = useVesselStore((s) => s.lastUpdate);
  const lastObservation = useVesselStore((s) => s.lastObservation);
  const [ages, setAges] = useState<Ages | null>(null);

  const hasTimestamp = !!lastUpdate && isValid(lastUpdate);

  // Compute relative ages inside the tick (not during render) so the impure
  // clock call never happens in the render body. Recompute every 10s.
  useEffect(() => {
    if (!lastUpdate || !isValid(lastUpdate)) return;

    const compute = () => {
      const now = Date.now();
      const fixValid = !!lastObservation && isValid(lastObservation);
      setAges({
        refreshed: compactAge(lastUpdate, now),
        fix: fixValid ? compactAge(lastObservation, now) : null,
        fixTone: fixValid ? observationTone((now - lastObservation.getTime()) / 60000) : null,
      });
    };

    compute();
    const interval = setInterval(compute, 10000);
    return () => clearInterval(interval);
  }, [lastUpdate, lastObservation]);

  // On routes that don't track vessels, lastUpdate is null: render nothing
  // rather than a perpetual "Loading..." pulse.
  if (!hasTimestamp || !ages) return null;

  const fixLabel = ages.fix === null ? 'no fixes' : ages.fix === 'now' ? 'just now' : `${ages.fix} ago`;
  const refreshedLabel = ages.refreshed === 'now' ? 'just now' : `${ages.refreshed} ago`;

  return (
    <span
      data-testid="data-freshness"
      className="text-xs font-mono whitespace-nowrap flex items-center gap-3"
      role="status"
      aria-label={`Latest AIS fix ${fixLabel}; vessel data refreshed ${refreshedLabel}`}
    >
      <span className={`flex items-center gap-1 ${ages.fixTone?.text ?? 'text-gray-500'}`}>
        <span className={`w-2 h-2 ${ages.fixTone?.dot ?? 'bg-gray-600'}`} />
        <span className="uppercase tracking-wider text-[10px] text-gray-500">Latest fix</span>
        <span>{ages.fix ?? '—'}</span>
      </span>
      <span className="flex items-center gap-1 text-gray-500">
        <span className="uppercase tracking-wider text-[10px]">Refreshed</span>
        <span className="text-gray-400">{ages.refreshed}</span>
      </span>
    </span>
  );
}
