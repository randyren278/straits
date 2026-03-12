/**
 * Zustand store for analytics state management.
 * Manages time range, chokepoint selection, and route selection for analytics view.
 * Requirement: HIST-01
 */
import { create } from 'zustand';
import type { TimeRange, RouteRegion } from '@/types/analytics';

interface AnalyticsStore {
  /** Selected time range for queries */
  timeRange: TimeRange;
  /** Selected chokepoints to display (empty = show all) */
  selectedChokepoints: string[];
  /** Selected routes to display (empty = show all) */
  selectedRoutes: RouteRegion[];
  /** View mode: 'chokepoint' or 'route' grouping */
  viewMode: 'chokepoint' | 'route';
  /** Loading state for data fetches */
  isLoading: boolean;

  /** Set time range and trigger re-fetch */
  setTimeRange: (range: TimeRange) => void;
  /** Set selected chokepoints */
  setSelectedChokepoints: (ids: string[]) => void;
  /** Set selected routes */
  setSelectedRoutes: (routes: RouteRegion[]) => void;
  /** Toggle between chokepoint and route view */
  setViewMode: (mode: 'chokepoint' | 'route') => void;
  /** Set loading state */
  setIsLoading: (loading: boolean) => void;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  // Default state
  timeRange: '30d',
  selectedChokepoints: ['hormuz', 'babel_mandeb', 'suez'], // All by default
  selectedRoutes: ['east_asia', 'europe', 'americas'], // Exclude 'unknown' by default
  viewMode: 'chokepoint',
  isLoading: false,

  // Setters
  setTimeRange: (timeRange) => set({ timeRange }),
  setSelectedChokepoints: (selectedChokepoints) => set({ selectedChokepoints }),
  setSelectedRoutes: (selectedRoutes) => set({ selectedRoutes }),
  setViewMode: (viewMode) => set({ viewMode }),
  setIsLoading: (isLoading) => set({ isLoading }),
}));
