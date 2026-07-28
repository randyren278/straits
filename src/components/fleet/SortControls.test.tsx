/**
 * Sort control tests — desktop sortable headers and the mobile select bar.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SortableHeader, MobileSortBar } from './SortControls';
import type { SortColumn } from '@/lib/hooks/useTableView';

afterEach(() => cleanup());

const riskColumn: SortColumn<never> = {
  key: 'riskScore',
  label: 'Risk Score',
  defaultDir: 'desc',
  value: () => null,
};

const nameColumn: SortColumn<never> = {
  key: 'vesselName',
  label: 'Vessel Name',
  defaultDir: 'asc',
  value: () => null,
};

function renderHeader(activeKey: string, dir: 'asc' | 'desc', onSort = vi.fn()) {
  render(
    <table>
      <thead>
        <tr>
          <SortableHeader column={riskColumn} activeKey={activeKey} dir={dir} onSort={onSort} />
        </tr>
      </thead>
    </table>,
  );
  return onSort;
}

describe('SortableHeader', () => {
  it('exposes aria-sort descending when it is the active column', () => {
    renderHeader('riskScore', 'desc');

    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
  });

  it('exposes aria-sort none when another column is active', () => {
    renderHeader('vesselName', 'asc');

    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none');
  });

  it('emits its column key when clicked', async () => {
    const user = userEvent.setup();
    const onSort = renderHeader('vesselName', 'asc');

    await user.click(screen.getByRole('button', { name: /Risk Score/ }));

    expect(onSort).toHaveBeenCalledWith('riskScore');
  });
});

describe('MobileSortBar', () => {
  it('offers both directions for every column', () => {
    render(
      <MobileSortBar
        columns={[nameColumn, riskColumn]}
        activeKey="riskScore"
        dir="desc"
        onSort={() => {}}
      />,
    );

    const select = screen.getByRole('combobox', { name: /sort/i });
    const values = Array.from(select.querySelectorAll('option')).map((o) => o.getAttribute('value'));

    expect(values).toEqual(['vesselName:asc', 'vesselName:desc', 'riskScore:desc', 'riskScore:asc']);
  });

  it('reflects the active sort as its value', () => {
    render(
      <MobileSortBar columns={[nameColumn, riskColumn]} activeKey="riskScore" dir="desc" onSort={() => {}} />,
    );

    expect(screen.getByRole('combobox', { name: /sort/i })).toHaveValue('riskScore:desc');
  });

  it('switches column with a single onSort call when the default direction is wanted', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <MobileSortBar columns={[nameColumn, riskColumn]} activeKey="riskScore" dir="desc" onSort={onSort} />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'vesselName:asc');

    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onSort).toHaveBeenNthCalledWith(1, 'vesselName');
  });

  it('switches column then flips when the non-default direction is wanted', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <MobileSortBar columns={[nameColumn, riskColumn]} activeKey="riskScore" dir="desc" onSort={onSort} />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'vesselName:desc');

    expect(onSort).toHaveBeenCalledTimes(2);
    expect(onSort).toHaveBeenNthCalledWith(1, 'vesselName');
    expect(onSort).toHaveBeenNthCalledWith(2, 'vesselName');
  });

  it('flips direction on the active column with one call', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <MobileSortBar columns={[nameColumn, riskColumn]} activeKey="riskScore" dir="desc" onSort={onSort} />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'riskScore:asc');

    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onSort).toHaveBeenNthCalledWith(1, 'riskScore');
  });

  it('generates unique ids for each instance', () => {
    render(
      <div>
        <MobileSortBar columns={[nameColumn, riskColumn]} activeKey="riskScore" dir="desc" onSort={() => {}} />
        <MobileSortBar columns={[nameColumn, riskColumn]} activeKey="vesselName" dir="asc" onSort={() => {}} />
      </div>,
    );

    const comboboxes = screen.getAllByRole('combobox', { name: /sort/i });
    expect(comboboxes).toHaveLength(2);

    const id1 = comboboxes[0].getAttribute('id');
    const id2 = comboboxes[1].getAttribute('id');

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toEqual(id2);
  });
});
