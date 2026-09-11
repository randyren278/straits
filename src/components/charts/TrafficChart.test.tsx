import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TrafficChart, describeEmptyTraffic } from './TrafficChart';

afterEach(() => cleanup());

describe('describeEmptyTraffic', () => {
  it('says the zone has no history at all when coverage is empty', () => {
    const e = describeEmptyTraffic({ firstObservation: null, lastObservation: null, observedDays: 0, lookbackDays: 90 }, '30d');
    expect(e.headline).toBe('No observations in the last 30 days');
    expect(e.detail).toMatch(/last 90 days/);
    expect(e.suggestedRange).toBeNull();
  });

  it('names the observed days and suggests the range that reaches them', () => {
    const first = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
    const last = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    const e = describeEmptyTraffic({ firstObservation: first, lastObservation: last, observedDays: 6, lookbackDays: 90 }, '7d');
    expect(e.detail).toContain('6 days');
    expect(e.detail).toContain(`${first} → ${last}`);
    expect(e.suggestedRange).toBe('30d');
  });

  it('does not suggest the range the user is already on', () => {
    const first = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    const e = describeEmptyTraffic({ firstObservation: first, lastObservation: first, observedDays: 1, lookbackDays: 90 }, '7d');
    expect(e.suggestedRange).toBeNull();
  });
});

describe('TrafficChart empty state', () => {
  it('explains the gap instead of drawing an empty frame, and offers the action', () => {
    const onClick = vi.fn();
    render(
      <TrafficChart
        data={[]}
        title="Strait of Hormuz"
        range="30d"
        coverage={{ firstObservation: null, lastObservation: null, observedDays: 0, lookbackDays: 90 }}
        action={{ label: 'Show 90d', onClick }}
      />,
    );
    const empty = screen.getByTestId('traffic-empty');
    expect(empty).toHaveTextContent('No observations in the last 30 days');
    expect(empty).toHaveTextContent('Strait of Hormuz');
    fireEvent.click(screen.getByRole('button', { name: 'Show 90d' }));
    expect(onClick).toHaveBeenCalled();
  });
});
