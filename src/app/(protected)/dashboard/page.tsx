'use client';

/**
 * Dashboard page with interactive vessel map.
 * Requirements: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, MAP-07, MAP-08, INTL-02, INTL-03
 */
import { useCallback } from 'react';
import { VesselMap } from '@/components/map/VesselMap';
import { VesselPanel } from '@/components/panels/VesselPanel';
import { OilPricePanel } from '@/components/panels/OilPricePanel';
import { NewsPanel } from '@/components/panels/NewsPanel';
import { Header } from '@/components/ui/Header';
import { useVesselStore } from '@/stores/vessel';

export default function DashboardPage() {
  const setMapCenter = useVesselStore((state) => state.setMapCenter);

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
    }
  }, [setMapCenter]);

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
    <div className="h-screen flex flex-col bg-[#1a1a2e]">
      <Header
        onSearchSelect={handleSearchSelect}
        onChokepointSelect={handleChokepointSelect}
      />
      <main className="flex-1 relative">
        <VesselMap />
        <VesselPanel />
        <OilPricePanel />
        <NewsPanel />
      </main>
    </div>
  );
}
