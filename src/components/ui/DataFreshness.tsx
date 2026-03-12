'use client';

/**
 * Data freshness indicator component.
 * Shows time since last data update with color coding.
 * Requirements: MAP-05
 */
import { useEffect, useState } from 'react';
import { useVesselStore } from '@/stores/vessel';
import { formatDistanceToNow } from 'date-fns';

export function DataFreshness() {
  const { lastUpdate } = useVesselStore();
  const [, setTick] = useState(0);

  // Force re-render every 10 seconds to update relative time
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  if (!lastUpdate) {
    return (
      <span className="text-gray-500 text-sm flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
        Loading...
      </span>
    );
  }

  const ageMs = Date.now() - lastUpdate.getTime();
  const ageMinutes = ageMs / 60000;

  // Color coding based on data age
  let colorClass = 'text-green-400'; // < 2 min
  let dotColor = 'bg-green-400';
  if (ageMinutes > 5) {
    colorClass = 'text-red-400';
    dotColor = 'bg-red-400';
  } else if (ageMinutes > 2) {
    colorClass = 'text-yellow-400';
    dotColor = 'bg-yellow-400';
  }

  return (
    <span className={`text-sm ${colorClass} flex items-center gap-1`}>
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      {formatDistanceToNow(lastUpdate, { addSuffix: true })}
    </span>
  );
}
