import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CrossingsChart, SPARSE_SAMPLING_COPY } from './CrossingsChart';
import { VoyagesTable } from './VoyagesTable';
import { incompleteRatioOf } from './ChokepointPulse';

afterEach(cleanup);

const days = [
  { day: '2026-09-12', northbound: 3, southbound: 2, waiting: 1, incomplete: 4, distinctMmsi: 9 },
  { day: '2026-09-13', northbound: 1, southbound: 0, waiting: 2, incomplete: 6, distinctMmsi: 8 },
];

describe('CrossingsChart', () => {
  it('names the metric so it cannot be confused with the contact count, and renders a day control per row', () => {
    render(<CrossingsChart days={days} selectedDay={null} onSelectDay={() => {}} incompleteRatio={0.2} />);
    expect(screen.getByText('Suez — observed crossings')).toBeInTheDocument();
    expect(screen.getByText(/not cargo, not canal-authority transit counts/)).toBeInTheDocument();
    expect(screen.getByTestId('crossing-bar-2026-09-12')).toBeInTheDocument();
    expect(screen.getByTestId('crossing-bar-2026-09-13')).toBeInTheDocument();
    expect(screen.queryByTestId('crossings-sparse')).toBeNull();
  });

  it('carries the sparse-sampling line when most entries are incomplete', () => {
    render(<CrossingsChart days={days} selectedDay={null} onSelectDay={() => {}} incompleteRatio={0.89} />);
    expect(screen.getByTestId('crossings-sparse')).toHaveTextContent(SPARSE_SAMPLING_COPY);
    expect(screen.getByTestId('crossings-sparse')).toHaveTextContent('89% incomplete');
  });

  it('a day control reports the selection', () => {
    const onSelect = vi.fn();
    render(<CrossingsChart days={days} selectedDay={null} onSelectDay={onSelect} incompleteRatio={null} />);
    fireEvent.click(screen.getByTestId('crossing-bar-2026-09-13'));
    expect(onSelect).toHaveBeenCalledWith('2026-09-13');
  });

  it('says so when there are no aggregates', () => {
    render(<CrossingsChart days={[]} selectedDay={null} onSelectDay={() => {}} incompleteRatio={null} />);
    expect(screen.getByTestId('crossings-empty')).toBeInTheDocument();
  });
});

describe('VoyagesTable', () => {
  it('renders the pruned message on null voyages', () => {
    render(<VoyagesTable day="2026-08-01" voyages={null} reason="raw positions pruned" />);
    expect(screen.getByTestId('voyages-pruned')).toHaveTextContent('raw positions for this day are pruned — daily totals retained');
  });

  it('renders one row per voyage with the incomplete reason', () => {
    render(<VoyagesTable day="2026-09-12" reason={null} voyages={[
      { mmsi: '1', direction: 'southbound', status: 'complete', gateInAt: '2026-09-12T00:10:00Z', gateOutAt: '2026-09-12T12:00:00Z', durationMinutes: 710, reason: null },
      { mmsi: '2', direction: 'northbound', status: 'incomplete', gateInAt: '2026-09-12T03:00:00Z', gateOutAt: null, durationMinutes: null, reason: 'track ended before the far gate' },
    ]} />);
    expect(screen.getAllByTestId('voyage-row')).toHaveLength(2);
    expect(screen.getByText('Port Said → Suez')).toBeInTheDocument();
    expect(screen.getByText(/incomplete · track ended before the far gate/)).toBeInTheDocument();
    expect(screen.getByText('11h50m')).toBeInTheDocument();
  });
});

describe('incompleteRatioOf', () => {
  it('is incomplete over all gate entries, null with no entries', () => {
    expect(incompleteRatioOf(days)).toBeCloseTo(10 / 16);
    expect(incompleteRatioOf([{ day: 'x', northbound: 0, southbound: 0, waiting: 5, incomplete: 0, distinctMmsi: 5 }])).toBeNull();
  });
});
