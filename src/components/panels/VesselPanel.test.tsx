import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { useVesselStore } from '@/stores/vessel';
import { VesselPanel } from './VesselPanel';

vi.mock('@/lib/hooks/useSharedUserId', () => ({ useSharedUserId: () => ['user-1', vi.fn()] }));

function selectVessel(overrides: Record<string, unknown> = {}) {
  useVesselStore.getState().setSelectedVessel({
    imo: '9000001',
    mmsi: '123456781',
    name: 'ABROS',
    flag: 'PA',
    shipType: 80,
    destination: 'FUJAIRAH',
    lastSeen: new Date(Date.now() - 6 * 24 * 3_600_000),
    isSanctioned: true,
    sanctioningAuthority: 'OFAC',
    sanctionReason: null,
    sanctionRiskCategory: 'mare.shadow;poi',
    anomalyType: 'going_dark',
    anomalyConfidence: 'confirmed',
    position: {
      time: new Date(Date.now() - 6 * 24 * 3_600_000),
      mmsi: '123456781', imo: '9000001',
      latitude: 25.1234, longitude: 55.5678,
      speed: 0.2, course: 90, heading: 90, navStatus: 1, lowConfidence: false,
    },
    ...overrides,
  } as never);
}

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).endsWith('/risk')) {
      return okJson({ score: 72, factors: { goingDark: 30, sanctions: 25, flagRisk: 5, loitering: 0, sts: 0, rendezvous: 0 }, computedAt: new Date().toISOString(),
        sanction: { authority: 'OFAC', riskCategory: 'mare.shadow;poi', datasets: ['us_ofac_sdn'], flag: 'IR', aliases: ['OLD NAME'], opensanctionsUrl: null, vesselType: 'VESSEL', name: null, listDate: '2026-01-05T00:00:00Z' } });
    }
    if (String(url).endsWith('/history')) {
      return okJson({ anomalies: [
        { id: 1, anomalyType: 'going_dark', confidence: 'confirmed', detectedAt: '2026-09-09T02:00:00Z', resolvedAt: null, details: { gapMinutes: 200, lastPosition: { lat: 24.5, lon: 56.5 } } },
      ], destinationChanges: [] });
    }
    if (String(url).endsWith('/associates')) {
      return okJson({ associates: [
        { partnerImo: '9000002', partnerName: 'PARTNER ONE', encounterCount: '3', lastSeenAt: '2026-09-01T00:00:00Z', minDistanceKm: 0.4, partnerSanctioned: true },
      ] });
    }
    return okJson({});
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useVesselStore.setState({
    selectedVessel: null,
    showTrack: false,
    trackStatus: { state: 'idle' },
    mapCenter: null,
    viewport: null,
    targetVesselImo: null,
    tankersOnly: false,
    anomalyFilter: false,
  });
});

describe('VesselPanel — contact header', () => {
  it('shows the observation age of the fix, not the time of selection', () => {
    selectVessel();
    render(<VesselPanel />);
    expect(screen.getByTestId('observation-age')).toHaveTextContent(/6d ago/);
    expect(screen.getByText(/last received fix, not a live location/i)).toBeInTheDocument();
  });

  it('explains why the contact matters, leading with identity', async () => {
    selectVessel();
    render(<VesselPanel />);
    await waitFor(() => expect(screen.getByTestId('why-it-matters')).toBeInTheDocument());
    expect(screen.getByTestId('why-it-matters')).toHaveTextContent(/^Shadow fleet hull · going dark · confirmed/);
    expect(screen.getByTestId('why-it-matters')).toHaveTextContent(/met 1 sanctioned vessel at sea/);
  });

  it('translates the raw risk category code into a readable label', async () => {
    selectVessel();
    render(<VesselPanel />);
    await waitFor(() => expect(screen.getByText('OFAC SDN')).toBeInTheDocument());
    expect(screen.queryByText('mare.shadow;poi')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Shadow fleet/i).length).toBeGreaterThan(0);
  });
});

describe('VesselPanel — evidence trail', () => {
  it('lists observed, detector and reference events in one chronological trail', async () => {
    selectVessel();
    render(<VesselPanel />);
    const trail = await screen.findByTestId('evidence-trail');
    await waitFor(() => expect(trail).toHaveTextContent('Shadow fleet listing'));
    expect(trail).toHaveTextContent('Latest AIS fix');
    expect(trail).toHaveTextContent('Going Dark');
    expect(trail).toHaveTextContent('gap 3h 20m');
    expect(trail).toHaveTextContent('OBS');
    expect(trail).toHaveTextContent('DET');
    expect(trail).toHaveTextContent('REF');
  });

  it('focuses the map on an event that carries a position', async () => {
    selectVessel();
    render(<VesselPanel />);
    let goingDark: HTMLElement | undefined;
    await waitFor(() => {
      goingDark = screen.getAllByTitle('Focus map on this event').find((b) => b.textContent?.includes('Going Dark'));
      expect(goingDark).toBeDefined();
    });
    fireEvent.click(goingDark!);
    expect(useVesselStore.getState().mapCenter).toEqual({ lat: 24.5, lon: 56.5, zoom: 10 });
  });
});

describe('VesselPanel — associates and track', () => {
  it('copies the selected contact, current viewport and filters into a shareable link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    selectVessel();
    useVesselStore.setState({
      viewport: { lat: 25.1234, lon: 55.5678, zoom: 9 },
      tankersOnly: true,
      anomalyFilter: true,
    });
    render(<VesselPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy investigation link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/dashboard?vessel=9000001&lat=25.1234&lon=55.5678&z=9.0&tankers=1&anomalies=1`,
    ));
  });

  it('opens a known associate as the next contact', async () => {
    selectVessel();
    render(<VesselPanel />);
    const assoc = await screen.findByTitle('Open PARTNER ONE');
    fireEvent.click(assoc);
    expect(useVesselStore.getState().targetVesselImo).toBe('9000002');
  });

  it('says plainly when the 24h track has no observations', () => {
    selectVessel();
    useVesselStore.setState({ showTrack: true, trackStatus: { state: 'empty', hours: 24 } });
    render(<VesselPanel />);
    expect(screen.getByTestId('track-status')).toHaveTextContent('No track observations in the last 24 hours');
  });

  it('distinguishes a drawn track from loading and failure', () => {
    selectVessel();
    useVesselStore.setState({ showTrack: true, trackStatus: { state: 'ready', count: 47, hours: 24 } });
    const view = render(<VesselPanel />);
    expect(screen.getByTestId('track-status')).toHaveTextContent('47 fixes drawn');
    useVesselStore.setState({ trackStatus: { state: 'loading' } });
    view.rerender(<VesselPanel />);
    expect(screen.getByTestId('track-status')).toHaveTextContent('Loading track');
    useVesselStore.setState({ trackStatus: { state: 'error' } });
    view.rerender(<VesselPanel />);
    expect(screen.getByTestId('track-status')).toHaveTextContent('request failed');
  });
});
