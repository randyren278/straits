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
      className={`px-3 py-1 rounded text-sm font-medium transition-colors
        ${
          tankersOnly
            ? 'bg-amber-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
    >
      {tankersOnly ? 'Tankers Only' : 'All Vessels'}
    </button>
  );
}
