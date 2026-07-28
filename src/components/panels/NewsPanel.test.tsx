import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsPanel, VISIBLE_HEADLINES } from './NewsPanel';

const headlines = Array.from({ length: 15 }, (_, i) => ({
  title: `Headline ${i + 1}`,
  source: 'Reuters',
  url: `https://example.com/${i + 1}`,
  publishedAt: new Date(2026, 6, 20).toISOString(),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ headlines }) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('NewsPanel', () => {
  it('caps the list at 8 items even though 15 were returned', async () => {
    render(<NewsPanel />);
    await waitFor(() => expect(screen.getByText('Headline 1')).toBeInTheDocument());
    expect(screen.getAllByRole('link')).toHaveLength(VISIBLE_HEADLINES);
    expect(VISIBLE_HEADLINES).toBe(8);
    expect(screen.queryByText('Headline 9')).not.toBeInTheDocument();
  });

  it('reveals the rest when the expand control is used', async () => {
    const user = userEvent.setup();
    render(<NewsPanel />);
    await waitFor(() => expect(screen.getByText('Headline 1')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /view all 15/i }));

    expect(screen.getAllByRole('link')).toHaveLength(15);
    expect(screen.getByText('Headline 15')).toBeInTheDocument();
  });

  it('offers no expand control when the feed already fits', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => ({ headlines: headlines.slice(0, 5) }),
    })));
    render(<NewsPanel />);
    await waitFor(() => expect(screen.getByText('Headline 1')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /view all/i })).not.toBeInTheDocument();
  });

  it('still collapses the whole panel from its header', async () => {
    const user = userEvent.setup();
    render(<NewsPanel />);
    await waitFor(() => expect(screen.getByText('Headline 1')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /collapse intel feed/i }));
    expect(screen.queryByText('Headline 1')).not.toBeInTheDocument();
  });
});
