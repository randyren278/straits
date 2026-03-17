'use client';

/**
 * Chokepoint monitoring widgets showing vessel counts and live vessel lists.
 * Each widget expands to show a scrollable list of vessels inside the zone.
 * Clicking a vessel flies the map to its position and opens the identity panel.
 * Requirements: MAP-07, CHKP-01, CHKP-02
 */
import { useEffect, useState } from 'react';
import { Anchor, ChevronDown } from 'lucide-react';
import { useVesselStore } from '@/stores/vessel';

interface ChokepointData {
  id: string;
  name: string;
  totalVessels: number;
  tankerCount: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

interface ChokepointVessel {
  mmsi: string;
  imo: string | null;
  name: string | null;
  flag: string | null;
  shipType: number | null;
  latitude: number;
  longitude: number;
  hasActiveAnomaly: boolean;
  anomalyType: string | null;
}

interface ChokepointWidgetsProps {
  onSelect?: (bounds: ChokepointData['bounds'], name: string) => void;
}

function shipTypeLabel(shipType: number | null): string {
  if (shipType == null) return 'OTHER';
  if (shipType >= 80 && shipType <= 89) return 'TANKER';
  if (shipType >= 70 && shipType <= 79) return 'CARGO';
  return 'OTHER';
}

export function ChokepointWidgets({ onSelect }: ChokepointWidgetsProps) {
  const [chokepoints, setChokepoints] = useState<ChokepointData[]>([]);
  const [vesselMap, setVesselMap] = useState<Record<string, ChokepointVessel[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { setSelectedVessel, setMapCenter } = useVesselStore();

  const handleVesselClick = (vessel: ChokepointVessel) => {
    setSelectedVessel({
      imo: vessel.imo ?? '',
      mmsi: vessel.mmsi,
      name: vessel.name ?? vessel.mmsi,
      flag: vessel.flag ?? '',
      shipType: vessel.shipType ?? 0,
      destination: null,
      lastSeen: new Date(),
      position: {
        time: new Date(),
        mmsi: vessel.mmsi,
        imo: vessel.imo,
        latitude: vessel.latitude,
        longitude: vessel.longitude,
        speed: null,
        course: null,
        heading: null,
        navStatus: null,
        lowConfidence: false,
      },
    });
    setMapCenter({ lat: vessel.latitude, lon: vessel.longitude, zoom: 10 });
  };

  useEffect(() => {
    const fetchAllVessels = async (ids: string[]) => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`/api/chokepoints/${id}/vessels`);
          const data = await res.json();
          return [id, data.vessels ?? []] as [string, ChokepointVessel[]];
        })
      );
      setVesselMap(Object.fromEntries(entries));
    };

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/chokepoints');
        const data = await res.json();
        const cps: ChokepointData[] = data.chokepoints || [];
        setChokepoints(cps);
        await fetchAllVessels(cps.map((cp) => cp.id));
      } catch (error) {
        console.error('Failed to fetch chokepoints:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 30 seconds to match map vessel position polling
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;

  return (
    <div className="flex gap-2">
      {chokepoints.map((cp) => (
        <div
          key={cp.id}
          className="relative bg-black border border-amber-500/20 min-w-[160px] max-w-[200px]"
        >
          <button
            onClick={() => {
              setExpandedId(prev => prev === cp.id ? null : cp.id);
              onSelect?.(cp.bounds, cp.name);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-900 transition-colors"
          >
            <Anchor className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <div className="text-left flex-1">
              <p className="text-xs text-gray-300 font-medium whitespace-nowrap">
                {cp.name.replace('Strait of ', '').replace(' Canal', '')}
              </p>
              <p className="text-xs text-gray-500">
                {cp.tankerCount} tankers / {cp.totalVessels} total
              </p>
            </div>
            <ChevronDown
              className={`w-3 h-3 text-gray-600 flex-shrink-0 transition-transform ${
                expandedId === cp.id ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedId === cp.id && (
            <div className="absolute left-0 top-full z-50 min-w-[200px] bg-black border border-amber-500/20 border-t-0 shadow-lg">
              {(vesselMap[cp.id] ?? []).length === 0 ? (
                <p className="px-2 py-1 text-xs text-gray-600 font-mono">NO VESSELS</p>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {(vesselMap[cp.id] ?? []).map((v) => (
                    <button
                      key={v.mmsi}
                      onClick={() => handleVesselClick(v)}
                      className="w-full flex items-center gap-1.5 px-2 py-0.5 hover:bg-gray-900 text-left"
                    >
                      {v.hasActiveAnomaly && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                      )}
                      <span className="text-xs font-mono text-gray-200 truncate flex-1">
                        {v.name ?? v.mmsi}
                      </span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{v.flag ?? '??'}</span>
                      <span className="text-xs font-mono text-gray-600 flex-shrink-0">
                        {shipTypeLabel(v.shipType)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
