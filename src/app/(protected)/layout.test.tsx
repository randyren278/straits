import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ProtectedLayout from './layout';

vi.mock('next/navigation', () => ({ usePathname: () => '/fleet' }));

afterEach(() => cleanup());

describe('ProtectedLayout', () => {
  it('renders its children', () => {
    render(<ProtectedLayout><p>page body</p></ProtectedLayout>);
    expect(screen.getByText('page body')).toBeInTheDocument();
  });

  it('mounts the bottom nav so every route in the group keeps navigation on mobile', () => {
    render(<ProtectedLayout><p>page body</p></ProtectedLayout>);
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
  });
});
