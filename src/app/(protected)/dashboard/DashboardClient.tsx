'use client';

/**
 * Dashboard page with interactive vessel map.
 * Requirements: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, MAP-07, MAP-08, INTL-02, INTL-03, ANOM-01, HIST-02
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { VesselMap } from '@/components/map/VesselMap';
import { VesselPanel } from '@/components/panels/VesselPanel';
import { OilPricePanel } from '@/components/panels/OilPricePanel';
import { NewsPanel } from '@/components/panels/NewsPanel';
import { RailPanels } from '@/components/panels/RailPanels';
import { Header } from '@/components/ui/Header';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useVesselStore, type MapCenter } from '@/stores/vessel';
import { MobileSheet, type Chokepoint } from '@/components/dashboard/MobileSheet';
import { IntelDrawer } from '@/components/dashboard/IntelDrawer';
import { MapFilterChips } from '@/components/map/MapFilterChips';
import { MapLegend } from '@/components/map/MapLegend';
import { useCurrentWatch, openWatchItem } from '@/components/panels/CurrentWatchPanel';
import { parseInvestigation, serializeInvestigation } from '@/lib/dashboard/investigation-link';
import { CHOKEPOINTS } from '@/lib/geo/chokepoints-constants';
import { useCoverageQuality } from '@/lib/hooks/useCoverageQuality';

interface SearchResult {
  imo: string | null;
  mmsi: string;
  name: string | null;
  flag: string | null;
  shipType: number | null;
  latitude: number | null;
  longitude: number | null;
}

export function DashboardClient({ initialCenter }: { initialCenter?: MapCenter }) {
  const setMapCenter = useVesselStore((state) => state.setMapCenter);
  const setTargetVesselImo = useVesselStore((state) => state.setTargetVesselImo);
  const setSelectedVessel = useVesselStore((state) => state.setSelectedVessel);
  const selectedVessel = useVesselStore((state) => state.selectedVessel);
  const tankersOnly = useVesselStore((state) => state.tankersOnly);
  const anomalyFilter = useVesselStore((state) => state.anomalyFilter);
  const targetVesselImo = useVesselStore((state) => state.targetVesselImo);
  const mapCenter = useVesselStore((state) => state.mapCenter);
  const viewport = useVesselStore((state) => state.viewport);
  const skippedInitialLinkWrite = useRef(false);

  // Shareable investigation links — read once on mount, write on change.
  // replaceState keeps the address bar honest without a Next navigation.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const link = parseInvestigation(window.location.search);
    const store = useVesselStore.getState();
    if (link.tankersOnly) store.setTankersOnly(true);
    if (link.anomaliesOnly) store.setAnomalyFilter(true);
    if (link.view) store.setMapCenter(link.view);
    else if (link.chokepoint) {
      const b = CHOKEPOINTS[link.chokepoint].bounds;
      store.setMapCenter({ lat: (b.minLat + b.maxLat) / 2, lon: (b.minLon + b.maxLon) / 2, zoom: 8 });
    }
    if (link.vessel) store.setTargetVesselImo(link.vessel);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // The hydration effect above updates Zustand synchronously, but this
    // effect still belongs to the pre-hydration render. Let the resulting
    // store update render once before writing, otherwise a deep link such as
    // ?cp=suez or ?lat=... is stripped before the map can consume it.
    if (!skippedInitialLinkWrite.current) {
      skippedInitialLinkWrite.current = true;
      return;
    }
    const qs = serializeInvestigation({
      vessel: selectedVessel?.imo ?? targetVesselImo,
      // mapCenter is the requested destination while a fly-to is pending;
      // viewport becomes authoritative after MapLibre reports moveend.
      view: mapCenter ?? viewport,
      tankersOnly,
      anomaliesOnly: anomalyFilter,
    });
    const next = `${window.location.pathname}${qs}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, [selectedVessel?.imo, targetVesselImo, mapCenter, viewport, tankersOnly, anomalyFilter]);

  const [chokepoints, setChokepoints] = useState<Chokepoint[]>([]);
  const coverageQuality = useCoverageQuality();
  // Shares the rail panel's poller (usePolledJson is keyed by URL).
  const watchItems = useCurrentWatch();

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
          (data.chokepoints ?? []).map((c: { id: string; name: string; tankerCount: number; totalVessels: number }) => ({
            id: c.id,
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

  // Handle vessel selection from search.
  //
  // The map-fly path is only available for vessels the AIS feed has actually
  // placed. Before this, the null branch simply fell through and the click did
  // nothing at all — the dropdown closed and the user got no signal. Vessels
  // without a fix now open their dossier instead.
  //
  // `position: null` is already part of VesselWithPosition, and VesselPanel
  // reads every position field through optional chaining with an 'N/A'
  // fallback, so this needs no cast and no panel change.
  const handleSearchSelect = useCallback((result: SearchResult) => {
    if (result.latitude !== null && result.longitude !== null) {
      setMapCenter({ lat: result.latitude, lon: result.longitude, zoom: 10 });
      // The Middle East fallback does not invent an IMO. Select it by the metadata it
      // actually has instead of targeting the first unrelated null-IMO vessel.
      if (result.imo) {
        setTargetVesselImo(result.imo);
      } else {
        setSelectedVessel({
          imo: null,
          mmsi: result.mmsi,
          name: result.name,
          flag: result.flag ?? '',
          shipType: result.shipType,
          destination: null,
          lastSeen: new Date(),
          isSanctioned: false,
          sanctioningAuthority: null,
          sanctionReason: null,
          sanctionRiskCategory: null,
          position: {
            time: new Date(), mmsi: result.mmsi, imo: null,
            latitude: result.latitude, longitude: result.longitude,
            speed: null, course: null, heading: null, navStatus: null, lowConfidence: false,
          },
        });
      }
      return;
    }

    setSelectedVessel({
      imo: result.imo,
      mmsi: result.mmsi,
      name: result.name ?? `MMSI ${result.mmsi}`,
      flag: result.flag ?? '',
      shipType: result.shipType,
      destination: null,
      lastSeen: new Date(),
      isSanctioned: false,
      sanctioningAuthority: null,
      sanctionReason: null,
      sanctionRiskCategory: null,
      position: null,
    });
  }, [setMapCenter, setTargetVesselImo, setSelectedVessel]);

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
      <main className="flex-1 flex flex-col desk:grid desk:grid-cols-[1fr_320px] overflow-hidden">
        <ErrorBoundary>
          {/* Phone: the map fills everything between the header and the sheet.
              Tablet: the map is full-bleed and IntelDrawer overlays it, which is
              why the drawer lives inside this relative box rather than beside it. */}
          <div className="relative overflow-hidden flex-1 min-h-0">
            <VesselMap initialCenter={initialCenter} />
            <MapFilterChips />
            <MapLegend />
            <IntelDrawer>
              <RailPanels />
            </IntelDrawer>
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div
            data-testid="panel-rail"
            className="hidden desk:flex flex-col overflow-y-auto bg-black border-l border-amber-500/20 divide-y divide-amber-500/10"
          >
            <RailPanels />
          </div>
        </ErrorBoundary>
      </main>

      <MobileSheet
        chokepoints={chokepoints.map((c) => ({ ...c, quality: c.id ? coverageQuality?.[c.id] ?? null : null }))}
        collapsed={!!selectedVessel}
        panels={{ prices: <OilPricePanel />, intel: <NewsPanel /> }}
        watch={watchItems?.[0] ?? null}
        onOpenWatch={openWatchItem}
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
