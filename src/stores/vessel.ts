/**
 * Zustand store for vessel state management.
 * Manages selected vessel, filter state, and data freshness.
 */
import { create } from 'zustand';
import type { VesselWithPosition } from '@/types/vessel';

interface VesselStore {
  /** Currently selected vessel for detail panel */
  selectedVessel: VesselWithPosition | null;
  /** Filter to show only tankers (ship types 80-89) */
  tankersOnly: boolean;
  /** Whether to show track history for selected vessel */
  showTrack: boolean;
  /** Timestamp of last data refresh */
  lastUpdate: Date | null;
  /** Set the selected vessel (clears track state) */
  setSelectedVessel: (vessel: VesselWithPosition | null) => void;
  /** Toggle tanker-only filter */
  setTankersOnly: (value: boolean) => void;
  /** Toggle track history display */
  setShowTrack: (value: boolean) => void;
  /** Update last refresh timestamp */
  setLastUpdate: (date: Date) => void;
}

export const useVesselStore = create<VesselStore>((set) => ({
  selectedVessel: null,
  tankersOnly: true,
  showTrack: false,
  lastUpdate: null,
  setSelectedVessel: (vessel) => set({ selectedVessel: vessel, showTrack: false }),
  setTankersOnly: (tankersOnly) => set({ tankersOnly }),
  setShowTrack: (showTrack) => set({ showTrack }),
  setLastUpdate: (lastUpdate) => set({ lastUpdate }),
}));
