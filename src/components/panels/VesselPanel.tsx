'use client';

/**
 * Vessel detail side panel component.
 * Displays selected vessel information with track toggle, anomaly section, and watchlist button.
 * Requirements: MAP-02, MAP-04, INTL-01, ANOM-01, HIST-02
 */
import { useState, useEffect } from 'react';
import { useVesselStore } from '@/stores/vessel';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AnomalyBadge } from '../ui/AnomalyBadge';
import type { AnomalyType, Confidence } from '@/types/anomaly';

export function VesselPanel() {
  const { selectedVessel, showTrack, setShowTrack, setSelectedVessel, watchlist, addToWatchlist, removeFromWatchlist } =
    useVesselStore();
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

  if (!selectedVessel) return null;

  const isWatched = watchlist.some(w => w.imo === selectedVessel.imo);

  const handleWatchlist = async () => {
    if (!userId) return;

    if (isWatched) {
      removeFromWatchlist(selectedVessel.imo);
      await fetch(`/api/watchlist?imo=${selectedVessel.imo}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId },
      });
    } else {
      addToWatchlist({ userId, imo: selectedVessel.imo, addedAt: new Date(), notes: null });
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ imo: selectedVessel.imo }),
      });
    }
  };

  // Extract anomaly data from selectedVessel (if present via extended type)
  const vesselWithAnomaly = selectedVessel as typeof selectedVessel & {
    anomalyType?: string | null;
    anomalyConfidence?: string | null;
    anomalyDetectedAt?: Date | null;
  };

  return (
    <div className="bg-black">
      {/* Terminal panel header */}
      <div className="px-3 py-1.5 border-b border-amber-500/20 flex items-center justify-between">
        <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">VESSEL DETAIL</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleWatchlist}
            className={`p-1 ${
              isWatched ? 'text-amber-500' : 'text-gray-500 hover:text-white'
            }`}
            title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {isWatched ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setSelectedVessel(null)}
            className="text-gray-500 hover:text-white p-1"
            aria-label="Close panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Vessel name */}
      <div className="px-3 py-2 border-b border-amber-500/10">
        <span className="font-mono text-white text-xs">{selectedVessel.name}</span>
      </div>

      {/* Data rows */}
      <div className="px-3 py-2 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">IMO</span>
          <span className="font-mono text-white">{selectedVessel.imo || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">MMSI</span>
          <span className="font-mono text-white">{selectedVessel.mmsi}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Flag</span>
          <span className="font-mono text-white">{selectedVessel.flag || 'Unknown'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Type</span>
          <span className="font-mono text-white">
            {selectedVessel.shipType >= 80 && selectedVessel.shipType <= 89
              ? `Tanker (${selectedVessel.shipType})`
              : selectedVessel.shipType}
          </span>
        </div>
        <div className="border-t border-amber-500/10 pt-1.5">
          <div className="flex justify-between mb-1.5">
            <span className="text-gray-500">Speed</span>
            <span className="font-mono text-white">
              {selectedVessel.position?.speed?.toFixed(1) ?? 'N/A'} kn
            </span>
          </div>
          <div className="flex justify-between mb-1.5">
            <span className="text-gray-500">Heading</span>
            <span className="font-mono text-white">
              {selectedVessel.position?.heading ?? 'N/A'}
              {selectedVessel.position?.heading != null && '\u00B0'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Course</span>
            <span className="font-mono text-white">
              {selectedVessel.position?.course ?? 'N/A'}
              {selectedVessel.position?.course != null && '\u00B0'}
            </span>
          </div>
        </div>
        <div className="border-t border-amber-500/10 pt-1.5">
          <div className="flex justify-between mb-1.5">
            <span className="text-gray-500">Destination</span>
            <span className="font-mono text-white">{selectedVessel.destination || 'Not reported'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Position</span>
            <span className="font-mono text-white text-xs">
              {selectedVessel.position?.latitude.toFixed(4)},{' '}
              {selectedVessel.position?.longitude.toFixed(4)}
            </span>
          </div>
        </div>
      </div>

      {/* Sanctions Alert Section */}
      {'isSanctioned' in selectedVessel &&
        (selectedVessel as Record<string, unknown>).isSanctioned === true && (
        <div className="mx-3 mb-2 px-3 py-2 bg-red-900/30 border border-red-700">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">SANCTIONED</span>
          </div>
          <p className="text-xs text-red-300 mt-1">
            {('sanctioningAuthority' in selectedVessel &&
              (selectedVessel as Record<string, unknown>).sanctioningAuthority) as React.ReactNode}{' '}
            {'\u2022'}{' '}
            {'sanctionReason' in selectedVessel &&
              (selectedVessel as Record<string, unknown>).sanctionReason
              ? String((selectedVessel as Record<string, unknown>).sanctionReason)
              : 'Sanctioned entity'}
          </p>
        </div>
      )}

      {/* Anomaly Detection Section */}
      {vesselWithAnomaly.anomalyType && (
        <div className="mx-3 mb-2 px-3 py-2 bg-orange-500/10 border border-orange-500/30">
          <div className="flex items-center gap-2">
            <AnomalyBadge
              type={vesselWithAnomaly.anomalyType as AnomalyType}
              confidence={(vesselWithAnomaly.anomalyConfidence as Confidence) || 'unknown'}
              size="md"
            />
            <span className="text-orange-400 text-xs font-mono uppercase tracking-widest">Anomaly Detected</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {vesselWithAnomaly.anomalyType === 'going_dark' && 'AIS signal lost in coverage zone'}
            {vesselWithAnomaly.anomalyType === 'loitering' && 'Vessel loitering in open water'}
            {vesselWithAnomaly.anomalyType === 'speed' && 'Unusual speed detected (possible drift)'}
            {vesselWithAnomaly.anomalyType === 'deviation' && 'Vessel deviating from expected route'}
            {vesselWithAnomaly.anomalyDetectedAt && (
              <div className="text-xs mt-1">
                Detected: {formatDistanceToNow(new Date(vesselWithAnomaly.anomalyDetectedAt), { addSuffix: true })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Track toggle */}
      <div className="px-3 py-2">
        <button
          onClick={() => setShowTrack(!showTrack)}
          className={`w-full py-1.5 font-mono text-xs uppercase tracking-widest transition-colors border
            ${
              showTrack
                ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'
            }`}
        >
          {showTrack ? 'Hide Track' : 'Show Track History'}
        </button>
      </div>
    </div>
  );
}
