'use client';

/**
 * Vessel detail side panel component.
 * Displays selected vessel information with track toggle.
 * Requirements: MAP-02, MAP-04, INTL-01
 */
import { useVesselStore } from '@/stores/vessel';
import { AlertTriangle } from 'lucide-react';

export function VesselPanel() {
  const { selectedVessel, showTrack, setShowTrack, setSelectedVessel } =
    useVesselStore();

  if (!selectedVessel) return null;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-80 bg-[#16162a] border-l border-gray-800 p-4 overflow-y-auto
                    max-md:w-full max-md:h-1/2 max-md:top-auto max-md:border-l-0 max-md:border-t max-md:rounded-t-2xl
                    z-10"
    >
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold text-white">{selectedVessel.name}</h2>
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
