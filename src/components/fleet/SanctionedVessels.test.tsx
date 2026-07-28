/**
 * SanctionedVessels tests.
 * Validates row capping, sorting limited to name and risk, and the
 * preserved empty-list behaviour.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SanctionedVessels } from './SanctionedVessels';
import type { Anomaly } from '@/types/anomaly';

vi.mock('@/components/fleet/FleetVesselDetail', () => ({ FleetVesselDetail: () => <div /> }));

afterEach(() => cleanup());

function makeVessel(i: number, overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: i,
    imo: String(9100000 + i),
    anomalyType: 'loitering',
    confidence: 'confirmed',
    detectedAt: new Date(2026, 0, 1),
    resolvedAt: null,
    details: { centroid: { lat: 25, lon: 55 }, radiusKm: 2, durationHours: 8 },
    vesselName: `SANCTIONED ${String(i).padStart(3, '0')}`,
    flag: 'PA',
    riskScore: i,
    isSanctioned: true,
    sanctionRiskCategory: 'sanction',
    ...overrides,
  };
}

const sixty = Array.from({ length: 60 }, (_, i) => makeVessel(i + 1));

describe('SanctionedVessels', () => {
  it('renders nothing when there are no sanctioned vessels', () => {
    const { container } = render(<SanctionedVessels vessels={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('caps the desktop table at 25 rows and reports the range', () => {
    render(<SanctionedVessels vessels={sixty} />);

    const body = screen.getByRole('table').querySelector('tbody') as HTMLElement;

    expect(body.querySelectorAll('tr[data-imo]')).toHaveLength(25);
    expect(screen.getByText(/Showing 1–25 of 60/)).toBeInTheDocument();
  });

  it('sorts by risk descending by default', () => {
    render(<SanctionedVessels vessels={sixty} />);

    const first = screen.getByRole('table').querySelectorAll('tbody tr[data-imo]')[0];

    expect(first).toHaveTextContent('SANCTIONED 060');
  });

  it('offers no Detected sort — this tab has no Detected column', () => {
    render(<SanctionedVessels vessels={sixty} />);

    expect(screen.queryByRole('button', { name: /Detected/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vessel Name/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Risk Score/ })).toBeInTheDocument();
  });

  it('sorts by vessel name when its header is clicked', async () => {
    const user = userEvent.setup();
    render(<SanctionedVessels vessels={sixty} />);

    await user.click(screen.getByRole('button', { name: /Vessel Name/ }));

    const first = screen.getByRole('table').querySelectorAll('tbody tr[data-imo]')[0];
    expect(first).toHaveTextContent('SANCTIONED 001');
  });

  it('keeps the sanctioned test id and header count', () => {
    render(<SanctionedVessels vessels={sixty} />);

    expect(screen.getByTestId('sanctioned-vessels')).toBeInTheDocument();
    expect(screen.getByText('[60]')).toBeInTheDocument();
  });
});
