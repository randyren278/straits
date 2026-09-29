import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StaleFilter } from './StaleFilter';
import { useTrackStore } from '@/stores/tracks';

beforeEach(() => useTrackStore.setState({ showStale: false }));

describe('StaleFilter', () => {
  it('toggles showing ships with no fix in 24 h', () => {
    render(<StaleFilter />);
    const chip = screen.getByRole('button', { name: /stale/i });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    expect(useTrackStore.getState().showStale).toBe(true);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });
});
