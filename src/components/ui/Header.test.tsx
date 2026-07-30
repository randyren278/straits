import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('./StatusChip', () => ({ StatusChip: () => <div data-testid="status-chip" /> }));
vi.mock('./NotificationBell', () => ({ NotificationBell: () => <button>Notifications</button> }));
vi.mock('./ChokepointWidget', () => ({ ChokepointWidgets: () => <div data-testid="chokepoints" /> }));
vi.mock('./SearchInput', () => ({
  SearchInput: () => <input placeholder="Search vessel..." />,
}));
vi.mock('./DataFreshness', () => ({ DataFreshness: () => <span data-testid="freshness" /> }));

afterEach(() => cleanup());

describe('Header', () => {
  it('hides the primary nav below lg, where the bottom bar takes over', () => {
    render(<Header />);
    expect(screen.getByRole('navigation')).toHaveClass('phone:hidden');
  });

  it('hides the map filters below lg, where the map chips take over', () => {
    render(<Header />);
    expect(screen.getByTestId('header-controls')).toHaveClass('phone:hidden');
  });

  it('hides the chokepoint row below lg, where the sheet takes over', () => {
    render(<Header />);
    expect(screen.getByTestId('header-chokepoints')).toHaveClass('phone:hidden');
  });

  it('gives the logo a 44px minimum in both dimensions', () => {
    render(<Header />);
    const logo = screen.getByRole('link', { name: /straits/i });
    expect(logo.className).toMatch(/min-w-\[44px\]/);
    expect(logo.className).toMatch(/min-h-\[44px\]/);
  });

  it('offers search as a toggle on mobile rather than a permanent row', async () => {
    const user = userEvent.setup();
    render(<Header />);

    const toggle = screen.getByRole('button', { name: /search/i });
    expect(toggle).toHaveClass('roomy:hidden');
    expect(screen.queryByTestId('mobile-search')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(within(screen.getByTestId('mobile-search')).getByPlaceholderText(/search vessel/i)).toBeInTheDocument();
  });

  it('mounts exactly one status chip in the mobile cluster and one in the desktop row', () => {
    // happy-dom does not evaluate media queries, so both the `roomy:hidden`
    // mobile cluster and the `phone:hidden` desktop row are always present
    // in the DOM here — only CSS (unavailable in this environment) decides
    // which one is actually visible at a given width. What this test can
    // verify structurally is the intent: exactly one StatusChip lives inside
    // each cluster, so CSS visibility alone determines the single visible
    // instance rather than any instance being duplicated within a cluster.
    // The real single-visible-instance behavior is verified in a browser.
    render(<Header />);
    expect(within(screen.getByTestId('header-mobile-controls')).getAllByTestId('status-chip')).toHaveLength(1);
    expect(within(screen.getByTestId('header-controls')).getAllByTestId('status-chip')).toHaveLength(1);
  });
});
