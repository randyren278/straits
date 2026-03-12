/**
 * Zustand store for vessel state management.
 * Manages selected vessel, filter state, data freshness, map navigation,
 * watchlist, and alerts.
 * Requirements: MAP-06, MAP-07, HIST-02
 */
import { create } from 'zustand';
import type { VesselWithPosition } from '@/types/vessel';
import type { WatchlistEntry, Alert } from '@/types/anomaly';

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
  /** User's vessel watchlist */
  watchlist: WatchlistEntry[];
  /** User's alerts (recent) */
  alerts: Alert[];
  /** Unread alert count */
  unreadCount: number;
  /** Filter to show only vessels with anomalies */
  anomalyFilter: boolean;
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
  /** Set watchlist entries */
  setWatchlist: (entries: WatchlistEntry[]) => void;
  /** Set alerts and recalculate unread count */
  setAlerts: (alerts: Alert[]) => void;
  /** Update unread count directly */
  setUnreadCount: (count: number) => void;
  /** Toggle anomaly filter */
  setAnomalyFilter: (value: boolean) => void;
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
  tankersOnly: true,
  showTrack: false,
  lastUpdate: null,
  mapCenter: null,

  // Watchlist and alerts state
  watchlist: [],
  alerts: [],
  unreadCount: 0,
  anomalyFilter: false,

  // Existing setters
  setSelectedVessel: (vessel) => set({ selectedVessel: vessel, showTrack: false }),
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
