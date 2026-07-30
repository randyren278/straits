'use client';

/**
 * Dashboard page with interactive vessel map.
 * Requirements: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, MAP-07, MAP-08, INTL-02, INTL-03, ANOM-01, HIST-02
 */
import { useCallback, useEffect, useState } from 'react';
import { VesselMap } from '@/components/map/VesselMap';
import { VesselPanel } from '@/components/panels/VesselPanel';
import { OilPricePanel } from '@/components/panels/OilPricePanel';
import { NewsPanel } from '@/components/panels/NewsPanel';
import { RailPanels } from '@/components/panels/RailPanels';
import { Header } from '@/components/ui/Header';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useVesselStore } from '@/stores/vessel';
import { MobileSheet, type Chokepoint } from '@/components/dashboard/MobileSheet';
import { IntelDrawer } from '@/components/dashboard/IntelDrawer';
import { MapFilterChips } from '@/components/map/MapFilterChips';

export default function DashboardPage() {
  const setMapCenter = useVesselStore((state) => state.setMapCenter);
  const setTargetVesselImo = useVesselStore((state) => state.setTargetVesselImo);
  const selectedVessel = useVesselStore((state) => state.selectedVessel);

  const [chokepoints, setChokepoints] = useState<Chokepoint[]>([]);

  // One fetch for both the desktop widgets and the mobile sheet strip.
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/chokepoints');
        if (!res.ok) return;
        const data = await res.json();
        // Verified against src/app/api/chokepoints/route.ts and the
        // ChokepointData interface in ChokepointWidget.tsx: the response is
        // { chokepoints: [{ id, name, totalVessels, tankerCount }] }.
        setChokepoints(
          (data.chokepoints ?? []).map((c: { name: string; tankerCount: number; totalVessels: number }) => ({
            name: c.name,
            tankers: c.tankerCount,
            total: c.totalVessels,
          })),
        );
      } catch {
        // Leave the strip empty rather than failing the page.
      }
    }
    load();
    const interval = setInterval(load, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
      <main className="flex-1 grid grid-cols-[1fr_320px] max-desk:grid-cols-1 overflow-hidden phone:flex phone:flex-col">
        <ErrorBoundary>
          {/* Phone: the map fills everything between the header and the sheet.
              Tablet: the map is full-bleed and IntelDrawer overlays it, which is
              why the drawer lives inside this relative box rather than beside it. */}
          <div className="relative overflow-hidden phone:flex-1 phone:min-h-0">
            <VesselMap />
            <MapFilterChips />
            <IntelDrawer>
              <RailPanels />
            </IntelDrawer>
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div
            data-testid="panel-rail"
            className="max-desk:hidden flex flex-col overflow-y-auto bg-black border-l border-amber-500/20 divide-y divide-amber-500/10"
          >
            <RailPanels />
          </div>
        </ErrorBoundary>
      </main>

      <MobileSheet
        chokepoints={chokepoints}
        collapsed={!!selectedVessel}
        panels={{ prices: <OilPricePanel />, intel: <NewsPanel /> }}
      />

      {/* Sits above the bottom nav. At bottom-0 the nav would cover its
          controls, and the two would fight for the same edge. */}
      {selectedVessel && (
        <div
          data-testid="vessel-sheet"
          className="hidden phone:block fixed inset-x-0 bottom-[var(--straits-nav-h)] z-40 max-h-[60dvh] overflow-y-auto bg-black border-t border-amber-500/40 shadow-[0_-8px_24px_rgba(0,0,0,0.8)]"
        >
          <VesselPanel />
        </div>
      )}
    </div>
  );
}
