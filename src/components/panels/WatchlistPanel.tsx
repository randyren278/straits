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
    <div className="bg-black">
      {/* Terminal panel header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-1.5 border-b border-amber-500/20 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Eye className="w-3 h-3 text-amber-500" />
          <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">
            WATCHLIST ({watchlist.length})
          </span>
        </span>
        {isExpanded ? (
          <ChevronUp className="w-3 h-3 text-amber-500/60" />
        ) : (
          <ChevronDown className="w-3 h-3 text-amber-500/60" />
        )}
      </button>

      {isExpanded && (
        <div className="overflow-y-auto">
          {watchlistWithVessel.map((entry) => (
            <div
              key={entry.imo}
              className="px-3 py-2 border-b border-amber-500/10 hover:bg-white/5 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => handleVesselClick(entry)}
                >
                  <span className="font-mono text-white text-xs">
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
                  className="text-gray-600 hover:text-red-400 transition-colors p-1"
                  title="Remove from watchlist"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
