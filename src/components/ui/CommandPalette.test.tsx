import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useVesselStore } from '@/stores/vessel';
import { CommandPalette } from './CommandPalette';

const nav = vi.hoisted(() => ({ pathname: '/dashboard', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
}));

beforeEach(() => {
  nav.pathname = '/dashboard';
  nav.push.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ results: [{ imo: '9000001', mmsi: '123456781', name: 'ABROS', flag: 'PA', latitude: 25.1, longitude: 56.2 }] }),
  })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useVesselStore.setState({ mapCenter: null, targetVesselImo: null, tankersOnly: false, anomalyFilter: false });
});

describe('CommandPalette', () => {
  it('opens on ⌘K and lists chokepoints and pages before any query', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const dialog = screen.getByTestId('command-palette');
    expect(dialog).toHaveTextContent('Strait of Hormuz');
    expect(dialog).toHaveTextContent('Field manual');
  });

  it('flies to a chokepoint in place on the dashboard', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    fireEvent.click(screen.getByRole('option', { name: /Strait of Hormuz/ }));
    expect(useVesselStore.getState().mapCenter).toEqual({ lat: 25.25, lon: 56.5, zoom: 8 });
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
  });

  it('routes to the dashboard with an investigation link from another page', () => {
    nav.pathname = '/fleet';
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    fireEvent.click(screen.getByRole('option', { name: /Suez Canal/ }));
    expect(nav.push).toHaveBeenCalledWith('/dashboard?cp=suez');
  });

  it('searches vessels and selects the result with Enter', async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    fireEvent.change(screen.getByLabelText('Command'), { target: { value: 'abr' } });
    await waitFor(() => expect(screen.getByRole('option', { name: /ABROS/ })).toBeInTheDocument());
    fireEvent.keyDown(screen.getByLabelText('Command'), { key: 'Enter' });
    expect(useVesselStore.getState().targetVesselImo).toBe('9000001');
    expect(useVesselStore.getState().mapCenter).toEqual({ lat: 25.1, lon: 56.2, zoom: 10 });
  });
});
