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
    <div
      className="absolute right-0 top-0 bottom-0 w-80 bg-[#16162a] border-l border-gray-800 p-4 overflow-y-auto
                    max-md:w-full max-md:h-1/2 max-md:top-auto max-md:border-l-0 max-md:border-t max-md:rounded-t-2xl
                    z-10"
    >
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold text-white">{selectedVessel.name}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleWatchlist}
            className={`p-2 rounded ${
              isWatched ? 'bg-amber-500 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
            }`}
            title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {isWatched ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setSelectedVessel(null)}
            className="text-gray-400 hover:text-white p-1"
            aria-label="Close panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">IMO</span>
          <span className="text-white font-mono">
            {selectedVessel.imo || 'N/A'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">MMSI</span>
          <span className="text-white font-mono">{selectedVessel.mmsi}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Flag</span>
          <span className="text-white">{selectedVessel.flag || 'Unknown'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Ship Type</span>
          <span className="text-white">
            {selectedVessel.shipType >= 80 && selectedVessel.shipType <= 89
              ? `Tanker (${selectedVessel.shipType})`
              : selectedVessel.shipType}
          </span>
        </div>
        <hr className="border-gray-700" />
        <div className="flex justify-between">
          <span className="text-gray-400">Speed</span>
          <span className="text-white">
            {selectedVessel.position?.speed?.toFixed(1) ?? 'N/A'} kn
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Heading</span>
          <span className="text-white">
            {selectedVessel.position?.heading ?? 'N/A'}
            {selectedVessel.position?.heading != null && '\u00B0'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Course</span>
          <span className="text-white">
            {selectedVessel.position?.course ?? 'N/A'}
            {selectedVessel.position?.course != null && '\u00B0'}
          </span>
        </div>
        <hr className="border-gray-700" />
        <div className="flex justify-between">
          <span className="text-gray-400">Destination</span>
          <span className="text-white">
            {selectedVessel.destination || 'Not reported'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Position</span>
          <span className="text-white font-mono text-xs">
            {selectedVessel.position?.latitude.toFixed(4)},{' '}
            {selectedVessel.position?.longitude.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Sanctions Alert Section */}
      {'isSanctioned' in selectedVessel &&
        (selectedVessel as Record<string, unknown>).isSanctioned === true && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-semibold">SANCTIONED</span>
          </div>
          <p className="text-sm text-red-300 mt-1">
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
        <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <AnomalyBadge
              type={vesselWithAnomaly.anomalyType as AnomalyType}
              confidence={(vesselWithAnomaly.anomalyConfidence as Confidence) || 'unknown'}
              size="md"
            />
            <span className="text-orange-400 text-sm">Anomaly Detected</span>
          </div>
          <div className="mt-2 text-sm text-gray-400">
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

      <button
        onClick={() => setShowTrack(!showTrack)}
        className={`w-full mt-6 py-2 rounded font-medium transition-colors
          ${
            showTrack
              ? 'bg-amber-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
      >
        {showTrack ? 'Hide Track' : 'Show Track History'}
      </button>
    </div>
  );
}
