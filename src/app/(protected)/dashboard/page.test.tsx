import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './page';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('@/lib/geo/chokepoints', () => ({ getChokepointStats: vi.fn().mockResolvedValue([]) }));
vi.mock('@/components/map/VesselMap', () => ({ VesselMap: () => <div data-testid="map" /> }));
vi.mock('@/components/panels/ClusterPanel', () => ({ ClusterPanel: () => null }));
vi.mock('@/components/panels/VesselPanel', () => ({ VesselPanel: () => <div data-testid="vessel-panel" /> }));
vi.mock('@/components/panels/WatchlistPanel', () => ({ WatchlistPanel: () => null }));
vi.mock('@/components/panels/OilPricePanel', () => ({ OilPricePanel: () => <div data-testid="prices" /> }));
vi.mock('@/components/panels/NewsPanel', () => ({ NewsPanel: () => <div data-testid="intel" /> }));
vi.mock('@/components/ui/Header', () => ({ Header: () => <header /> }));

const store = vi.hoisted(() => ({
  selectedVessel: null as unknown,
  targetVesselImo: null as string | null,
  mapCenter: null as { lat: number; lon: number; zoom: number } | null,
  viewport: null as { lat: number; lon: number; zoom: number } | null,
}));
vi.mock('@/stores/vessel', () => {
  const state = () => ({
    selectedVessel: store.selectedVessel,
    targetVesselImo: store.targetVesselImo,
    mapCenter: store.mapCenter,
    viewport: store.viewport,
    tankersOnly: false,
    anomalyFilter: false,
    setMapCenter: vi.fn((value) => { store.mapCenter = value; }),
    setSelectedVessel: vi.fn(),
    setTargetVesselImo: vi.fn((value) => { store.targetVesselImo = value; }),
    setTankersOnly: vi.fn(),
    setAnomalyFilter: vi.fn(),
  });
  // DashboardClient reads via selectors and via getState (link hydration).
  const useVesselStore = Object.assign(
    (selector?: (s: ReturnType<typeof state>) => unknown) => (selector ? selector(state()) : state()),
    { getState: state },
  );
  return { useVesselStore };
});
vi.mock('@/components/panels/CurrentWatchPanel', () => ({
  CurrentWatchPanel: () => null,
  useCurrentWatch: () => null,
  openWatchItem: vi.fn(),
}));

async function renderDashboard() {
  const ui = await DashboardPage();
  return render(ui);
}

afterEach(() => {
  cleanup();
  store.selectedVessel = null;
  store.targetVesselImo = null;
  store.mapCenter = null;
  store.viewport = null;
  window.history.replaceState({}, '', '/');
});

describe('DashboardPage', () => {
  it('renders the mobile sheet', async () => {
    await renderDashboard();
    expect(screen.getByTestId('mobile-sheet')).toBeInTheDocument();
  });

  it('renders the map filter chips over the map', async () => {
    await renderDashboard();
    expect(screen.getByRole('button', { name: /all vessels|tankers only/i })).toBeInTheDocument();
  });

  it('hides the stacked panel column below lg', async () => {
    await renderDashboard();
    expect(screen.getByTestId('panel-rail')).toHaveClass('hidden');
    expect(screen.getByTestId('panel-rail')).toHaveClass('desk:flex');
  });

  it('anchors the vessel sheet above the bottom nav, not over it', async () => {
    store.selectedVessel = { imo: '9999999', name: 'TEST' };
    await renderDashboard();
    const sheet = screen.getByTestId('vessel-sheet');
    expect(sheet.className).toMatch(/bottom-\[var\(--straits-nav-h\)\]/);
    expect(sheet).not.toHaveClass('bottom-0');
  });

  it('collapses the panel sheet when a vessel is selected', async () => {
    store.selectedVessel = { imo: '9999999', name: 'TEST' };
    await renderDashboard();
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'peek');
  });

  it('does not strip a shared investigation link during hydration', async () => {
    window.history.replaceState({}, '', '/dashboard?cp=suez&vessel=9000001&tankers=1');
    await renderDashboard();

    await waitFor(() => {
      expect(store.mapCenter).toEqual({ lat: 31, lon: 32.25, zoom: 8 });
      expect(store.targetVesselImo).toBe('9000001');
    });
    expect(window.location.search).toBe('?cp=suez&vessel=9000001&tankers=1');
  });
});
