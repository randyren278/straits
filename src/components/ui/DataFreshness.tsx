'use client';

/**
 * Data freshness indicator component.
 * Shows time since last data update with color coding.
 * Requirements: MAP-05
 */
import { useEffect, useState } from 'react';
import { useVesselStore } from '@/stores/vessel';
import { formatDistanceToNow, isValid } from 'date-fns';

interface Freshness {
  label: string;
  colorClass: string;
  dotColor: string;
}

export function DataFreshness() {
  const { lastUpdate } = useVesselStore();
  const [freshness, setFreshness] = useState<Freshness | null>(null);

  const hasTimestamp = !!lastUpdate && isValid(lastUpdate);

  // Compute the relative-age label inside the tick (not during render) so the
  // impure clock call never happens in the render body. Recompute every 10s.
  useEffect(() => {
    if (!lastUpdate || !isValid(lastUpdate)) {
      return;
    }

    const compute = () => {
      const ageMinutes = (Date.now() - lastUpdate.getTime()) / 60000;
      let colorClass = 'text-green-400'; // < 2 min
      let dotColor = 'bg-green-400';
      if (ageMinutes > 5) {
        colorClass = 'text-red-400';
        dotColor = 'bg-red-400';
      } else if (ageMinutes > 2) {
        colorClass = 'text-yellow-400';
        dotColor = 'bg-yellow-400';
      }
      setFreshness({
        label: formatDistanceToNow(lastUpdate, { addSuffix: true }),
        colorClass,
        dotColor,
      });
    };

    compute();
    const interval = setInterval(compute, 10000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  // On routes that don't track vessels, lastUpdate is null: render nothing
  // rather than a perpetual "Loading..." pulse. Also render nothing until the
  // first tick has computed a label.
  if (!hasTimestamp || !freshness) {
    return null;
  }

  return (
    <span
      className={`text-sm font-mono whitespace-nowrap ${freshness.colorClass} flex items-center gap-1`}
      role="status"
      aria-label={`Data freshness: last updated ${freshness.label}`}
    >
      <span className={`w-2 h-2 ${freshness.dotColor}`} />
      {freshness.label}
    </span>
  );
}
