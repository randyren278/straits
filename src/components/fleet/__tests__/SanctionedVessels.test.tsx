/**
 * SanctionedVessels component tests.
 * Validates rendering, empty-state null return, count badge, and risk score coloring.
 * Requirements: M007-S01 (Sanctions Priority List)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SanctionedVessels } from '../SanctionedVessels';
import type { Anomaly } from '@/types/anomaly';

// Ensure DOM cleanup between tests (happy-dom doesn't auto-cleanup)
afterEach(cleanup);

const mockSanctionedVessels: Anomaly[] = [
  {
    id: 10,
    imo: '1111111',
    anomalyType: 'going_dark',
    confidence: 'confirmed',
    detectedAt: new Date('2025-07-01T10:00:00Z'),
    resolvedAt: null,
    details: {
      lastPosition: { lat: 26.0, lon: 56.0 },
      gapMinutes: 240,
      coverageZone: 'Strait of Hormuz',
    },
    vesselName: 'SHADOW RUNNER',
    flag: 'IR',
    riskScore: 85,
    isSanctioned: true,
    sanctionRiskCategory: 'SDN List',
  },
  {
    id: 20,
    imo: '2222222',
    anomalyType: 'loitering',
    confidence: 'suspected',
    detectedAt: new Date('2025-07-02T14:00:00Z'),
    resolvedAt: null,
    details: {
      centroid: { lat: 25.5, lon: 55.5 },
      radiusKm: 2.5,
      durationHours: 48,
    },
    vesselName: 'DARK PHANTOM',
    flag: 'SY',
    riskScore: 45,
    isSanctioned: true,
    sanctionRiskCategory: 'EU Sanctions',
  },
];

describe('SanctionedVessels', () => {
  it('renders vessel data correctly — names, IMOs, flags, and categories appear', () => {
    render(<SanctionedVessels vessels={mockSanctionedVessels} />);

    // Vessel names
    expect(screen.getByText('SHADOW RUNNER')).toBeInTheDocument();
    expect(screen.getByText('DARK PHANTOM')).toBeInTheDocument();

    // IMO numbers
    expect(screen.getByText('1111111')).toBeInTheDocument();
    expect(screen.getByText('2222222')).toBeInTheDocument();

    // Flags
    expect(screen.getByText('IR')).toBeInTheDocument();
    expect(screen.getByText('SY')).toBeInTheDocument();

    // Sanction categories
    expect(screen.getByText('SDN List')).toBeInTheDocument();
    expect(screen.getByText('EU Sanctions')).toBeInTheDocument();
  });

  it('returns null for empty array — nothing renders', () => {
    const { container } = render(<SanctionedVessels vessels={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays count badge matching number of vessels', () => {
    render(<SanctionedVessels vessels={mockSanctionedVessels} />);
    expect(screen.getByText('[2]')).toBeInTheDocument();
  });

  it('renders data-testid for diagnostic inspection', () => {
    render(<SanctionedVessels vessels={mockSanctionedVessels} />);
    expect(screen.getByTestId('sanctioned-vessels')).toBeInTheDocument();
  });

  it('colors risk score red when ≥70, amber when ≥40', () => {
    render(<SanctionedVessels vessels={mockSanctionedVessels} />);

    // Risk score 85 → red-400
    const highRisk = screen.getByText('85');
    expect(highRisk.className).toContain('text-red-400');

    // Risk score 45 → amber-400
    const medRisk = screen.getByText('45');
    expect(medRisk.className).toContain('text-amber-400');
  });

  it('renders the SANCTIONED VESSELS header label', () => {
    render(<SanctionedVessels vessels={mockSanctionedVessels} />);
    expect(screen.getByText('SANCTIONED VESSELS')).toBeInTheDocument();
  });

  it('shows a single vessel correctly', () => {
    render(<SanctionedVessels vessels={[mockSanctionedVessels[0]]} />);
    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.getByText('SHADOW RUNNER')).toBeInTheDocument();
    expect(screen.queryByText('DARK PHANTOM')).not.toBeInTheDocument();
  });
});
