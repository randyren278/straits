import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DashboardPage from './page';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
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

afterEach(() => { cleanup(); store.selectedVessel = null; });

describe('DashboardPage', () => {
  it('renders the mobile sheet', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('mobile-sheet')).toBeInTheDocument();
  });

  it('renders the map filter chips over the map', () => {
    render(<DashboardPage />);
    expect(screen.getByRole('button', { name: /all vessels|tankers only/i })).toBeInTheDocument();
  });

  it('hides the stacked panel column below lg', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('panel-rail')).toHaveClass('max-lg:hidden');
  });

  it('anchors the vessel sheet above the bottom nav, not over it', () => {
    store.selectedVessel = { imo: '9999999', name: 'TEST' };
    render(<DashboardPage />);
    const sheet = screen.getByTestId('vessel-sheet');
    expect(sheet.className).toMatch(/bottom-\[var\(--straits-nav-h\)\]/);
    expect(sheet).not.toHaveClass('bottom-0');
  });

  it('collapses the panel sheet when a vessel is selected', () => {
    store.selectedVessel = { imo: '9999999', name: 'TEST' };
    render(<DashboardPage />);
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'peek');
  });
});
