import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { AisOutageBanner } from './AisOutageBanner';
import { StatusChip } from './StatusChip';

vi.mock('@/stores/vessel', () => ({
  useVesselStore: () => ({ lastUpdate: new Date() }),
}));

function stubStatus(ais: string) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ ais, prices: 'live', news: 'live' }),
  })));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AisOutageBanner', () => {
  it('announces the outage when AIS is offline', async () => {
    stubStatus('offline');
    render(<AisOutageBanner />);
    const banner = await screen.findByTestId('ais-outage-banner');
    expect(banner).toHaveTextContent(/AIS feed offline/i);
    // The point of the banner is explaining the empty map, not just flagging it.
    expect(banner).toHaveTextContent(/upstream AIS provider/i);
  });

  it('is exposed to assistive tech as a status', async () => {
    stubStatus('offline');
    render(<AisOutageBanner />);
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });

  it('stays out of the way when AIS is live', async () => {
    stubStatus('live');
    render(<AisOutageBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByTestId('ais-outage-banner')).not.toBeInTheDocument();
  });

  it('does not fire on degraded — the header dot already covers a late harvest', async () => {
    stubStatus('degraded');
    render(<AisOutageBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByTestId('ais-outage-banner')).not.toBeInTheDocument();
  });

  it('renders nothing before the first poll lands, so it cannot flash on cold load', async () => {
    // Hold the response open so we can observe the pre-status render.
    let release: (res: unknown) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { release = resolve; })));

    const { container } = render(<AisOutageBanner />);
    expect(container).toBeEmptyDOMElement();

    // Then let it settle: usePolledJson's registry is module-level, and a
    // request left permanently in flight short-circuits every later poll
    // (`if (entry.inFlight) return entry.inFlight`) — which would silently
    // wedge the next test rather than fail it honestly.
    release({ ok: true, json: async () => ({ ais: 'live', prices: 'live', news: 'live' }) });
    await waitFor(() => expect(screen.queryByTestId('ais-outage-banner')).not.toBeInTheDocument());
  });
});

describe('AisOutageBanner polling cost', () => {
  beforeEach(() => stubStatus('offline'));

  it('joins StatusChip\'s poller instead of opening a second one', async () => {
    // Both components subscribe to the '/api/status' key; usePolledJson
    // ref-counts by key, so the banner must add zero extra requests.
    render(
      <>
        <StatusChip />
        <AisOutageBanner />
      </>,
    );
    await screen.findByTestId('ais-outage-banner');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
