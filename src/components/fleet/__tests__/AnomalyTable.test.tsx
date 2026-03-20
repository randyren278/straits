/**
 * AnomalyTable component tests.
 * Validates collapsed-by-default behavior and toggle functionality.
 * Requirements: M007-S01 (Default-Collapsed Tables)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnomalyTable } from '../AnomalyTable';
import type { Anomaly } from '@/types/anomaly';

// Ensure DOM cleanup between tests (happy-dom doesn't auto-cleanup)
afterEach(cleanup);

// Mock FleetVesselDetail to avoid heavy dependencies (router, stores, API)
vi.mock('@/components/fleet/FleetVesselDetail', () => ({
  FleetVesselDetail: () => <div data-testid="fleet-vessel-detail">detail</div>,
}));

const mockAnomalies: Anomaly[] = [
  {
    id: 1,
    imo: '9876543',
    anomalyType: 'going_dark',
    confidence: 'confirmed',
    detectedAt: new Date('2025-06-01T12:00:00Z'),
    resolvedAt: null,
    details: {
      lastPosition: { lat: 26.5, lon: 56.2 },
      gapMinutes: 180,
      coverageZone: 'Strait of Hormuz',
    },
    vesselName: 'STORM PETREL',
    flag: 'PA',
    riskScore: 72,
  },
  {
    id: 2,
    imo: '1234567',
    anomalyType: 'going_dark',
    confidence: 'suspected',
    detectedAt: new Date('2025-06-02T08:30:00Z'),
    resolvedAt: null,
    details: {
      lastPosition: { lat: 25.0, lon: 55.0 },
      gapMinutes: 90,
      coverageZone: 'Persian Gulf',
    },
    vesselName: 'DARK WAVE',
    flag: 'IR',
    riskScore: 45,
  },
];

describe('AnomalyTable', () => {
  it('renders collapsed by default — table rows are not visible', () => {
    render(
      <AnomalyTable anomalyType="going_dark" anomalies={mockAnomalies} />,
    );

    // The toggle button should exist and be collapsed
    const toggleButton = screen.getByRole('button', {
      name: /Going Dark anomalies/,
    });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    // The table should not be in the document when collapsed
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Vessel names should not be visible
    expect(screen.queryByText('STORM PETREL')).not.toBeInTheDocument();
    expect(screen.queryByText('DARK WAVE')).not.toBeInTheDocument();
  });

  it('expands when the header button is clicked, showing table rows', async () => {
    const user = userEvent.setup();

    render(
      <AnomalyTable anomalyType="going_dark" anomalies={mockAnomalies} />,
    );

    const toggleButton = screen.getByRole('button', {
      name: /Going Dark anomalies/,
    });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    await user.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('STORM PETREL')).toBeInTheDocument();
    expect(screen.getByText('DARK WAVE')).toBeInTheDocument();
  });

  it('collapses again when the header button is clicked a second time', async () => {
    const user = userEvent.setup();

    render(
      <AnomalyTable anomalyType="going_dark" anomalies={mockAnomalies} />,
    );

    const toggleButton = screen.getByRole('button', {
      name: /Going Dark anomalies/,
    });

    // Expand
    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Collapse
    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('displays anomaly count in the header', () => {
    render(
      <AnomalyTable anomalyType="going_dark" anomalies={mockAnomalies} />,
    );

    expect(screen.getByText('[2]')).toBeInTheDocument();
  });

  it('renders accessible label with anomaly type and count', () => {
    render(
      <AnomalyTable anomalyType="going_dark" anomalies={mockAnomalies} />,
    );

    const toggleButton = screen.getByRole('button', {
      name: /Going Dark anomalies/,
    });
    expect(toggleButton).toHaveAttribute(
      'aria-label',
      'Going Dark anomalies — 2 detected',
    );
  });
});
