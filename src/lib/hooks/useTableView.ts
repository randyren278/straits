/**
 * useTableView — sort and page state for the Fleet page tables.
 *
 * Sorting rule that matters: null values always sort last, in BOTH directions.
 * A missing risk score means "unknown", not "safe", so it must never head the
 * descending list nor the ascending one.
 *
 * Paging is client-side; /api/anomalies returns every row in one payload.
 */
import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

export const DEFAULT_PAGE_SIZE = 25;

export interface SortColumn<T> {
  key: string;
  label: string;
  /** Direction applied when this column first becomes the sort column */
  defaultDir: SortDir;
  /** Sort value; return null for missing data so it sorts last */
  value: (row: T) => string | number | null;
}

export interface TableView<T> {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  /** 1-indexed inclusive; 0 when there are no rows */
  rangeStart: number;
  rangeEnd: number;
  sortKey: string;
  sortDir: SortDir;
  toggleSort: (key: string) => void;
  setPage: (page: number) => void;
}

function isMissing(v: string | number | null): boolean {
  return v === null || v === undefined || v === '';
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export function useTableView<T>(
  rows: T[],
  columns: SortColumn<T>[],
  options: { defaultSortKey: string; pageSize?: number },
): TableView<T> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const defaultColumn = columns.find((c) => c.key === options.defaultSortKey) ?? columns[0];

  // Key and direction live in ONE state object on purpose. Held separately,
  // two toggleSort calls inside a single event handler would both read the
  // stale sortKey from closure and neither would flip direction — which is
  // exactly what MobileSortBar does when it switches column and direction
  // at once.
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({
    key: defaultColumn.key,
    dir: defaultColumn.defaultDir,
  });
  const [requestedPage, setRequestedPage] = useState<number>(1);

  const { key: sortKey, dir: sortDir } = sort;

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sortKey);
    if (!column) return rows;

    return [...rows].sort((rowA, rowB) => {
      const a = column.value(rowA);
      const b = column.value(rowB);
      const aMissing = isMissing(a);
      const bMissing = isMissing(b);

      // Missing values sort last regardless of direction — applied before
      // the direction flip so descending cannot pull them to the top.
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;

      const result = compare(a as string | number, b as string | number);
      return sortDir === 'asc' ? result : -result;
    });
  }, [rows, columns, sortKey, sortDir]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Clamp rather than store, so a shrinking row set corrects itself.
  const page = Math.max(1, Math.min(requestedPage, pageCount));

  const pageRows = useMemo(
    () => sorted.slice((page - 1) * pageSize, page * pageSize),
    [sorted, page, pageSize],
  );

  function toggleSort(key: string): void {
    // Functional update so consecutive calls in one handler each see the
    // result of the previous call, not the stale render value.
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      const column = columns.find((c) => c.key === key);
      return { key, dir: column?.defaultDir ?? 'asc' };
    });
    setRequestedPage(1);
  }

  return {
    rows: pageRows,
    page,
    pageCount,
    total,
    rangeStart: total === 0 ? 0 : (page - 1) * pageSize + 1,
    rangeEnd: Math.min(page * pageSize, total),
    sortKey,
    sortDir,
    toggleSort,
    setPage: setRequestedPage,
  };
}
