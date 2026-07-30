import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MapFilterChips } from './MapFilterChips';

afterEach(() => cleanup());

describe('MapFilterChips', () => {
  it('renders both map filters', () => {
    render(<MapFilterChips />);
    expect(screen.getByRole('button', { name: /all vessels|tankers only/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anomalies/i })).toBeInTheDocument();
  });

  it('is hidden at desktop widths so the header copy stays authoritative', () => {
    const { container } = render(<MapFilterChips />);
    expect(container.firstElementChild).toHaveClass('desk:hidden');
  });

  it('overlays the map rather than taking layout space', () => {
    const { container } = render(<MapFilterChips />);
    expect(container.firstElementChild).toHaveClass('absolute');
  });
});
