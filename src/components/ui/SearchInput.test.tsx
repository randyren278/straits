/**
 * Search had six states and rendered visible output in one of them. These tests
 * pin all six, plus the two data defects: a null flag used to leave a dangling
 * pipe, and a vessel with no position fix used to be a silent dead click.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput } from './SearchInput';

const PLACED = {
  imo: '9299862', mmsi: '667002199', name: 'TENDUA',
  flag: null, shipType: 80, latitude: 31.5418, longitude: 32.3459,
};
const UNPLACED = {
  imo: '9354521', mmsi: '412330991', name: 'ANHONA',
  flag: null, shipType: 80, latitude: null, longitude: null,
};

// Resolved via setTimeout rather than mockResolvedValue: an instantly-resolved
// promise lets React 19 batch setLoading(true) and setLoading(false) into one
// commit, so the loading state never actually reaches the DOM. A real fetch
// always has a macrotask gap; this restores one.
function mockSearch(results: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise((resolve) => {
    setTimeout(() => resolve({ ok: true, json: async () => ({ results }) }), 0);
  })));
}

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('SearchInput states', () => {
  it('names the three accepted key types when focused and empty', async () => {
    const user = userEvent.setup();
    mockSearch([]);
    render(<SearchInput />);
    await user.click(screen.getByRole('textbox'));
    expect(screen.getByText(/vessel name, IMO number, or MMSI/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TENDUA' })).toBeInTheDocument();
  });

  it('states the exact remaining gap below the two-character floor', async () => {
    const user = userEvent.setup();
    mockSearch([]);
    render(<SearchInput />);
    await user.type(screen.getByRole('textbox'), 'T');
    expect(screen.getByText(/1 more character/i)).toBeInTheDocument();
  });

  it('shows a busy state while the request is in flight', async () => {
    const user = userEvent.setup();
    mockSearch([PLACED]);
    render(<SearchInput />);
    await user.type(screen.getByRole('textbox'), 'TE');
    expect(await screen.findByTestId('search-loading')).toBeInTheDocument();
  });

  it('omits the separator entirely when flag is null', async () => {
    const user = userEvent.setup();
    mockSearch([PLACED]);
    render(<SearchInput />);
    await user.type(screen.getByRole('textbox'), 'TENDUA');
    const row = await screen.findByRole('option', { name: /TENDUA/ });
    expect(row.textContent).toContain('IMO 9299862');
    expect(row.textContent).not.toMatch(/\|\s*$/);
    expect(row.textContent).not.toMatch(/·\s*$/);
  });

  it('echoes the query when nothing matches', async () => {
    const user = userEvent.setup();
    mockSearch([]);
    render(<SearchInput />);
    await user.type(screen.getByRole('textbox'), 'ZZZZ');
    expect(await screen.findByText(/No vessel matches/i)).toBeInTheDocument();
    expect(screen.getByText(/ZZZZ/)).toBeInTheDocument();
  });

  it('marks a vessel with no position fix', async () => {
    const user = userEvent.setup();
    mockSearch([UNPLACED]);
    render(<SearchInput />);
    await user.type(screen.getByRole('textbox'), 'ANHONA');
    const row = await screen.findByRole('option', { name: /ANHONA/ });
    expect(row.textContent).toMatch(/NO FIX/i);
  });

  it('reports the result count', async () => {
    const user = userEvent.setup();
    mockSearch([PLACED, UNPLACED]);
    render(<SearchInput />);
    await user.type(screen.getByRole('textbox'), 'TE');
    expect(await screen.findByText('2 vessels')).toBeInTheDocument();
  });

  it('hands the full result to the parent, position or not', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockSearch([UNPLACED]);
    render(<SearchInput onSelectVessel={onSelect} />);
    await user.type(screen.getByRole('textbox'), 'ANHONA');
    await user.click(await screen.findByRole('option', { name: /ANHONA/ }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ imo: '9354521', latitude: null }),
    ));
  });
});
