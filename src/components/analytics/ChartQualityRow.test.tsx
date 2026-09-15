import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ChartQualityRow } from './ChartQualityRow';

afterEach(cleanup);

const coverage = {
  id: 'hormuz', name: 'Strait of Hormuz', subscribed: true, quality: 'insufficient' as const,
  basis: { bucketsLast6h: 12, nonEmptyLast6h: 0, latestFix: null, latestFixAgeMinutes: null, unique24h: 0 },
};

describe('ChartQualityRow', () => {
  it('renders the chip with the basis inline once coverage is known', () => {
    render(<ChartQualityRow chokepointId="hormuz" coverage={coverage} />);
    const row = screen.getByTestId('chart-quality-hormuz');
    expect(row).toHaveTextContent('Insufficient observations');
    expect(row).toHaveTextContent('no fix in 24h');
    expect(screen.getByTestId('quality-chip-chart-hormuz')).toHaveAttribute('data-quality', 'insufficient');
  });

  it('shows a loading note, not a label, before the first poll', () => {
    render(<ChartQualityRow chokepointId="suez" coverage={null} />);
    expect(screen.getByTestId('chart-quality-suez')).toHaveTextContent('loading collection record');
    expect(screen.queryByTestId('quality-chip-chart-suez')).toBeNull();
  });
});
