/**
 * TablePager component tests.
 * Validates range labelling, edge-button disabling and the null render
 * for single-page row sets.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TablePager } from './TablePager';

afterEach(() => cleanup());

describe('TablePager', () => {
  it('renders nothing when everything fits on one page', () => {
    const { container } = render(
      <TablePager page={1} pageCount={1} rangeStart={1} rangeEnd={8} total={8} onPageChange={() => {}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the visible range and total', () => {
    render(
      <TablePager page={1} pageCount={13} rangeStart={1} rangeEnd={25} total={308} onPageChange={() => {}} />,
    );

    expect(screen.getByText(/Showing 1–25 of 308/)).toBeInTheDocument();
  });

  it('disables Prev on the first page and Next on the last', () => {
    const { rerender } = render(
      <TablePager page={1} pageCount={13} rangeStart={1} rangeEnd={25} total={308} onPageChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).toBeEnabled();

    rerender(
      <TablePager page={13} pageCount={13} rangeStart={301} rangeEnd={308} total={308} onPageChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /previous page/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('emits the next and previous page numbers', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <TablePager page={5} pageCount={13} rangeStart={101} rangeEnd={125} total={308} onPageChange={onPageChange} />,
    );

    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(6);

    await user.click(screen.getByRole('button', { name: /previous page/i }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
});
