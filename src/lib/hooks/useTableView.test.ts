/**
 * useTableView hook tests.
 * Validates sorting (including null placement), paging and page clamping
 * for the Fleet page tables.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useTableView, DEFAULT_PAGE_SIZE, type SortColumn } from './useTableView';

afterEach(() => cleanup());

interface Row {
  name: string | null;
  risk: number | null;
}

const columns: SortColumn<Row>[] = [
  { key: 'name', label: 'Name', defaultDir: 'asc', value: (r) => r.name },
  { key: 'risk', label: 'Risk', defaultDir: 'desc', value: (r) => r.risk },
];

const rows: Row[] = [
  { name: 'BRAVO', risk: 40 },
  { name: 'ALPHA', risk: 90 },
  { name: 'CHARLIE', risk: null },
  { name: null, risk: 10 },
];

describe('useTableView', () => {
  it('defaults to the requested sort key and its column default direction', () => {
    const { result } = renderHook(() => useTableView(rows, columns, { defaultSortKey: 'risk' }));

    expect(result.current.sortKey).toBe('risk');
    expect(result.current.sortDir).toBe('desc');
    expect(result.current.rows.map((r) => r.risk)).toEqual([90, 40, 10, null]);
  });

  it('places nulls last when sorting ascending, not first', () => {
    const { result } = renderHook(() => useTableView(rows, columns, { defaultSortKey: 'risk' }));

    act(() => result.current.toggleSort('risk'));

    expect(result.current.sortDir).toBe('asc');
    expect(result.current.rows.map((r) => r.risk)).toEqual([10, 40, 90, null]);
  });

  it('places null names last when sorting by name', () => {
    const { result } = renderHook(() => useTableView(rows, columns, { defaultSortKey: 'name' }));

    expect(result.current.rows.map((r) => r.name)).toEqual(['ALPHA', 'BRAVO', 'CHARLIE', null]);
  });

  it('switching column uses that column default direction and resets to page 1', () => {
    const many: Row[] = Array.from({ length: 60 }, (_, i) => ({ name: `V${i}`, risk: i }));
    const { result } = renderHook(() => useTableView(many, columns, { defaultSortKey: 'risk' }));

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    act(() => result.current.toggleSort('name'));

    expect(result.current.sortKey).toBe('name');
    expect(result.current.sortDir).toBe('asc');
    expect(result.current.page).toBe(1);
  });

  it('applies two consecutive toggles in one batch — switch column then flip', () => {
    // MobileSortBar calls toggleSort twice synchronously to reach a
    // non-default direction on a new column. Both calls must see the
    // result of the previous one.
    const { result } = renderHook(() => useTableView(rows, columns, { defaultSortKey: 'risk' }));

    act(() => {
      result.current.toggleSort('name');
      result.current.toggleSort('name');
    });

    expect(result.current.sortKey).toBe('name');
    expect(result.current.sortDir).toBe('desc');
    expect(result.current.rows.map((r) => r.name)).toEqual(['CHARLIE', 'BRAVO', 'ALPHA', null]);
  });

  it('caps rendered rows at the page size and reports the range', () => {
    const many: Row[] = Array.from({ length: 308 }, (_, i) => ({ name: `V${i}`, risk: i }));
    const { result } = renderHook(() => useTableView(many, columns, { defaultSortKey: 'risk' }));

    expect(DEFAULT_PAGE_SIZE).toBe(25);
    expect(result.current.rows).toHaveLength(25);
    expect(result.current.total).toBe(308);
    expect(result.current.pageCount).toBe(13);
    expect(result.current.rangeStart).toBe(1);
    expect(result.current.rangeEnd).toBe(25);

    act(() => result.current.setPage(13));

    expect(result.current.rows).toHaveLength(8);
    expect(result.current.rangeStart).toBe(301);
    expect(result.current.rangeEnd).toBe(308);
  });

  it('clamps the page when the row set shrinks beneath the current page', () => {
    const many: Row[] = Array.from({ length: 100 }, (_, i) => ({ name: `V${i}`, risk: i }));
    const { result, rerender } = renderHook(
      ({ data }) => useTableView(data, columns, { defaultSortKey: 'risk' }),
      { initialProps: { data: many } },
    );

    act(() => result.current.setPage(4));
    expect(result.current.page).toBe(4);

    rerender({ data: many.slice(0, 30) });

    expect(result.current.page).toBe(2);
    expect(result.current.pageCount).toBe(2);
  });

  it('reports an empty range for an empty row set without crashing', () => {
    const { result } = renderHook(() => useTableView([] as Row[], columns, { defaultSortKey: 'risk' }));

    expect(result.current.rows).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.pageCount).toBe(1);
    expect(result.current.rangeStart).toBe(0);
    expect(result.current.rangeEnd).toBe(0);
  });

  it('clamps negative and zero page values to 1 and reports sane ranges', () => {
    const { result } = renderHook(() => useTableView(rows, columns, { defaultSortKey: 'risk' }));

    act(() => result.current.setPage(0));
    expect(result.current.page).toBe(1);
    expect(result.current.rangeStart).toBe(1);
    expect(result.current.rangeEnd).toBeGreaterThan(0);

    act(() => result.current.setPage(-5));
    expect(result.current.page).toBe(1);
    expect(result.current.rangeStart).toBe(1);
    expect(result.current.rangeEnd).toBeGreaterThan(0);
  });
});
