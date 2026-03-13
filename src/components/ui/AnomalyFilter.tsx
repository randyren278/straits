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
      className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${
        anomalyFilter
          ? 'border-amber-500 text-amber-500 bg-amber-500/10'
          : 'border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600'
      }`}
      title={anomalyFilter ? 'Show all vessels' : 'Show only vessels with anomalies'}
    >
      <AlertTriangle className="w-4 h-4" />
      <span>Anomalies</span>
    </button>
  );
}
