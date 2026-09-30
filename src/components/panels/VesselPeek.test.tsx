import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VesselPeek } from './VesselPeek';
import { useVesselStore } from '@/stores/vessel';
import { useTrackStore } from '@/stores/tracks';
import type { TrackPayload } from '@/lib/tracks/types';

const ship = { imo: '9000001', mmsi: '123', name: 'LULWAH T', flag: null, shipType: 80, destination: 'FUJAIRAH', lastSeen: null,
  position: { time: new Date(Date.now() - 18 * 3600_000), latitude: 25.2, longitude: 56.5, speed: null, course: null, heading: null } } as never;
const payload = (over: Partial<TrackPayload>): TrackPayload => ({ mmsi: '123', tier: 0, score: 80, parts: [1, 1, 1, 1, 1], state: 'underway', sog: 11.6, cog: 306,
  lastRealAt: Date.now() / 60000 - 15, method: 'hybrid', tau: null, uncert: 0.03, path: null, trail: null, cleaning: { kept: 1, rejected: 0, inland: 0, rerouted: 0 }, ...over });

afterEach(() => { cleanup(); useVesselStore.setState({ selectedVessel: null }); useTrackStore.setState({ byMmsi: new Map() }); });

describe('VesselPeek', () => {
  it('says what the ship is doing and that its position is an estimate', () => {
    useVesselStore.setState({ selectedVessel: ship });
    useTrackStore.setState({ byMmsi: new Map([['123', payload({})]]) });
    render(<VesselPeek expanded={false} onToggle={() => {}} />);
    expect(screen.getByText('LULWAH T')).toBeInTheDocument();
    expect(screen.getByText(/11\.6 kn · 306° · est 15m/)).toBeInTheDocument();
  });

  it('shows the fix age for a ship at rest, expands on swipe up and closes on swipe down', () => {
    useVesselStore.setState({ selectedVessel: ship });
    useTrackStore.setState({ byMmsi: new Map([['123', payload({ state: 'rest', sog: 0 })]]) });
    const onExpand = vi.fn();
    render(<VesselPeek expanded={false} onToggle={onExpand} />);
    expect(screen.getByText(/At rest · 18h ago/)).toBeInTheDocument();
    const card = screen.getByTestId('vessel-peek');
    fireEvent.pointerDown(card, { clientY: 300 }); fireEvent.pointerUp(card, { clientY: 240 });
    expect(onExpand).toHaveBeenCalled();
    fireEvent.pointerDown(card, { clientY: 300 }); fireEvent.pointerUp(card, { clientY: 380 });
    expect(useVesselStore.getState().selectedVessel).toBeNull();
  });
});
