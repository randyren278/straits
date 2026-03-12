'use client';

/**
 * Anomaly filter toggle button.
 * Filters map to show only vessels with anomalies.
 * Requirements: ANOM-01
 */
import { AlertTriangle } from 'lucide-react';
import { useVesselStore } from '@/stores/vessel';

export function AnomalyFilter() {
  const { anomalyFilter, setAnomalyFilter } = useVesselStore();

  return (
    <button
      onClick={() => setAnomalyFilter(!anomalyFilter)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
        anomalyFilter
          ? 'bg-orange-500 text-white'
          : 'bg-gray-700 text-gray-300 hover:text-white'
      }`}
      title={anomalyFilter ? 'Show all vessels' : 'Show only vessels with anomalies'}
    >
      <AlertTriangle className="w-4 h-4" />
      <span className="text-sm">Anomalies</span>
    </button>
  );
}
