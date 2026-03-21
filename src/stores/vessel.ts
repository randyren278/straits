/**
 * Zustand store for vessel state management.
 * Manages selected vessel, filter state, data freshness, map navigation,
 * watchlist, alerts, and cluster expansion.
 * Requirements: MAP-06, MAP-07, HIST-02
 */
import { create } from 'zustand';
import type { VesselWithPosition } from '@/types/vessel';
import type { VesselWithSanctions } from '@/lib/db/sanctions';
import type { WatchlistEntry, Alert } from '@/types/anomaly';

/** Union of vessel types that can be selected on the map */
type SelectableVessel = VesselWithPosition | VesselWithSanctions;

/** Map center and zoom for flyTo navigation */
export interface MapCenter {
  lat: number;
  lon: number;
  zoom: number;
}

/** Vessel data extracted from a cluster leaf for display in the cluster panel */
export interface ClusterVessel {
  imo: string | null;
  mmsi: string;
  name: string | null;
  flag: string | null;
  shipType: number | null;
  speed: number | null;
  course: number | null;
  heading: number | null;
  latitude: number;
  longitude: number;
  isSanctioned: boolean;
  anomalyType: string | null;
  anomalyConfidence: string | null;
  sanctionRiskCategory: string | null;
  destination: string | null;
  lowConfidence: boolean;
}

interface VesselStore {
  /** Currently selected vessel for detail panel */
  selectedVessel: SelectableVessel | null;
  /** Filter to show only tankers (ship types 80-89) */
  tankersOnly: boolean;
  /** Whether to show track history for selected vessel */
  showTrack: boolean;
  /** Timestamp of last data refresh */
  lastUpdate: Date | null;
  /** Target map center for flyTo navigation (null = no navigation pending) */
  mapCenter: MapCenter | null;
  /** User's vessel watchlist */
  watchlist: WatchlistEntry[];
  /** User's alerts (recent) */
  alerts: Alert[];
  /** Unread alert count */
  unreadCount: number;
  /** Filter to show only vessels with anomalies */
  anomalyFilter: boolean;
  /** Target vessel IMO for cross-route map jumps (null = no pending target) */
  targetVesselImo: string | null;
  /** Expanded cluster vessels for the cluster panel (null = no cluster open) */
  clusterVessels: ClusterVessel[] | null;
  /** Set the selected vessel (clears track state and cluster panel) */
  setSelectedVessel: (vessel: SelectableVessel | null) => void;
  /** Toggle tanker-only filter */
  setTankersOnly: (value: boolean) => void;
  /** Toggle track history display */
  setShowTrack: (value: boolean) => void;
  /** Update last refresh timestamp */
  setLastUpdate: (date: Date) => void;
  /** Set map center for flyTo navigation */
  setMapCenter: (center: MapCenter | null) => void;
  /** Set watchlist entries */
  setWatchlist: (entries: WatchlistEntry[]) => void;
  /** Set alerts and recalculate unread count */
  setAlerts: (alerts: Alert[]) => void;
  /** Update unread count directly */
  setUnreadCount: (count: number) => void;
  /** Toggle anomaly filter */
  setAnomalyFilter: (value: boolean) => void;
  /** Set target vessel IMO for cross-route navigation (e.g. fleet → dashboard) */
  setTargetVesselImo: (imo: string | null) => void;
  /** Set expanded cluster vessels for cluster panel */
  setClusterVessels: (vessels: ClusterVessel[] | null) => void;
  /** Add vessel to watchlist (optimistic update) */
  addToWatchlist: (entry: WatchlistEntry) => void;
  /** Remove vessel from watchlist (optimistic update) */
  removeFromWatchlist: (imo: string) => void;
  /** Mark alert as read (optimistic update) */
  markAlertRead: (alertId: number) => void;
}

export const useVesselStore = create<VesselStore>((set) => ({
  // Existing state
  selectedVessel: null,
  tankersOnly: false,
  showTrack: false,
  lastUpdate: null,
  mapCenter: null,

  // Watchlist and alerts state
  watchlist: [],
  alerts: [],
  unreadCount: 0,
  anomalyFilter: false,
  targetVesselImo: null,
  clusterVessels: null,

  // Existing setters
  setSelectedVessel: (vessel) => set({ selectedVessel: vessel, showTrack: false, clusterVessels: null }),
  setTankersOnly: (tankersOnly) => set({ tankersOnly }),
  setShowTrack: (showTrack) => set({ showTrack }),
  setLastUpdate: (lastUpdate) => set({ lastUpdate }),
  setMapCenter: (mapCenter) => set({ mapCenter }),

  // Watchlist and alerts setters
  setWatchlist: (watchlist) => set({ watchlist }),
  setAlerts: (alerts) => set({
    alerts,
    unreadCount: alerts.filter(a => !a.readAt).length,
  }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setAnomalyFilter: (anomalyFilter) => set({ anomalyFilter }),
  setClusterVessels: (clusterVessels) => set({ clusterVessels }),
  setTargetVesselImo: (targetVesselImo) => {
    if (targetVesselImo) {
      console.log(`[VesselStore] targetVesselImo set: ${targetVesselImo}`);
    } else {
      console.log('[VesselStore] targetVesselImo cleared');
    }
    set({ targetVesselImo });
  },

  // Optimistic updates for responsive UI
  addToWatchlist: (entry) => set((state) => ({
    watchlist: [entry, ...state.watchlist],
  })),
  removeFromWatchlist: (imo) => set((state) => ({
    watchlist: state.watchlist.filter(e => e.imo !== imo),
  })),
  markAlertRead: (alertId) => set((state) => ({
    alerts: state.alerts.map(a =>
      a.id === alertId ? { ...a, readAt: new Date() } : a
    ),
    unreadCount: Math.max(0, state.unreadCount - 1),
  })),
}));
