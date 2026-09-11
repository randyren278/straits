import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { useVesselStore } from '@/stores/vessel';
import { CurrentWatchPanel } from './CurrentWatchPanel';

const items = [
  { kind: 'event', title: 'ABROS — going dark', detail: 'Sanctioned hull · confirmed · detected 2h ago', evidence: 'risk 72',
    at: '2026-09-11T10:00:00Z', target: { lat: 25.1, lon: 56.2, zoom: 9, imo: '9000001' }, tone: 'alert' },
  { kind: 'traffic', title: 'Strait of Hormuz — traffic down 50%', detail: '40 vessels in the last 24h vs 80 the day before', evidence: '80 → 40',
    at: '2026-09-11T12:00:00Z', target: { lat: 25.25, lon: 56.5, zoom: 8, chokepoint: 'hormuz' }, tone: 'warn' },
  { kind: 'coverage', title: 'AIS feed silent', detail: 'No fixes received for 3h.', evidence: 'last fix 09:00Z',
    at: '2026-09-11T09:00:00Z', target: null, tone: 'alert' },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ generatedAt: '2026-09-11T12:00:00Z', items }) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useVesselStore.setState({ mapCenter: null, targetVesselImo: null });
});

describe('CurrentWatchPanel', () => {
  it('renders the three observations with their evidence', async () => {
    render(<CurrentWatchPanel />);
    await waitFor(() => expect(screen.getByText('ABROS — going dark')).toBeInTheDocument());
    expect(screen.getByText('risk 72')).toBeInTheDocument();
    expect(screen.getByText('80 → 40')).toBeInTheDocument();
    expect(screen.getByText('AIS feed silent')).toBeInTheDocument();
  });

  it('takes an event straight to its map view and dossier', async () => {
    render(<CurrentWatchPanel />);
    const btn = await screen.findByRole('button', { name: /ABROS — going dark/ });
    fireEvent.click(btn);
    expect(useVesselStore.getState().mapCenter).toEqual({ lat: 25.1, lon: 56.2, zoom: 9 });
    expect(useVesselStore.getState().targetVesselImo).toBe('9000001');
  });

  it('flies to a zone for a traffic change without opening a dossier', async () => {
    render(<CurrentWatchPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /traffic down 50%/ }));
    expect(useVesselStore.getState().mapCenter).toEqual({ lat: 25.25, lon: 56.5, zoom: 8 });
    expect(useVesselStore.getState().targetVesselImo).toBeNull();
  });

  it('renders a feed-wide gap as information, not a button', async () => {
    render(<CurrentWatchPanel />);
    await screen.findByText('AIS feed silent');
    expect(screen.queryByRole('button', { name: /AIS feed silent/ })).not.toBeInTheDocument();
  });
});
