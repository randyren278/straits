import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

const store = vi.hoisted(() => ({ selectedVessel: null as unknown }));
vi.mock('@/stores/vessel', () => ({
  useVesselStore: () => ({
    selectedVessel: store.selectedVessel,
    setMapCenter: vi.fn(),
    setSelectedVessel: vi.fn(),
  }),
}));

async function renderDashboard() {
  const ui = await DashboardPage();
  return render(ui);
}

afterEach(() => {
  cleanup();
  store.selectedVessel = null;
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
});
