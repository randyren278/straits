'use client';

/**
 * Alert notification bell with dropdown.
 * Shows active anomalies with ship type filter (All / Tanker / Cargo / Other).
 * Filtering is display-only — detection logic is not changed.
 * Requirements: ANOM-02, ANOM-06, HIST-02, PANL-04
 */
import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useVesselStore } from '@/stores/vessel';
import { AnomalyBadge } from './AnomalyBadge';
import type { AnomalyType, Anomaly } from '@/types/anomaly';

type ShipTypeFilter = 'all' | 'tanker' | 'cargo' | 'other';

const FILTER_BUTTONS: { value: ShipTypeFilter; label: string }[] = [
  { value: 'all', label: 'ALL' },
  { value: 'tanker', label: 'TANKER' },
  { value: 'cargo', label: 'CARGO' },
  { value: 'other', label: 'OTHER' },
];

export function NotificationBell() {
  const { setMapCenter } = useVesselStore();
  const [isOpen, setIsOpen] = useState(false);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [shipTypeFilter, setShipTypeFilter] = useState<ShipTypeFilter>('all');

  // Ref to track current filter inside interval closure (avoids stale closure)
  const shipTypeFilterRef = useRef<ShipTypeFilter>('all');

  const fetchAnomalies = async (filter: ShipTypeFilter) => {
    try {
      const url =
        filter !== 'all'
          ? `/api/anomalies?shipType=${filter}`
          : '/api/anomalies';
      const res = await fetch(url);
      const data = await res.json();
      setAnomalies(data.anomalies || []);
    } catch (err) {
      console.error('Failed to fetch anomalies:', err);
    }
  };

  // Fetch anomalies on mount and every 30 seconds (respects current filter via ref)
  useEffect(() => {
    fetchAnomalies(shipTypeFilterRef.current);

    const interval = setInterval(() => {
      fetchAnomalies(shipTypeFilterRef.current);
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterClick = (filter: ShipTypeFilter) => {
    setShipTypeFilter(filter);
    shipTypeFilterRef.current = filter;
    fetchAnomalies(filter);
  };

  const handleAnomalyClick = (anomaly: Anomaly) => {
    const details = anomaly.details as unknown as Record<string, unknown>;
    if (details?.lastPosition) {
      const pos = details.lastPosition as { lat: number; lon: number };
      setMapCenter({ lat: pos.lat, lon: pos.lon, zoom: 10 });
    } else if (details?.centroid) {
      const pos = details.centroid as { lat: number; lon: number };
      setMapCenter({ lat: pos.lat, lon: pos.lon, zoom: 10 });
    }

    setIsOpen(false);
  };

  const unreadCount = anomalies.length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} active)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop for closing */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-black border border-amber-500/20 shadow-xl z-50 max-h-96 overflow-hidden">
            <div className="p-3 border-b border-gray-700 flex justify-between items-center">
              <span className="font-semibold text-white">Alerts</span>
              <span className="text-xs text-gray-500">{unreadCount} active</span>
            </div>

            {/* Ship type filter buttons */}
            <div className="flex gap-1 px-3 py-2 border-b border-gray-700">
              {FILTER_BUTTONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleFilterClick(value)}
                  className={`px-2 py-0.5 text-xs font-mono uppercase border transition-colors ${
                    shipTypeFilter === value
                      ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto max-h-72">
              {anomalies.length === 0 ? (
                <div className="p-4 text-gray-400 text-center">No alerts</div>
              ) : (
                anomalies.slice(0, 20).map((anomaly) => (
                  <div
                    key={anomaly.id}
                    onClick={() => handleAnomalyClick(anomaly)}
                    className="p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-white">
                        {anomaly.imo}
                      </span>
                      {anomaly.anomalyType === 'sts_transfer' && anomaly.details && (
                        <span className="text-xs text-gray-400 font-mono ml-1">
                          + {(anomaly.details as { otherName?: string; otherImo?: string }).otherName
                            || (anomaly.details as { otherImo?: string }).otherImo
                            || 'unknown'}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(anomaly.detectedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="mt-1">
                      <AnomalyBadge
                        type={anomaly.anomalyType as AnomalyType}
                        confidence={anomaly.confidence}
                        size="sm"
                      />
                    </div>
                    {anomaly.anomalyType === 'sts_transfer' && anomaly.details && (
                      <div className="text-xs text-gray-500 mt-0.5 font-mono">
                        Proximity with {(anomaly.details as { otherName?: string; otherImo?: string }).otherName
                          || (anomaly.details as { otherImo?: string }).otherImo
                          || 'unknown vessel'}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
