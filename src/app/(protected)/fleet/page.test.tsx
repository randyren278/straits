/**
 * Fleet page tests.
 * Validates tab derivation from data, default tab selection, single-panel
 * rendering and removal of the mobile summary strip.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FleetPage from './page';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock('@/components/ui/Header', () => ({ Header: () => <header /> }));
vi.mock('@/components/fleet/FleetVesselDetail', () => ({ FleetVesselDetail: () => <div /> }));

function anomaly(id: number, type: string, sanctioned = false) {
  return {
    id,
    imo: String(9200000 + id),
    anomalyType: type,
    confidence: 'confirmed',
    detectedAt: '2026-01-05T00:00:00Z',
    resolvedAt: null,
    details: {},
    vesselName: `SHIP ${id}`,
    flag: 'PA',
    riskScore: id,
    isSanctioned: sanctioned,
    sanctionRiskCategory: sanctioned ? 'sanction' : null,
  };
}

const payload = {
  anomalies: [
    ...Array.from({ length: 5 }, (_, i) => anomaly(i + 1, 'loitering', i < 2)),
    ...Array.from({ length: 3 }, (_, i) => anomaly(i + 20, 'speed')),
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => payload })),
  );
});

describe('FleetPage', () => {
  it('derives one tab per category plus a sanctioned tab', async () => {
    render(<FleetPage />);

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    const labels = screen.getAllByRole('tab').map((t) => t.textContent ?? '');
    expect(labels[0]).toMatch(/Sanctioned/);
    expect(labels.some((l) => /Loitering/.test(l))).toBe(true);
    expect(labels.some((l) => /Speed Anomaly/.test(l))).toBe(true);
    expect(labels).toHaveLength(3);
  });

  it('selects the sanctioned tab by default', async () => {
    render(<FleetPage />);

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    const selected = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent(/Sanctioned/);
  });

  it('renders exactly one tabpanel at a time', async () => {
    const user = userEvent.setup();
    render(<FleetPage />);

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: /Loitering/ }));

    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.queryByTestId('sanctioned-vessels')).not.toBeInTheDocument();
  });

  it('labels the panel with its tab', async () => {
    render(<FleetPage />);

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'fleet-tab-sanctioned');
  });

  it('no longer renders the mobile summary strip', async () => {
    render(<FleetPage />);

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    expect(screen.queryByTestId('mobile-anomaly-summary')).not.toBeInTheDocument();
  });
});
