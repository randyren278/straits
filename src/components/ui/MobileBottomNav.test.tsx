import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MobileBottomNav } from './MobileBottomNav';

const pathname = vi.hoisted(() => ({ current: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

afterEach(() => { cleanup(); pathname.current = '/dashboard'; });

describe('MobileBottomNav', () => {
  it('renders all four destinations', () => {
    render(<MobileBottomNav />);
    for (const label of ['Map', 'Analytics', 'Fleet', 'About']) {
      expect(screen.getByRole('link', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }
  });

  it('marks only the active route as current', () => {
    pathname.current = '/fleet';
    render(<MobileBottomNav />);
    const current = screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(/fleet/i);
  });

  it('is hidden at desktop widths', () => {
    render(<MobileBottomNav />);
    expect(screen.getByRole('navigation')).toHaveClass('lg:hidden');
  });

  it('gives every destination a 44px minimum tap height', () => {
    render(<MobileBottomNav />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toMatch(/min-h-\[44px\]/);
    }
  });
});
