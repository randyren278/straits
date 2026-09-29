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
import { useCoverageQuality } from '@/lib/hooks/useCoverageQuality';
import { QualityChip } from './QualityChip';
import { useChokepointStats, type ChokepointStat } from '@/lib/hooks/useChokepointStats';

type ChokepointData = ChokepointStat;

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
  navStatus?: number | null;
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
  const chokepoints = useChokepointStats();
  const [vesselMap, setVesselMap] = useState<Record<string, ChokepointVessel[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { setSelectedVessel, setMapCenter } = useVesselStore();
  const coverage = useCoverageQuality();

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
        navStatus: vessel.navStatus ?? null,
        lowConfidence: false,
      },
    });
    setMapCenter({ lat: vessel.latitude, lon: vessel.longitude, zoom: 10 });
  };

  useEffect(() => {
    if (!expandedId) return;
    const controller = new AbortController();
    const fetchVessels = async () => {
      try {
        setLoadingId(expandedId);
        const response = await fetch(`/api/chokepoints/${expandedId}/vessels`, { signal: controller.signal });
        if (!response.ok) throw new Error(`chokepoint vessels ${response.status}`);
        const data = await response.json();
        if (!controller.signal.aborted) setVesselMap((previous) => ({ ...previous, [expandedId]: data.vessels ?? [] }));
      } catch (error) {
        if (!controller.signal.aborted) console.error('Failed to fetch chokepoint vessels:', error);
      } finally {
        if (!controller.signal.aborted) setLoadingId(null);
      }
    };
    void fetchVessels();
    const interval = setInterval(() => { if (!document.hidden) void fetchVessels(); }, 60_000);
    return () => { clearInterval(interval); controller.abort(); };
  }, [expandedId]);

  if (!chokepoints) return null;

  return (
    // Mobile stacks these full-width. They used to sit in a horizontal scroll
    // strip, which pushed 404px of chokepoints off the right edge AND — because
    // overflow-x:auto forces overflow-y from visible to auto — clipped the
    // expanded vessel list to the 50px-tall strip, so tapping appeared to do nothing.
    <div className="flex gap-2 phone:flex-col">
      {chokepoints.map((cp) => {
        const quality = coverage?.[cp.id] ?? null;
        // An unobserved region must not read as an empty one: with no
        // observations and nothing seen, the count is "—", not "0".
        const unobserved = quality?.quality === 'insufficient' && cp.totalVessels === 0;
        return (
        <div
          key={cp.id}
          className="relative bg-black border border-amber-500/20 min-w-[150px] max-w-[230px] phone:min-w-0 phone:max-w-none flex-shrink-0"
        >
          <button
            onClick={() => {
              setExpandedId(prev => prev === cp.id ? null : cp.id);
              onSelect?.(cp.bounds, cp.name);
            }}
            aria-expanded={expandedId === cp.id}
            aria-label={unobserved
              ? `${cp.name}: insufficient observations, no contacts seen`
              : `${cp.name}: ${cp.tankerCount} tankers, ${cp.totalVessels} total vessels`}
            className="w-full flex items-center gap-2 px-3 py-1.5 phone:min-h-[44px] tablet:min-h-[44px] hover:bg-gray-900 transition-colors"
          >
            <Anchor className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <div className="text-left flex-1 min-w-0">
              <p className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-gray-300 font-medium whitespace-nowrap">
                  {cp.name.replace('Strait of ', '').replace(' Canal', '')}
                </span>
                {quality && <QualityChip id={cp.id} quality={quality.quality} basis={quality.basis} />}
              </p>
              <p className="text-xs font-mono text-gray-500 whitespace-nowrap" data-testid={`chokepoint-count-${cp.id}`}>
                {unobserved ? '— unobserved' : `${cp.tankerCount} tankers / ${cp.totalVessels} total`}
              </p>
            </div>
            <ChevronDown
              className={`w-3 h-3 text-gray-600 flex-shrink-0 transition-transform ${
                expandedId === cp.id ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedId === cp.id && (
            /* Desktop: popover over the map. Mobile: static, so the list opens
               inline as an accordion inside the card instead of overlaying it. */
            <div className="absolute left-0 top-full z-50 min-w-[200px] bg-black border border-amber-500/20 border-t-0 shadow-lg phone:static phone:min-w-0 phone:border-x-0 phone:border-b-0 phone:border-t">
              {loadingId === cp.id && !vesselMap[cp.id] ? (
                <p className="px-2 py-1 text-xs text-gray-500 font-mono">ACQUIRING VESSELS...</p>
              ) : (vesselMap[cp.id] ?? []).length === 0 ? (
                <p className="px-2 py-1 text-xs text-gray-600 font-mono">NO VESSELS</p>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {(vesselMap[cp.id] ?? []).map((v) => (
                    <button
                      key={v.mmsi}
                      onClick={() => handleVesselClick(v)}
                      className="w-full flex items-center gap-1.5 px-2 py-0.5 phone:min-h-[44px] phone:px-3 tablet:min-h-[44px] hover:bg-gray-900 text-left"
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
        );
      })}
    </div>
  );
}
