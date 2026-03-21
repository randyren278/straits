'use client';

/**
 * Cluster expansion panel — shows a scrollable vessel list when a map cluster
 * can't be broken apart by zooming further (co-located vessels at a port,
 * anchorage, or terminal).
 *
 * Bloomberg terminal aesthetic: black bg, amber accents, JetBrains Mono,
 * sharp corners. Matches VesselPanel, ChokepointWidget, and other dropdowns.
 *
 * Clicking a vessel row selects it (opens VesselPanel) and dismisses this panel.
 */
import { useVesselStore } from '@/stores/vessel';
import { AlertTriangle, Ship, X } from 'lucide-react';
import type { ClusterVessel } from '@/stores/vessel';
import type { VesselWithSanctions } from '@/lib/db/sanctions';

function shipTypeLabel(shipType: number | null): string {
  if (shipType == null) return 'OTHER';
  if (shipType >= 80 && shipType <= 89) return 'TANKER';
  if (shipType >= 70 && shipType <= 79) return 'CARGO';
  if (shipType >= 60 && shipType <= 69) return 'PASSENGER';
  if (shipType >= 40 && shipType <= 49) return 'HSC';
  if (shipType >= 30 && shipType <= 39) return 'FISHING';
  return 'OTHER';
}

function vesselStatusDot(v: ClusterVessel): string {
  if (v.anomalyType) {
    switch (v.anomalyType) {
      case 'going_dark': return 'bg-red-500';
      case 'loitering': return 'bg-orange-500';
      case 'speed': return 'bg-blue-500';
      case 'deviation': return 'bg-purple-500';
      default: return 'bg-yellow-500';
    }
  }
  if (v.isSanctioned) return 'bg-red-500';
  return '';
}

function anomalyLabel(type: string): string {
  switch (type) {
    case 'going_dark': return 'DARK';
    case 'loitering': return 'LOITER';
    case 'speed': return 'SPEED';
    case 'deviation': return 'DEVIATE';
    case 'sts_transfer': return 'STS';
    case 'repeat_going_dark': return 'RPT DARK';
    default: return type.toUpperCase();
  }
}

export function ClusterPanel() {
  const clusterVessels = useVesselStore((s) => s.clusterVessels);
  const setClusterVessels = useVesselStore((s) => s.setClusterVessels);
  const setSelectedVessel = useVesselStore((s) => s.setSelectedVessel);

  if (!clusterVessels || clusterVessels.length === 0) return null;

  // Sort: anomalies first, then sanctioned, then tankers, then alphabetical
  const sorted = [...clusterVessels].sort((a, b) => {
    // Anomalies first
    if (a.anomalyType && !b.anomalyType) return -1;
    if (!a.anomalyType && b.anomalyType) return 1;
    // Sanctioned next
    if (a.isSanctioned && !b.isSanctioned) return -1;
    if (!a.isSanctioned && b.isSanctioned) return 1;
    // Tankers next
    const aIsTanker = a.shipType != null && a.shipType >= 80 && a.shipType <= 89;
    const bIsTanker = b.shipType != null && b.shipType >= 80 && b.shipType <= 89;
    if (aIsTanker && !bIsTanker) return -1;
    if (!aIsTanker && bIsTanker) return 1;
    // Alphabetical
    return (a.name || a.mmsi).localeCompare(b.name || b.mmsi);
  });

  const tankerCount = clusterVessels.filter(
    (v) => v.shipType != null && v.shipType >= 80 && v.shipType <= 89
  ).length;
  const anomalyCount = clusterVessels.filter((v) => v.anomalyType).length;
  const sanctionedCount = clusterVessels.filter((v) => v.isSanctioned).length;

  const handleVesselClick = (v: ClusterVessel) => {
    const vessel: VesselWithSanctions = {
      imo: v.imo,
      mmsi: v.mmsi,
      name: v.name,
      flag: v.flag,
      shipType: v.shipType,
      destination: v.destination,
      lastSeen: new Date(),
      isSanctioned: v.isSanctioned,
      sanctioningAuthority: null,
      sanctionReason: null,
      sanctionRiskCategory: v.sanctionRiskCategory,
      anomalyType: v.anomalyType,
      anomalyConfidence: v.anomalyConfidence,
      position: {
        time: new Date(),
        mmsi: v.mmsi,
        imo: v.imo,
        latitude: v.latitude,
        longitude: v.longitude,
        speed: v.speed,
        course: v.course,
        heading: v.heading,
        navStatus: null,
        lowConfidence: v.lowConfidence,
      },
    };
    setSelectedVessel(vessel);
  };

  return (
    <div className="bg-black">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-amber-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ship className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">
            {clusterVessels.length} VESSELS
          </span>
        </div>
        <button
          onClick={() => setClusterVessels(null)}
          className="text-gray-500 hover:text-white p-1"
          aria-label="Close cluster panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Summary stats */}
      <div className="px-3 py-1.5 border-b border-amber-500/10 flex gap-3 text-xs font-mono">
        {tankerCount > 0 && (
          <span className="text-amber-500">{tankerCount} tankers</span>
        )}
        {anomalyCount > 0 && (
          <span className="text-red-400">{anomalyCount} anomalies</span>
        )}
        {sanctionedCount > 0 && (
          <span className="text-red-400">{sanctionedCount} sanctioned</span>
        )}
        {tankerCount === 0 && anomalyCount === 0 && sanctionedCount === 0 && (
          <span className="text-gray-500">{clusterVessels.length} vessels at this location</span>
        )}
      </div>

      {/* Vessel list */}
      <div className="max-h-[400px] overflow-y-auto">
        {sorted.map((v, i) => {
          const dotClass = vesselStatusDot(v);
          return (
            <button
              key={v.imo || `${v.mmsi}-${i}`}
              onClick={() => handleVesselClick(v)}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-900 transition-colors text-left border-b border-gray-800/50"
            >
              {/* Status dot */}
              <span
                className={`w-2 h-2 flex-shrink-0 ${dotClass || 'bg-gray-600'}`}
              />

              {/* Vessel name + type */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-gray-200 truncate">
                    {v.name || v.mmsi}
                  </span>
                  {v.isSanctioned && (
                    <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                  )}
                </div>
                {v.anomalyType && (
                  <span className="text-[10px] font-mono text-red-400">
                    {anomalyLabel(v.anomalyType)}
                    {v.anomalyConfidence === 'confirmed' ? ' ●' : ' ○'}
                  </span>
                )}
              </div>

              {/* Flag */}
              <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                {v.flag || '??'}
              </span>

              {/* Ship type tag */}
              <span className="text-[10px] font-mono text-gray-600 flex-shrink-0 w-14 text-right">
                {shipTypeLabel(v.shipType)}
              </span>

              {/* Speed */}
              <span className="text-[10px] font-mono text-gray-600 flex-shrink-0 w-10 text-right">
                {v.speed != null ? `${v.speed.toFixed(1)}kn` : '—'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
