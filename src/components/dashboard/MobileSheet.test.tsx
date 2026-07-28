import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileSheet } from './MobileSheet';

const chokepoints = [
  { name: 'Hormuz', tankers: 10, total: 23 },
  { name: 'Suez', tankers: 85, total: 161 },
];

function setup(props: Partial<React.ComponentProps<typeof MobileSheet>> = {}) {
  return render(
    <MobileSheet
      chokepoints={chokepoints}
      collapsed={false}
      // MobileSheet's `children` is a named { prices, intel } slot object, not JSX nesting.
      // eslint-disable-next-line react/no-children-prop
      children={{ prices: <div>PRICES BODY</div>, intel: <div>INTEL BODY</div> }}
      {...props}
    />,
  );
}

afterEach(() => cleanup());

describe('MobileSheet', () => {
  it('starts at peek showing the chokepoint strip and no tabs', () => {
    setup();
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'peek');
    expect(screen.getByTestId('sheet-peek-strip')).toHaveTextContent('Hormuz');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('expands through the detents from the handle', async () => {
    const user = userEvent.setup();
    setup();
    const handle = screen.getByRole('button', { name: /expand panel/i });

    await user.click(handle);
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'half');
    await user.click(handle);
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'full');
    await user.click(handle);
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'peek');
  });

  it('hides the peek strip once tabs are available, so the counts are not shown twice', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /expand panel/i }));

    expect(screen.queryByTestId('sheet-peek-strip')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /chokepoints/i })).toBeInTheDocument();
  });

  it('switches panels and mounts only the selected one', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /expand panel/i }));

    expect(screen.queryByText('INTEL BODY')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /intel/i }));

    expect(screen.getByText('INTEL BODY')).toBeInTheDocument();
    expect(screen.queryByText('PRICES BODY')).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('moves selection with arrow keys and takes focus with it', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /expand panel/i }));

    screen.getByRole('tab', { name: /chokepoints/i }).focus();
    await user.keyboard('{ArrowRight}');

    const prices = screen.getByRole('tab', { name: /prices/i });
    expect(prices).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(prices);
  });

  it('wraps from the last tab to the first', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /expand panel/i }));

    screen.getByRole('tab', { name: /chokepoints/i }).focus();
    await user.keyboard('{ArrowLeft}');

    expect(screen.getByRole('tab', { name: /intel/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('returns to peek when the parent collapses it', () => {
    const { rerender } = setup();
    rerender(
      <MobileSheet
        chokepoints={chokepoints}
        collapsed
        // eslint-disable-next-line react/no-children-prop -- see setup() above
        children={{ prices: <div>PRICES BODY</div>, intel: <div>INTEL BODY</div> }}
      />,
    );
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'peek');
  });

  it('keeps the handle a 44px target with no overlay above the tabs', async () => {
    const user = userEvent.setup();
    setup();
    const handle = screen.getByRole('button', { name: /expand panel/i });
    expect(handle.className).toMatch(/h-11|min-h-\[44px\]/);
    expect(handle.className).not.toMatch(/absolute/);

    await user.click(handle);
    expect(screen.getByRole('tab', { name: /prices/i })).toBeInTheDocument();
  });
});
