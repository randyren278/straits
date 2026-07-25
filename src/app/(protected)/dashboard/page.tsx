'use client';

/**
 * Dashboard page with interactive vessel map.
 * Requirements: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, MAP-07, MAP-08, INTL-02, INTL-03, ANOM-01, HIST-02
 */
import { useCallback } from 'react';
import { VesselMap } from '@/components/map/VesselMap';
import { VesselPanel } from '@/components/panels/VesselPanel';
import { ClusterPanel } from '@/components/panels/ClusterPanel';
import { OilPricePanel } from '@/components/panels/OilPricePanel';
import { NewsPanel } from '@/components/panels/NewsPanel';
import { WatchlistPanel } from '@/components/panels/WatchlistPanel';
import { Header } from '@/components/ui/Header';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useVesselStore } from '@/stores/vessel';

export default function DashboardPage() {
  const setMapCenter = useVesselStore((state) => state.setMapCenter);
  const setTargetVesselImo = useVesselStore((state) => state.setTargetVesselImo);
  const selectedVessel = useVesselStore((state) => state.selectedVessel);

  // Handle vessel selection from search - fly to vessel position
  const handleSearchSelect = useCallback((result: {
    imo: string;
    mmsi: string;
    name: string;
    flag: string;
    latitude: number | null;
    longitude: number | null;
  }) => {
    if (result.latitude !== null && result.longitude !== null) {
      setMapCenter({
        lat: result.latitude,
        lon: result.longitude,
        zoom: 10,
      });
      setTargetVesselImo(result.imo);
    }
  }, [setMapCenter, setTargetVesselImo]);

  // Handle chokepoint selection - fly to chokepoint bounds
  const handleChokepointSelect = useCallback((bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  }, _name: string) => {
    // Calculate center of bounding box
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const centerLon = (bounds.minLon + bounds.maxLon) / 2;
    setMapCenter({
      lat: centerLat,
      lon: centerLon,
      zoom: 8,
    });
  }, [setMapCenter]);

  return (
    <div className="h-dvh flex flex-col bg-black">
      <Header
        onSearchSelect={handleSearchSelect}
        onChokepointSelect={handleChokepointSelect}
      />
      <main className="flex-1 grid grid-cols-[1fr_320px] overflow-hidden max-lg:flex max-lg:flex-col max-lg:overflow-y-auto">
        {/* Left column: full-height map (min-height on mobile prevents collapse) */}
        <ErrorBoundary>
          <div className="relative overflow-hidden max-lg:min-h-[70dvh]">
            <VesselMap />
            {/* Mobile: selected vessel surfaces as a bottom sheet over the map
                (the stacked column below the fold is invisible when tapping a ship) */}
            {selectedVessel && (
              <div className="hidden max-lg:block absolute inset-x-0 bottom-0 z-20 max-h-[70%] overflow-y-auto bg-black border-t border-amber-500/40 shadow-[0_-8px_24px_rgba(0,0,0,0.8)]">
                <VesselPanel />
              </div>
            )}
          </div>
        </ErrorBoundary>
        {/* Right column: stacked panels */}
        <ErrorBoundary>
          <div className="flex flex-col overflow-y-auto bg-black border-l border-amber-500/20 divide-y divide-amber-500/10 max-lg:border-l-0 max-lg:border-t max-lg:border-amber-500/20">
            <ClusterPanel />
            {/* Desktop only — on mobile the vessel detail renders in the map bottom sheet above.
                Gated on selectedVessel so the empty wrapper doesn't add a stray divide-y line. */}
            {selectedVessel && (
              <div className="max-lg:hidden">
                <VesselPanel />
              </div>
            )}
            <WatchlistPanel />
            <OilPricePanel />
            <NewsPanel />
          </div>
        </ErrorBoundary>
      </main>
    </div>
  );
}
