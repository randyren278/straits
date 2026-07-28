/**
 * AnomalyTable tests.
 * Validates that the accordion is gone, rows are capped at 25, sorting
 * reorders (nulls last), and the per-row dossier still expands.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnomalyTable } from './AnomalyTable';
import type { Anomaly } from '@/types/anomaly';

vi.mock('@/components/fleet/FleetVesselDetail', () => ({ FleetVesselDetail: () => <div /> }));

afterEach(() => cleanup());

function makeAnomaly(i: number, overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: i,
    imo: String(9000000 + i),
    anomalyType: 'loitering',
    confidence: 'confirmed',
    detectedAt: new Date(2026, 0, 1 + (i % 28)),
    resolvedAt: null,
    details: { centroid: { lat: 25, lon: 55 }, radiusKm: 2, durationHours: 8 },
    vesselName: `VESSEL ${String(i).padStart(3, '0')}`,
    flag: 'PA',
    riskScore: i,
    ...overrides,
  };
}

const many = Array.from({ length: 40 }, (_, i) => makeAnomaly(i + 1));

describe('AnomalyTable', () => {
  it('renders rows immediately with no accordion to open', () => {
    render(<AnomalyTable anomalyType="loitering" anomalies={many} />);

    expect(screen.queryByRole('button', { name: /Loitering anomalies —/ })).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('caps rendered rows at 25', () => {
    render(<AnomalyTable anomalyType="loitering" anomalies={many} />);

    const body = screen.getByRole('table').querySelector('tbody') as HTMLElement;

    expect(within(body).getAllByRole('button', { name: /expand for intelligence dossier/ })).toHaveLength(25);
    expect(screen.getByText(/Showing 1–25 of 40/)).toBeInTheDocument();
  });

  it('sorts by risk descending by default', () => {
    render(<AnomalyTable anomalyType="loitering" anomalies={many} />);

    const first = screen.getByRole('table').querySelectorAll('tbody tr')[0];

    expect(first).toHaveTextContent('VESSEL 040');
  });

  it('places anomalies with no risk score last in both directions', async () => {
    const user = userEvent.setup();
    const rows = [
      makeAnomaly(1, { vesselName: 'HAS RISK', riskScore: 50 }),
      makeAnomaly(2, { vesselName: 'NO RISK', riskScore: undefined }),
      makeAnomaly(3, { vesselName: 'LOW RISK', riskScore: 5 }),
    ];
    render(<AnomalyTable anomalyType="loitering" anomalies={rows} />);

    const names = () =>
      Array.from(screen.getByRole('table').querySelectorAll('tbody tr[data-imo]')).map(
        (tr) => tr.textContent ?? '',
      );

    expect(names()[2]).toContain('NO RISK');

    await user.click(screen.getByRole('button', { name: /Risk Score/ }));

    expect(names()[0]).toContain('LOW RISK');
    expect(names()[2]).toContain('NO RISK');
  });

  it('pages forward and updates the visible rows', async () => {
    const user = userEvent.setup();
    render(<AnomalyTable anomalyType="loitering" anomalies={many} />);

    await user.click(screen.getByRole('button', { name: /next page/i }));

    expect(screen.getByText(/Showing 26–40 of 40/)).toBeInTheDocument();
    expect(screen.getByRole('table').querySelectorAll('tbody tr[data-imo]')).toHaveLength(15);
  });

  it('collapses an open dossier when the page changes', async () => {
    const user = userEvent.setup();
    render(<AnomalyTable anomalyType="loitering" anomalies={many} />);

    const row = screen.getAllByRole('button', { name: /expand for intelligence dossier/ })[0];
    await user.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: /next page/i }));

    const expanded = screen
      .getAllByRole('button', { name: /expand for intelligence dossier/ })
      .filter((el) => el.getAttribute('aria-expanded') === 'true');
    expect(expanded).toHaveLength(0);
  });
});
