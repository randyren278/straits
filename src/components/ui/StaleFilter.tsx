'use client';

/**
 * Stale contacts toggle. Ships with no fix in 24 h are hidden by default: their dot would
 * show where they were, not where they are.
 */
import { History } from 'lucide-react';
import { useTrackStore } from '@/stores/tracks';

export function StaleFilter() {
  const { showStale, setShowStale } = useTrackStore();

  return (
    <button
      onClick={() => setShowStale(!showStale)}
      aria-pressed={showStale}
      className={`flex items-center gap-2 px-3 py-1.5 phone:min-h-[44px] tablet:min-h-[44px] text-xs font-mono uppercase tracking-wider border transition-colors ${
        showStale
          ? 'border-amber-500 text-amber-500 bg-amber-500/10'
          : 'border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600'
      }`}
      title={showStale ? 'Hide ships with no fix in 24 hours' : 'Show ships with no fix in 24 hours'}
    >
      <History className="w-4 h-4" />
      <span>Stale</span>
    </button>
  );
}
