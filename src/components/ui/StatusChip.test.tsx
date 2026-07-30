import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusChip, worstStatus, compactAge } from './StatusChip';

// Mutable so individual tests can flip lastUpdate to null without relying on
// vi.doMock racing an already-resolved static import (doMock isn't hoisted,
// so it can't retroactively change what a module-scope `import` bound).
const vesselMock = vi.hoisted(() => ({ lastUpdate: new Date(Date.now() - 60_000) as Date | null }));
vi.mock('@/stores/vessel', () => ({
  useVesselStore: () => vesselMock,
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ ais: 'live', prices: 'degraded', news: 'live' }),
  })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vesselMock.lastUpdate = new Date(Date.now() - 60_000);
});

describe('worstStatus', () => {
  it('ranks offline above degraded above live', () => {
    expect(worstStatus({ ais: 'live', prices: 'degraded', news: 'offline' })).toBe('offline');
    expect(worstStatus({ ais: 'live', prices: 'degraded', news: 'live' })).toBe('degraded');
    expect(worstStatus({ ais: 'live', prices: 'live', news: 'live' })).toBe('live');
  });

  it('returns null only when every source is unknown', () => {
    expect(worstStatus({ ais: null, prices: null, news: null })).toBeNull();
    expect(worstStatus({ ais: null, prices: 'live', news: null })).toBe('live');
  });
});

describe('StatusChip', () => {
  it('renders one mobile summary and one desktop breakdown', async () => {
    render(<StatusChip />);
    await waitFor(() => expect(screen.getByTestId('status-chip-mobile')).toBeInTheDocument());
    expect(screen.getByTestId('status-chip-mobile')).toHaveClass('desk:hidden');
    expect(screen.getByTestId('status-chip-desktop').className).toMatch(/hidden/);
  });

  it('summarises the worst source state on the mobile chip', async () => {
    render(<StatusChip />);
    await waitFor(() =>
      expect(screen.getByTestId('status-chip-mobile')).toHaveAccessibleName(/degraded/i),
    );
  });

  it('discloses the per-source breakdown when tapped', async () => {
    const user = userEvent.setup();
    render(<StatusChip />);
    await waitFor(() => expect(screen.getByTestId('status-chip-mobile')).toBeInTheDocument());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('status-chip-mobile'));

    const panel = screen.getByRole('dialog');
    expect(panel).toHaveTextContent(/AIS/);
    expect(panel).toHaveTextContent(/Prices/);
    expect(panel).toHaveTextContent(/News/);
  });

  it('polls once, not once per rendered layout', async () => {
    render(<StatusChip />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('still shows a status dot when there is no vessel timestamp', async () => {
    vesselMock.lastUpdate = null;
    render(<StatusChip />);
    await waitFor(() => expect(screen.getByTestId('status-chip-mobile')).toBeInTheDocument());
  });
});

describe('compactAge', () => {
  const at = (secondsAgo: number) => new Date(1_000_000_000_000 - secondsAgo * 1000);
  const NOW = 1_000_000_000_000;

  it('collapses anything under a minute to "now"', () => {
    expect(compactAge(at(0), NOW)).toBe('now');
    expect(compactAge(at(59), NOW)).toBe('now');
  });

  it('uses single-letter units so the chip stays narrow', () => {
    expect(compactAge(at(60), NOW)).toBe('1m');
    expect(compactAge(at(1800), NOW)).toBe('30m');
    expect(compactAge(at(3600), NOW)).toBe('1h');
    expect(compactAge(at(86_400), NOW)).toBe('1d');
  });

  it('never returns prose — the string that ate the top bar was 19 chars', () => {
    for (const s of [0, 30, 90, 4000, 200_000, 9_000_000]) {
      expect(compactAge(at(s), NOW).length).toBeLessThanOrEqual(4);
    }
  });

  it('clamps a future timestamp rather than emitting a negative age', () => {
    expect(compactAge(new Date(NOW + 60_000), NOW)).toBe('now');
  });
});
