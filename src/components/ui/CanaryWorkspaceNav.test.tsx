import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { CanaryWorkspaceNav } from './CanaryWorkspaceNav';

const pathname = vi.hoisted(() => ({ current: '/investigations' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));
vi.mock('@/lib/canary-client', () => ({ IS_CANARY_CLIENT: true }));

afterEach(() => { cleanup(); pathname.current = '/investigations'; });

describe('CanaryWorkspaceNav', () => {
  it('shows the four workspaces and marks Following active on nested routes', () => {
    pathname.current = '/investigations/following/alerts';
    render(<CanaryWorkspaceNav />);
    const nav = screen.getByRole('navigation', { name: 'Canary workspaces' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Investigations', 'Parallel Seas', 'Coverage', 'Following']);
    expect(within(nav).getByRole('link', { name: 'Following' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps saved story pages under Investigations', () => {
    pathname.current = '/investigations/stories/abc123';
    render(<CanaryWorkspaceNav />);
    expect(screen.getByRole('link', { name: 'Investigations' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not render on non-workspace paths', () => {
    pathname.current = '/dashboard';
    const { container } = render(<CanaryWorkspaceNav />);
    expect(container).toBeEmptyDOMElement();
  });
});
