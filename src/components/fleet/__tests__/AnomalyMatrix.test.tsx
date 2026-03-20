/**
 * AnomalyMatrix component tests (M007-S02-T02)
 *
 * Validates grid dimensions, count aggregation, brightness tier selection,
 * empty state, and missing shipCategory fallback.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AnomalyMatrix } from '../AnomalyMatrix';
import type { Anomaly } from '@/types/anomaly';

// Ensure DOM cleanup between tests (happy-dom doesn't auto-cleanup)
afterEach(cleanup);

/** Helper to build a minimal mock anomaly */
function mockAnomaly(
  overrides: Partial<Anomaly> & Pick<Anomaly, 'anomalyType'>,
): Anomaly {
  return {
    id: Math.floor(Math.random() * 100000),
    imo: '9999999',
    confidence: 'confirmed',
    detectedAt: new Date('2025-06-01T12:00:00Z'),
    resolvedAt: null,
    details: {
      lastPosition: { lat: 26.5, lon: 56.2 },
      gapMinutes: 180,
      coverageZone: 'Strait of Hormuz',
    },
    ...overrides,
  };
}

describe('AnomalyMatrix', () => {
  it('renders 3 data rows and 6 data columns (correct grid dimensions)', () => {
    const anomalies: Anomaly[] = [
      mockAnomaly({ anomalyType: 'going_dark', shipCategory: 'tanker' }),
    ];

    render(<AnomalyMatrix anomalies={anomalies} />);

    // 1 header row + 3 data rows = 4 total rows
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);

    // 6 column headers (DARK, LOITER, ROUTE, DRIFT, REPEAT, STS)
    const headers = screen.getAllByRole('columnheader');
    // 7 total: 1 empty top-left + 6 anomaly type headers
    expect(headers).toHaveLength(7);

    // Verify the short labels appear
    expect(screen.getByText('DARK')).toBeInTheDocument();
    expect(screen.getByText('LOITER')).toBeInTheDocument();
    expect(screen.getByText('ROUTE')).toBeInTheDocument();
    expect(screen.getByText('DRIFT')).toBeInTheDocument();
    expect(screen.getByText('REPEAT')).toBeInTheDocument();
    expect(screen.getByText('STS')).toBeInTheDocument();

    // Verify row labels
    expect(screen.getByText('TANKER')).toBeInTheDocument();
    expect(screen.getByText('CARGO')).toBeInTheDocument();
    expect(screen.getByText('OTHER')).toBeInTheDocument();
  });

  it('aggregates counts correctly across ship categories and anomaly types', () => {
    const anomalies: Anomaly[] = [
      // 3 tanker going_dark anomalies
      mockAnomaly({ id: 1, anomalyType: 'going_dark', shipCategory: 'tanker' }),
      mockAnomaly({ id: 2, anomalyType: 'going_dark', shipCategory: 'tanker' }),
      mockAnomaly({ id: 3, anomalyType: 'going_dark', shipCategory: 'tanker' }),
      // 1 cargo loitering anomaly
      mockAnomaly({ id: 4, anomalyType: 'loitering', shipCategory: 'cargo' }),
    ];

    render(<AnomalyMatrix anomalies={anomalies} />);

    // Get all data rows (skip header row)
    const rows = screen.getAllByRole('row');
    const tankerRow = rows[1]; // First data row
    const cargoRow = rows[2]; // Second data row
    const otherRow = rows[3]; // Third data row

    // Tanker row: DARK=3, rest=0
    const tankerCells = tankerRow.querySelectorAll('td');
    // First td is the row label "TANKER", then 6 data cells
    expect(tankerCells[1].textContent).toBe('3'); // DARK
    expect(tankerCells[2].textContent).toBe('0'); // LOITER
    expect(tankerCells[3].textContent).toBe('0'); // ROUTE
    expect(tankerCells[4].textContent).toBe('0'); // DRIFT
    expect(tankerCells[5].textContent).toBe('0'); // REPEAT
    expect(tankerCells[6].textContent).toBe('0'); // STS

    // Cargo row: LOITER=1, rest=0
    const cargoCells = cargoRow.querySelectorAll('td');
    expect(cargoCells[1].textContent).toBe('0'); // DARK
    expect(cargoCells[2].textContent).toBe('1'); // LOITER

    // Other row: all 0
    const otherCells = otherRow.querySelectorAll('td');
    for (let i = 1; i <= 6; i++) {
      expect(otherCells[i].textContent).toBe('0');
    }
  });

  it('selects correct brightness tier CSS classes based on count', () => {
    // Create 10+ anomalies in one cell to hit the highest tier
    const anomalies: Anomaly[] = Array.from({ length: 12 }, (_, i) =>
      mockAnomaly({ id: i + 1, anomalyType: 'going_dark', shipCategory: 'tanker' }),
    );

    render(<AnomalyMatrix anomalies={anomalies} />);

    const rows = screen.getAllByRole('row');
    const tankerRow = rows[1];
    const tankerCells = tankerRow.querySelectorAll('td');

    // Cell with count 12 should have highest brightness tier
    expect(tankerCells[1].className).toContain('bg-amber-500/80');

    // Cell with count 0 should have lowest brightness tier
    expect(tankerCells[2].className).toContain('bg-amber-500/5');
  });

  it('returns null when passed an empty anomalies array', () => {
    render(<AnomalyMatrix anomalies={[]} />);

    expect(screen.queryByTestId('anomaly-matrix')).not.toBeInTheDocument();
  });

  it('counts anomalies with missing shipCategory in the Other row', () => {
    const anomalies: Anomaly[] = [
      // Anomaly without shipCategory — should fall into "other"
      mockAnomaly({ id: 1, anomalyType: 'deviation', shipCategory: undefined }),
      mockAnomaly({ id: 2, anomalyType: 'deviation', shipCategory: undefined }),
      // Explicit "other" anomaly
      mockAnomaly({ id: 3, anomalyType: 'deviation', shipCategory: 'other' }),
    ];

    render(<AnomalyMatrix anomalies={anomalies} />);

    const rows = screen.getAllByRole('row');
    const otherRow = rows[3]; // Third data row = "OTHER"
    const otherCells = otherRow.querySelectorAll('td');

    // ROUTE column (index 3 = deviation) should show 3 (2 undefined + 1 explicit other)
    expect(otherCells[3].textContent).toBe('3');

    // Tanker and cargo rows should have 0 for deviation
    const tankerRow = rows[1];
    const cargoRow = rows[2];
    expect(tankerRow.querySelectorAll('td')[3].textContent).toBe('0');
    expect(cargoRow.querySelectorAll('td')[3].textContent).toBe('0');
  });

  it('has data-testid="anomaly-matrix" on the outer div', () => {
    const anomalies: Anomaly[] = [
      mockAnomaly({ anomalyType: 'going_dark', shipCategory: 'tanker' }),
    ];

    render(<AnomalyMatrix anomalies={anomalies} />);

    expect(screen.getByTestId('anomaly-matrix')).toBeInTheDocument();
  });
});
