/**
 * Zustand store for vessel state management.
 * Manages selected vessel, filter state, data freshness, and map navigation.
 * Requirements: MAP-06, MAP-07
 */
import { create } from 'zustand';
import type { VesselWithPosition } from '@/types/vessel';

/** Map center and zoom for flyTo navigation */
export interface MapCenter {
  lat: number;
  lon: number;
  zoom: number;
}

interface VesselStore {
  /** Currently selected vessel for detail panel */
  selectedVessel: VesselWithPosition | null;
  /** Filter to show only tankers (ship types 80-89) */
  tankersOnly: boolean;
  /** Whether to show track history for selected vessel */
  showTrack: boolean;
  /** Timestamp of last data refresh */
  lastUpdate: Date | null;
  /** Target map center for flyTo navigation (null = no navigation pending) */
  mapCenter: MapCenter | null;
  /** Set the selected vessel (clears track state) */
  setSelectedVessel: (vessel: VesselWithPosition | null) => void;
  /** Toggle tanker-only filter */
  setTankersOnly: (value: boolean) => void;
  /** Toggle track history display */
  setShowTrack: (value: boolean) => void;
  /** Update last refresh timestamp */
  setLastUpdate: (date: Date) => void;
  /** Set map center for flyTo navigation */
  setMapCenter: (center: MapCenter | null) => void;
}

export const useVesselStore = create<VesselStore>((set) => ({
  selectedVessel: null,
  tankersOnly: true,
  showTrack: false,
  lastUpdate: null,
  mapCenter: null,
  setSelectedVessel: (vessel) => set({ selectedVessel: vessel, showTrack: false }),
  setTankersOnly: (tankersOnly) => set({ tankersOnly }),
  setShowTrack: (showTrack) => set({ showTrack }),
  setLastUpdate: (lastUpdate) => set({ lastUpdate }),
  setMapCenter: (mapCenter) => set({ mapCenter }),
}));
