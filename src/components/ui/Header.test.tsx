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
    expect(screen.getByRole('navigation')).toHaveClass('max-lg:hidden');
  });

  it('hides the map filters below lg, where the map chips take over', () => {
    render(<Header />);
    expect(screen.getByTestId('header-controls')).toHaveClass('max-lg:hidden');
  });

  it('hides the chokepoint row below lg, where the sheet takes over', () => {
    render(<Header />);
    expect(screen.getByTestId('header-chokepoints')).toHaveClass('max-lg:hidden');
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
    expect(toggle).toHaveClass('lg:hidden');
    expect(screen.queryByTestId('mobile-search')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(within(screen.getByTestId('mobile-search')).getByPlaceholderText(/search vessel/i)).toBeInTheDocument();
  });

  it('keeps exactly one status chip', () => {
    render(<Header />);
    expect(screen.getAllByTestId('status-chip')).toHaveLength(1);
  });
});
