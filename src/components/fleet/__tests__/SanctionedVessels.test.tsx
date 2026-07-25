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

    // Dual-render (mobile card + desktop table) means each datum can appear more than once.
    expect(screen.getAllByText('SHADOW RUNNER').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('DARK PHANTOM').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1111111').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2222222').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('IR').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SY').length).toBeGreaterThanOrEqual(1);
    // Sanction category is the critical datum — must appear (card list surfaces it on mobile).
    expect(screen.getAllByText('SDN List').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('EU Sanctions').length).toBeGreaterThanOrEqual(1);
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

    // At least one rendering of the score (table cell or card badge) carries the color class.
    expect(screen.getAllByText('85').some((el) => el.className.includes('text-red-400'))).toBe(true);
    expect(screen.getAllByText('45').some((el) => el.className.includes('text-amber-400'))).toBe(true);
  });

  it('renders the SANCTIONED VESSELS header label', () => {
    render(<SanctionedVessels vessels={mockSanctionedVessels} />);
    expect(screen.getByText('SANCTIONED VESSELS')).toBeInTheDocument();
  });

  it('shows a single vessel correctly', () => {
    render(<SanctionedVessels vessels={[mockSanctionedVessels[0]]} />);
    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.getAllByText('SHADOW RUNNER').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText('DARK PHANTOM')).toHaveLength(0);
  });
});
