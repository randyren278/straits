'use client';

/**
 * Watchlist sidebar panel showing tracked vessels.
 * Requirements: HIST-02
 */
import { useState, useEffect } from 'react';
import { Eye, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useVesselStore } from '@/stores/vessel';
import { AnomalyBadge } from '../ui/AnomalyBadge';
import type { AnomalyType, Confidence, WatchlistEntry } from '@/types/anomaly';

interface WatchlistEntryWithVessel extends WatchlistEntry {
  vesselName?: string;
  anomalyType?: string;
  anomalyConfidence?: string;
  latitude?: number;
  longitude?: number;
}

export function WatchlistPanel() {
  const { watchlist, setWatchlist, removeFromWatchlist, setMapCenter } = useVesselStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Initialize user ID from localStorage
  useEffect(() => {
    let id = localStorage.getItem('tanker_tracker_user_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('tanker_tracker_user_id', id);
    }
    setUserId(id);
  }, []);

  // Fetch watchlist from API
  useEffect(() => {
    if (!userId) return;

    const fetchWatchlist = async () => {
      try {
        const res = await fetch('/api/watchlist', {
          headers: { 'X-User-Id': userId },
        });
        const data = await res.json();
        setWatchlist(data.watchlist || []);
      } catch (err) {
        console.error('Failed to fetch watchlist:', err);
      }
    };

    fetchWatchlist();
  }, [userId, setWatchlist]);

  const handleRemove = async (imo: string) => {
    if (!userId) return;

    removeFromWatchlist(imo);
    try {
      await fetch(`/api/watchlist?imo=${imo}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId },
      });
    } catch (err) {
      console.error('Failed to remove from watchlist:', err);
    }
  };

  const handleVesselClick = (entry: WatchlistEntryWithVessel) => {
    if (entry.latitude && entry.longitude) {
      setMapCenter({ lat: entry.latitude, lon: entry.longitude, zoom: 10 });
    }
  };

  // Don't render if watchlist is empty
  if (watchlist.length === 0) return null;

  const watchlistWithVessel = watchlist as WatchlistEntryWithVessel[];

  return (
    <div className="absolute left-4 top-20 w-72 bg-[#1e1e3f]/95 backdrop-blur border border-gray-700 rounded-lg shadow-xl z-40">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex justify-between items-center text-white hover:bg-[#252550] rounded-t-lg transition-colors"
      >
        <span className="flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Watchlist ({watchlist.length})
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-700 max-h-64 overflow-y-auto">
          {watchlistWithVessel.map((entry) => (
            <div
              key={entry.imo}
              className="p-3 border-b border-gray-800 hover:bg-[#252550] transition-colors"
            >
              <div className="flex justify-between items-start">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => handleVesselClick(entry)}
                >
                  <span className="text-white font-medium">
                    {entry.vesselName || entry.imo}
                  </span>
                  {entry.anomalyType && (
                    <div className="mt-1">
                      <AnomalyBadge
                        type={entry.anomalyType as AnomalyType}
                        confidence={(entry.anomalyConfidence as Confidence) || 'confirmed'}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(entry.imo);
                  }}
                  className="text-gray-500 hover:text-red-400 transition-colors p-1"
                  title="Remove from watchlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
