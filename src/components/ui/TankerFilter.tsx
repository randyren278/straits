'use client';

/**
 * Tanker filter toggle button.
 * Toggles between showing all vessels or tankers only.
 * Requirements: MAP-03
 */
import { useVesselStore } from '@/stores/vessel';

export function TankerFilter() {
  const { tankersOnly, setTankersOnly } = useVesselStore();

  return (
    <button
      onClick={() => setTankersOnly(!tankersOnly)}
      className={`px-3 py-1 text-xs font-mono uppercase tracking-wider border transition-colors ${
        tankersOnly
          ? 'border-amber-500 text-amber-500 bg-amber-500/10'
          : 'border-gray-600 text-gray-300 hover:text-white hover:border-gray-500'
      }`}
    >
      {tankersOnly ? 'Tankers Only' : 'All Vessels'}
    </button>
  );
}
