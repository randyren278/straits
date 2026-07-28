# Fleet Page Tabs, Row Cap and Sort — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/fleet` accordion with a tab interface, cap rendered rows at 25 per tab, and make Vessel Name / Risk Score / Detected sortable — cutting the page from 3.3 screens (desktop) and 7.8 (mobile) down to roughly one.

**Architecture:** All work is client-side. `/api/anomalies` already returns every row in a single payload, so no API, SQL or server change is needed. A new `useTableView` hook owns sort and page state and returns a sorted, sliced view; a new `FleetTabs` component renders one responsive tablist (horizontal strip on desktop, 2-column grid on mobile); `AnomalyTable` loses its accordion and `SanctionedVessels` loses its always-on mounting, both becoming tab panels that gain sortable headers and a pager.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS v4, Vitest 4 + happy-dom + @testing-library/react, Playwright 1.61 for layout verification.

**Spec:** `docs/superpowers/specs/2026-07-27-fleet-tabs-design.md`

## Global Constraints

- Page size is **25 rows**, one constant, uniform across tabs and breakpoints.
- Default sort is **Risk Score descending**.
- **Nulls sort last in both directions** — a missing risk score means *unknown*, not *safe*.
- Sortable columns are **Vessel Name, Risk Score, Detected** only. Never Flag (empty for all 921 rows), never IMO, never Confidence.
- The Sanctioned tab has no Detected column; it sorts on Vessel Name and Risk Score only.
- Exactly **one** element on the page may carry `aria-selected="true"`. Render a single tablist with responsive CSS — never two DOM trees toggled by breakpoint.
- Bloomberg aesthetic: true black, amber accents, JetBrains Mono, **no border radius**. Red accent is reserved for the Sanctioned tab.
- Mobile touch targets are **≥44px**.
- `Confidence` is `'confirmed' | 'suspected' | 'unknown'` — there is no `'likely'`.
- Do not add `useSearchParams`, URL-persisted state, search/filter boxes, or server-side pagination. All were explicitly excluded.
- Tests are colocated as `src/**/*.test.ts(x)`. Run with `npx vitest run <path>`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/hooks/useTableView.ts` | create | Sort + page state; returns sorted, sliced rows. Pure logic, no JSX. |
| `src/lib/hooks/useTableView.test.ts` | create | Hook unit tests — sorting, null placement, paging, clamping. |
| `src/components/fleet/TablePager.tsx` | create | `‹ Prev · Showing 1–25 of 308 · Next ›` |
| `src/components/fleet/TablePager.test.tsx` | create | Pager tests. |
| `src/components/fleet/FleetTabs.tsx` | create | One responsive tablist + keyboard navigation. |
| `src/components/fleet/FleetTabs.test.tsx` | create | Tab a11y, selection, arrow keys. |
| `src/components/fleet/SortControls.tsx` | create | `SortableHeader` (desktop `<th>`) + `MobileSortBar` (`<select>`). Two consumers each. |
| `src/components/fleet/SortControls.test.tsx` | create | Sort control tests. |
| `src/components/fleet/AnomalyTable.tsx` | modify | Remove accordion; add sort + pager. |
| `src/components/fleet/SanctionedVessels.tsx` | modify | Remove always-on mounting; add sort + pager. |
| `src/app/(protected)/fleet/page.tsx` | modify | Own `activeTab`; render one panel; delete mobile summary strip. |
| `scripts/verify-fleet-layout.mjs` | create | Stage 1 Playwright measurement script. |

`SortControls.tsx` holds two small components rather than two files because they are the same concern (choosing a sort) rendered at two breakpoints, and they change together.

---

## Task 1: `useTableView` hook

**Files:**
- Create: `src/lib/hooks/useTableView.ts`
- Test: `src/lib/hooks/useTableView.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type SortDir = 'asc' | 'desc'`
  - `interface SortColumn<T> { key: string; label: string; defaultDir: SortDir; value: (row: T) => string | number | null }`
  - `interface TableView<T> { rows: T[]; page: number; pageCount: number; total: number; rangeStart: number; rangeEnd: number; sortKey: string; sortDir: SortDir; toggleSort(key: string): void; setPage(page: number): void }`
  - `function useTableView<T>(rows: T[], columns: SortColumn<T>[], options: { defaultSortKey: string; pageSize?: number }): TableView<T>`
  - `const DEFAULT_PAGE_SIZE = 25`

- [ ] **Step 1: Write the failing test**

Create `src/lib/hooks/useTableView.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/hooks/useTableView.test.ts`
Expected: FAIL — `Failed to resolve import "./useTableView"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/hooks/useTableView.ts`:

```ts
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
  const page = Math.min(requestedPage, pageCount);

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/hooks/useTableView.test.ts`
Expected: PASS — 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/useTableView.ts src/lib/hooks/useTableView.test.ts
git commit -m "feat(fleet): add useTableView hook for sorting and paging

Nulls sort last in both directions: a missing risk score is unknown,
not safe. Page index is clamped rather than stored so a shrinking row
set corrects itself on refetch."
```

---

## Task 2: `TablePager`

**Files:**
- Create: `src/components/fleet/TablePager.tsx`
- Test: `src/components/fleet/TablePager.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime (props are plain numbers).
- Produces: `function TablePager(props: { page: number; pageCount: number; rangeStart: number; rangeEnd: number; total: number; onPageChange: (page: number) => void; accent?: 'amber' | 'red' }): React.ReactElement | null`

- [ ] **Step 1: Write the failing test**

Create `src/components/fleet/TablePager.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/fleet/TablePager.test.tsx`
Expected: FAIL — `Failed to resolve import "./TablePager"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/fleet/TablePager.tsx`:

```tsx
/**
 * TablePager — prev/next paging control for the Fleet page tables.
 * Renders nothing when the rows fit on a single page.
 */
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePagerProps {
  page: number;
  pageCount: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPageChange: (page: number) => void;
  accent?: 'amber' | 'red';
}

export function TablePager({
  page,
  pageCount,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
  accent = 'amber',
}: TablePagerProps) {
  if (pageCount <= 1) return null;

  const accentText = accent === 'red' ? 'text-red-400' : 'text-amber-500';
  const accentBorder = accent === 'red' ? 'border-red-500/20' : 'border-amber-500/20';
  const button =
    `inline-flex items-center gap-1 min-h-[44px] lg:min-h-0 px-3 py-1.5 text-xs font-mono ` +
    `uppercase tracking-wider border transition-colors disabled:opacity-30 ` +
    `disabled:cursor-not-allowed ${accentText} ${accentBorder} hover:enabled:bg-white/5`;

  return (
    <div className={`flex items-center justify-center gap-4 border-t ${accentBorder} bg-gray-900/30 px-4 py-2`}>
      <button
        type="button"
        className={button}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Prev
      </button>

      <span className="text-xs font-mono uppercase tracking-wider text-gray-500" aria-live="polite">
        Showing {rangeStart}–{rangeEnd} of {total}
      </span>

      <button
        type="button"
        className={button}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/fleet/TablePager.test.tsx`
Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/fleet/TablePager.tsx src/components/fleet/TablePager.test.tsx
git commit -m "feat(fleet): add TablePager component"
```

---

## Task 3: `FleetTabs`

**Files:**
- Create: `src/components/fleet/FleetTabs.tsx`
- Test: `src/components/fleet/FleetTabs.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface FleetTab { id: string; label: string; count: number; accent?: 'amber' | 'red' }`
  - `function FleetTabs(props: { tabs: FleetTab[]; activeId: string; onChange: (id: string) => void }): React.ReactElement`
  - Each tab button carries `id={\`fleet-tab-${tab.id}\`}` and `aria-controls={\`fleet-panel-${tab.id}\`}`. The panel rendered by `page.tsx` must use the matching `id`/`aria-labelledby`.

**Critical:** render **one** tablist with responsive Tailwind classes (`grid grid-cols-2 lg:flex`). Two DOM trees toggled by breakpoint would put two `aria-selected="true"` nodes in the document and fail verification.

- [ ] **Step 1: Write the failing test**

Create `src/components/fleet/FleetTabs.test.tsx`:

```tsx
/**
 * FleetTabs component tests.
 * Validates tab semantics, single-selection invariant and keyboard navigation.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FleetTabs, type FleetTab } from './FleetTabs';

afterEach(() => cleanup());

const tabs: FleetTab[] = [
  { id: 'sanctioned', label: 'Sanctioned', count: 60, accent: 'red' },
  { id: 'loitering', label: 'Loitering', count: 308 },
  { id: 'speed', label: 'Speed Anomaly', count: 225 },
];

describe('FleetTabs', () => {
  it('renders one tablist containing every tab with its count', () => {
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={() => {}} />);

    expect(screen.getAllByRole('tablist')).toHaveLength(1);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /Loitering.*308/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Sanctioned.*60/ })).toBeInTheDocument();
  });

  it('marks exactly one tab selected', () => {
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={() => {}} />);

    const selected = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');

    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('Loitering');
  });

  it('links each tab to its panel via aria-controls', () => {
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={() => {}} />);

    const tab = screen.getByRole('tab', { name: /Loitering/ });

    expect(tab).toHaveAttribute('id', 'fleet-tab-loitering');
    expect(tab).toHaveAttribute('aria-controls', 'fleet-panel-loitering');
  });

  it('emits the clicked tab id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: /Speed Anomaly/ }));

    expect(onChange).toHaveBeenCalledWith('speed');
  });

  it('uses a roving tabindex so only the active tab is in the tab order', () => {
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={() => {}} />);

    expect(screen.getByRole('tab', { name: /Loitering/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: /Sanctioned/ })).toHaveAttribute('tabindex', '-1');
  });

  it('moves between tabs with the arrow keys and wraps at the ends', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={onChange} />);

    screen.getByRole('tab', { name: /Loitering/ }).focus();

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('speed');

    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('sanctioned');
  });

  it('jumps to the first and last tab with Home and End', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FleetTabs tabs={tabs} activeId="loitering" onChange={onChange} />);

    screen.getByRole('tab', { name: /Loitering/ }).focus();

    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenCalledWith('sanctioned');

    await user.keyboard('{End}');
    expect(onChange).toHaveBeenCalledWith('speed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/fleet/FleetTabs.test.tsx`
Expected: FAIL — `Failed to resolve import "./FleetTabs"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/fleet/FleetTabs.tsx`:

```tsx
/**
 * FleetTabs — category navigation for the Fleet page.
 *
 * One tablist, two layouts: a horizontal strip on desktop and a 2-column
 * grid on mobile, where eight tabs laid end to end (~760px) cannot fit a
 * 390px screen. Rendering a single DOM tree with responsive classes keeps
 * exactly one aria-selected node in the document.
 *
 * Holds no domain data — given labels and counts it renders a strip and
 * reports clicks.
 */
'use client';

import type { KeyboardEvent } from 'react';

export interface FleetTab {
  id: string;
  label: string;
  count: number;
  accent?: 'amber' | 'red';
}

interface FleetTabsProps {
  tabs: FleetTab[];
  activeId: string;
  onChange: (id: string) => void;
}

export function FleetTabs({ tabs, activeId, onChange }: FleetTabsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const current = tabs.findIndex((t) => t.id === activeId);
    if (current === -1) return;

    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;

    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].id);
  }

  return (
    <div
      role="tablist"
      aria-label="Fleet categories"
      onKeyDown={handleKeyDown}
      className="grid grid-cols-2 lg:flex lg:flex-wrap border border-amber-500/20 bg-gray-900/40"
      data-testid="fleet-tabs"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const red = tab.accent === 'red';

        const base =
          'flex items-center justify-between gap-2 min-h-[44px] lg:min-h-0 px-3 py-2 ' +
          'text-xs font-mono uppercase tracking-wider border-r border-b lg:border-b-0 ' +
          'border-amber-500/10 transition-colors text-left';

        const state = active
          ? red
            ? 'text-red-400 bg-red-500/10 shadow-[inset_0_-2px_0_0_rgb(248,113,113)]'
            : 'text-amber-500 bg-amber-500/10 shadow-[inset_0_-2px_0_0_rgb(245,158,11)]'
          : red
            ? 'text-red-400/70 hover:bg-red-500/5'
            : 'text-gray-500 hover:bg-amber-500/5';

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`fleet-tab-${tab.id}`}
            aria-controls={`fleet-panel-${tab.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`${base} ${state}`}
          >
            <span>{tab.label}</span>
            <span className={active ? '' : 'text-gray-400'}>{tab.count}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/fleet/FleetTabs.test.tsx`
Expected: PASS — 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/fleet/FleetTabs.tsx src/components/fleet/FleetTabs.test.tsx
git commit -m "feat(fleet): add FleetTabs category navigation

One responsive tablist: horizontal strip on desktop, 2-column grid on
mobile where 8 tabs cannot fit 390px. Single DOM tree keeps exactly one
aria-selected node."
```

---

## Task 4: Sort controls

**Files:**
- Create: `src/components/fleet/SortControls.tsx`
- Test: `src/components/fleet/SortControls.test.tsx`

**Interfaces:**
- Consumes: `SortDir`, `SortColumn` from `@/lib/hooks/useTableView` (Task 1).
- Produces:
  - `function SortableHeader(props: { column: SortColumn<never>; activeKey: string; dir: SortDir; onSort: (key: string) => void; accent?: 'amber' | 'red'; className?: string }): React.ReactElement` — renders a `<th>`.
  - `function MobileSortBar(props: { columns: SortColumn<never>[]; activeKey: string; dir: SortDir; onSort: (key: string) => void; accent?: 'amber' | 'red' }): React.ReactElement`

`SortColumn<never>` is used because these components only read `key`, `label` and `defaultDir` — never `value` — so the row type is irrelevant to them. Callers pass their `SortColumn<Anomaly>[]` directly; it is assignable.

**Note on `MobileSortBar`:** the Sanctioned tab renders a card list on phones with no headers to click, so mobile needs a control that is not a table header. A native `<select>` gets platform behaviour and accessibility for free. Its value encodes both key and direction as `` `${key}:${dir}` ``, and selecting an option calls `onSort` once (to set the column) and again (to flip direction) only when the requested direction differs from what `toggleSort` would produce.

- [ ] **Step 1: Write the failing test**

Create `src/components/fleet/SortControls.test.tsx`:

```tsx
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/fleet/SortControls.test.tsx`
Expected: FAIL — `Failed to resolve import "./SortControls"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/fleet/SortControls.tsx`:

```tsx
/**
 * Sort controls for the Fleet page tables.
 *
 * Two surfaces, one state: clickable column headers on desktop, and a
 * <select> on mobile — the Sanctioned tab renders a card list on phones
 * with no headers to click.
 */
'use client';

import type { SortColumn, SortDir } from '@/lib/hooks/useTableView';

interface SortableHeaderProps {
  column: SortColumn<never>;
  activeKey: string;
  dir: SortDir;
  onSort: (key: string) => void;
  accent?: 'amber' | 'red';
  className?: string;
}

export function SortableHeader({
  column,
  activeKey,
  dir,
  onSort,
  accent = 'amber',
  className = '',
}: SortableHeaderProps) {
  const active = column.key === activeKey;
  const accentText = accent === 'red' ? 'text-red-400/70' : 'text-amber-500';
  const indicator = active ? (dir === 'asc' ? '▲' : '▼') : '↕';

  return (
    <th
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-4 py-2 text-xs font-mono uppercase tracking-widest ${accentText} font-normal ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className="inline-flex items-center gap-1.5 uppercase tracking-widest hover:opacity-80 transition-opacity"
      >
        {column.label}
        <span className={active ? '' : 'opacity-40'} aria-hidden="true">
          {indicator}
        </span>
      </button>
    </th>
  );
}

interface MobileSortBarProps {
  columns: SortColumn<never>[];
  activeKey: string;
  dir: SortDir;
  onSort: (key: string) => void;
  accent?: 'amber' | 'red';
}

export function MobileSortBar({ columns, activeKey, dir, onSort, accent = 'amber' }: MobileSortBarProps) {
  const accentText = accent === 'red' ? 'text-red-400' : 'text-amber-500';
  const accentBorder = accent === 'red' ? 'border-red-500/30' : 'border-amber-500/30';

  function handleChange(value: string): void {
    const [key, wanted] = value.split(':') as [string, SortDir];
    const column = columns.find((c) => c.key === key);
    if (!column) return;

    // toggleSort on a new column applies that column's default direction;
    // on the active column it flips. Derive how many calls that needs.
    if (key !== activeKey) {
      onSort(key);
      if (wanted !== column.defaultDir) onSort(key);
      return;
    }
    if (wanted !== dir) onSort(key);
  }

  return (
    <div className={`lg:hidden flex items-center justify-end gap-2 border-b ${accentBorder} bg-gray-900/30 px-3 py-2`}>
      <label htmlFor="fleet-mobile-sort" className="text-xs font-mono uppercase tracking-wider text-gray-500">
        Sort
      </label>
      <select
        id="fleet-mobile-sort"
        value={`${activeKey}:${dir}`}
        onChange={(e) => handleChange(e.target.value)}
        className={`min-h-[44px] bg-black border ${accentBorder} ${accentText} px-2 py-1 text-xs font-mono uppercase tracking-wider`}
      >
        {columns.flatMap((column) => {
          const first = column.defaultDir;
          const second: SortDir = first === 'asc' ? 'desc' : 'asc';
          return [first, second].map((d) => (
            <option key={`${column.key}:${d}`} value={`${column.key}:${d}`}>
              {column.label} {d === 'asc' ? '▲' : '▼'}
            </option>
          ));
        })}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/fleet/SortControls.test.tsx`
Expected: PASS — 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/fleet/SortControls.tsx src/components/fleet/SortControls.test.tsx
git commit -m "feat(fleet): add sortable headers and mobile sort bar"
```

---

## Task 5: Rebuild `AnomalyTable` as a tab panel

**Files:**
- Modify: `src/components/fleet/AnomalyTable.tsx` (whole file rewritten)
- Test: `src/components/fleet/AnomalyTable.test.tsx` (create)

**Interfaces:**
- Consumes: `useTableView`, `SortColumn` (Task 1); `TablePager` (Task 2); `SortableHeader`, `MobileSortBar` (Task 4).
- Produces:
  - `const ANOMALY_SORT_COLUMNS: SortColumn<Anomaly>[]` — exported for reuse in tests.
  - `function AnomalyTable(props: { anomalyType: AnomalyType; anomalies: Anomaly[] }): React.ReactElement` — **unchanged props**, so `page.tsx` needs no prop changes for this component.

**Removed:** the section-header `<button>`, the `expanded` state, and the `ChevronDown` / `ChevronRight` imports. The tab now controls visibility, so an accordion inside it would mean two clicks to reach any data. `expandedImo` (the per-row dossier) is retained.

- [ ] **Step 1: Write the failing test**

Create `src/components/fleet/AnomalyTable.test.tsx`:

```tsx
/**
 * AnomalyTable tests.
 * Validates that the accordion is gone, rows are capped at 25, sorting
 * reorders (nulls last), and the per-row dossier still expands.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnomalyTable } from './AnomalyTable';
import type { Anomaly } from '@/types/anomaly';

afterEach(() => cleanup());

function makeAnomaly(i: number, overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: i,
    imo: String(9000000 + i),
    anomalyType: 'loitering',
    confidence: 'confirmed',
    detectedAt: new Date(2026, 0, 1 + (i % 28)),
    resolvedAt: null,
    details: { centroid: { lat: 25, lon: 55 }, radiusKm: 2, durationHours: 8 },
    vesselName: `VESSEL ${String(i).padStart(3, '0')}`,
    flag: 'PA',
    riskScore: i,
    ...overrides,
  };
}

const many = Array.from({ length: 40 }, (_, i) => makeAnomaly(i + 1));

describe('AnomalyTable', () => {
  it('renders rows immediately with no accordion to open', () => {
    render(<AnomalyTable anomalyType="loitering" anomalies={many} />);

    expect(screen.queryByRole('button', { name: /Loitering anomalies —/ })).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('caps rendered rows at 25', () => {
    render(<AnomalyTable anomalyType="loitering" anomalies={many} />);

    const body = screen.getByRole('table').querySelector('tbody') as HTMLElement;

    expect(within(body).getAllByRole('button', { name: /expand for intelligence dossier/ })).toHaveLength(25);
    expect(screen.getByText(/Showing 1–25 of 40/)).toBeInTheDocument();
  });

  it('sorts by risk descending by default', () => {
    render(<AnomalyTable anomalyType="loitering" anomalies={many} />);

    const first = screen.getByRole('table').querySelectorAll('tbody tr')[0];

    expect(first).toHaveTextContent('VESSEL 040');
  });

  it('places anomalies with no risk score last in both directions', async () => {
    const user = userEvent.setup();
    const rows = [
      makeAnomaly(1, { vesselName: 'HAS RISK', riskScore: 50 }),
      makeAnomaly(2, { vesselName: 'NO RISK', riskScore: undefined }),
      makeAnomaly(3, { vesselName: 'LOW RISK', riskScore: 5 }),
    ];
    render(<AnomalyTable anomalyType="loitering" anomalies={rows} />);

    const names = () =>
      Array.from(screen.getByRole('table').querySelectorAll('tbody tr[data-imo]')).map(
        (tr) => tr.textContent ?? '',
      );

    expect(names()[2]).toContain('NO RISK');

    await user.click(screen.getByRole('button', { name: /Risk Score/ }));

    expect(names()[0]).toContain('LOW RISK');
    expect(names()[2]).toContain('NO RISK');
  });

  it('pages forward and updates the visible rows', async () => {
    const user = userEvent.setup();
    render(<AnomalyTable anomalyType="loitering" anomalies={many} />);

    await user.click(screen.getByRole('button', { name: /next page/i }));

    expect(screen.getByText(/Showing 26–40 of 40/)).toBeInTheDocument();
    expect(screen.getByRole('table').querySelectorAll('tbody tr[data-imo]')).toHaveLength(15);
  });

  it('collapses an open dossier when the page changes', async () => {
    const user = userEvent.setup();
    render(<AnomalyTable anomalyType="loitering" anomalies={many} />);

    const row = screen.getAllByRole('button', { name: /expand for intelligence dossier/ })[0];
    await user.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: /next page/i }));

    const expanded = screen
      .getAllByRole('button', { name: /expand for intelligence dossier/ })
      .filter((el) => el.getAttribute('aria-expanded') === 'true');
    expect(expanded).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/fleet/AnomalyTable.test.tsx`
Expected: FAIL — the accordion button still exists and only 40 rows render unpaged.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/components/fleet/AnomalyTable.tsx`:

```tsx
/**
 * AnomalyTable — sortable, paged table of anomalies for a single anomaly type.
 * Rendered as the content of a Fleet page tab; the tab controls visibility,
 * so this component has no collapse of its own.
 * Requirements: M006-S01 (Fleet page grouped anomaly tables)
 */
'use client';

import React, { useEffect, useState } from 'react';
import { AnomalyBadge } from '@/components/ui/AnomalyBadge';
import { FleetVesselDetail } from '@/components/fleet/FleetVesselDetail';
import { TablePager } from '@/components/fleet/TablePager';
import { SortableHeader, MobileSortBar } from '@/components/fleet/SortControls';
import { useTableView, type SortColumn } from '@/lib/hooks/useTableView';
import type { Anomaly, AnomalyType } from '@/types/anomaly';

interface AnomalyTableProps {
  anomalyType: AnomalyType;
  anomalies: Anomaly[];
}

function toTime(value: Date | string): number | null {
  const t = (typeof value === 'string' ? new Date(value) : value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Sortable columns. Flag is excluded — it is empty for every row. */
export const ANOMALY_SORT_COLUMNS: SortColumn<Anomaly>[] = [
  { key: 'vesselName', label: 'Vessel Name', defaultDir: 'asc', value: (a) => a.vesselName ?? null },
  { key: 'riskScore', label: 'Risk Score', defaultDir: 'desc', value: (a) => a.riskScore ?? null },
  { key: 'detectedAt', label: 'Detected', defaultDir: 'desc', value: (a) => toTime(a.detectedAt) },
];

function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function AnomalyTable({ anomalyType, anomalies }: AnomalyTableProps) {
  const [expandedImo, setExpandedImo] = useState<string | null>(null);
  const view = useTableView(anomalies, ANOMALY_SORT_COLUMNS, { defaultSortKey: 'riskScore' });

  // An expanded row that survives a page or sort change points at a vessel
  // no longer in view.
  useEffect(() => {
    setExpandedImo(null);
  }, [view.page, view.sortKey, view.sortDir]);

  const [nameColumn, riskColumn, detectedColumn] = ANOMALY_SORT_COLUMNS;

  return (
    <div className="border border-amber-500/20 bg-black">
      <MobileSortBar
        columns={ANOMALY_SORT_COLUMNS as SortColumn<never>[]}
        activeKey={view.sortKey}
        dir={view.sortDir}
        onSort={view.toggleSort}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <SortableHeader
                column={nameColumn as SortColumn<never>}
                activeKey={view.sortKey}
                dir={view.sortDir}
                onSort={view.toggleSort}
              />
              <th className="max-lg:hidden px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                IMO
              </th>
              <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                Flag
              </th>
              <SortableHeader
                column={riskColumn as SortColumn<never>}
                activeKey={view.sortKey}
                dir={view.sortDir}
                onSort={view.toggleSort}
              />
              <th className="max-lg:hidden px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                Confidence
              </th>
              <SortableHeader
                column={detectedColumn as SortColumn<never>}
                activeKey={view.sortKey}
                dir={view.sortDir}
                onSort={view.toggleSort}
              />
            </tr>
          </thead>
          <tbody>
            {view.rows.map((anomaly) => (
              <React.Fragment key={anomaly.id}>
                <tr
                  className={`border-t border-amber-500/10 cursor-pointer transition-colors ${
                    expandedImo === anomaly.imo ? 'bg-amber-500/10' : 'hover:bg-amber-500/5'
                  }`}
                  data-imo={anomaly.imo}
                  data-anomaly-id={anomaly.id}
                  role="button"
                  aria-expanded={expandedImo === anomaly.imo}
                  aria-label={`${anomaly.vesselName || anomaly.imo}: expand for intelligence dossier`}
                  onClick={() => setExpandedImo((prev) => (prev === anomaly.imo ? null : anomaly.imo))}
                >
                  <td className="px-4 py-2 max-lg:py-3.5 text-sm font-mono text-gray-300">
                    {anomaly.vesselName || '—'}
                  </td>
                  <td className="max-lg:hidden px-4 py-2 text-sm font-mono text-gray-400">{anomaly.imo}</td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-400">{anomaly.flag || '—'}</td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-400">
                    {anomaly.riskScore != null ? (
                      <span
                        className={
                          anomaly.riskScore >= 70
                            ? 'text-red-400'
                            : anomaly.riskScore >= 40
                              ? 'text-amber-400'
                              : 'text-green-400'
                        }
                      >
                        {anomaly.riskScore}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="max-lg:hidden px-4 py-2">
                    <AnomalyBadge type={anomaly.anomalyType} confidence={anomaly.confidence} />
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-500">
                    {formatTimestamp(anomaly.detectedAt)}
                  </td>
                </tr>
                {expandedImo === anomaly.imo && (
                  <tr className="border-t border-amber-500/10">
                    <td colSpan={6} className="p-0">
                      <FleetVesselDetail
                        imo={anomaly.imo}
                        anomalyDetails={
                          anomaly.details as Parameters<typeof FleetVesselDetail>[0]['anomalyDetails']
                        }
                        anomalyType={anomalyType}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <TablePager
        page={view.page}
        pageCount={view.pageCount}
        rangeStart={view.rangeStart}
        rangeEnd={view.rangeEnd}
        total={view.total}
        onPageChange={view.setPage}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/fleet/AnomalyTable.test.tsx`
Expected: PASS — 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/fleet/AnomalyTable.tsx src/components/fleet/AnomalyTable.test.tsx
git commit -m "feat(fleet): rebuild AnomalyTable as a sortable, paged tab panel

Removes the accordion: the tab now controls visibility, so an inner
collapse would mean two clicks to reach any data. Caps rendering at 25
rows and collapses an open dossier on page or sort change."
```

---

## Task 6: Rebuild `SanctionedVessels` as a tab panel

**Files:**
- Modify: `src/components/fleet/SanctionedVessels.tsx`
- Test: `src/components/fleet/SanctionedVessels.test.tsx` (create)

**Interfaces:**
- Consumes: `useTableView`, `SortColumn` (Task 1); `TablePager` (Task 2); `SortableHeader`, `MobileSortBar` (Task 4).
- Produces:
  - `const SANCTIONED_SORT_COLUMNS: SortColumn<Anomaly>[]` — Vessel Name and Risk Score only; there is no Detected column on this tab.
  - `function SanctionedVessels(props: { vessels: Anomaly[] }): React.ReactElement | null` — **unchanged props**.

Keeps its own column shape (Sanction Category), its red accent, its `data-testid="sanctioned-vessels"`, both desktop table and mobile card list, and the `return null` on an empty list.

- [ ] **Step 1: Write the failing test**

Create `src/components/fleet/SanctionedVessels.test.tsx`:

```tsx
/**
 * SanctionedVessels tests.
 * Validates row capping, sorting limited to name and risk, and the
 * preserved empty-list behaviour.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SanctionedVessels } from './SanctionedVessels';
import type { Anomaly } from '@/types/anomaly';

afterEach(() => cleanup());

function makeVessel(i: number, overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: i,
    imo: String(9100000 + i),
    anomalyType: 'loitering',
    confidence: 'confirmed',
    detectedAt: new Date(2026, 0, 1),
    resolvedAt: null,
    details: { centroid: { lat: 25, lon: 55 }, radiusKm: 2, durationHours: 8 },
    vesselName: `SANCTIONED ${String(i).padStart(3, '0')}`,
    flag: 'PA',
    riskScore: i,
    isSanctioned: true,
    sanctionRiskCategory: 'sanction',
    ...overrides,
  };
}

const sixty = Array.from({ length: 60 }, (_, i) => makeVessel(i + 1));

describe('SanctionedVessels', () => {
  it('renders nothing when there are no sanctioned vessels', () => {
    const { container } = render(<SanctionedVessels vessels={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('caps the desktop table at 25 rows and reports the range', () => {
    render(<SanctionedVessels vessels={sixty} />);

    const body = screen.getByRole('table').querySelector('tbody') as HTMLElement;

    expect(body.querySelectorAll('tr[data-imo]')).toHaveLength(25);
    expect(screen.getByText(/Showing 1–25 of 60/)).toBeInTheDocument();
  });

  it('sorts by risk descending by default', () => {
    render(<SanctionedVessels vessels={sixty} />);

    const first = screen.getByRole('table').querySelectorAll('tbody tr[data-imo]')[0];

    expect(first).toHaveTextContent('SANCTIONED 060');
  });

  it('offers no Detected sort — this tab has no Detected column', () => {
    render(<SanctionedVessels vessels={sixty} />);

    expect(screen.queryByRole('button', { name: /Detected/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vessel Name/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Risk Score/ })).toBeInTheDocument();
  });

  it('sorts by vessel name when its header is clicked', async () => {
    const user = userEvent.setup();
    render(<SanctionedVessels vessels={sixty} />);

    await user.click(screen.getByRole('button', { name: /Vessel Name/ }));

    const first = screen.getByRole('table').querySelectorAll('tbody tr[data-imo]')[0];
    expect(first).toHaveTextContent('SANCTIONED 001');
  });

  it('keeps the sanctioned test id and header count', () => {
    render(<SanctionedVessels vessels={sixty} />);

    expect(screen.getByTestId('sanctioned-vessels')).toBeInTheDocument();
    expect(screen.getByText('[60]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/fleet/SanctionedVessels.test.tsx`
Expected: FAIL — all 60 rows render and no sort buttons exist.

- [ ] **Step 3: Write the implementation**

Apply these edits to `src/components/fleet/SanctionedVessels.tsx`.

Replace the import block and add the column definition after the `SanctionedVesselsProps` interface:

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { FleetVesselDetail } from '@/components/fleet/FleetVesselDetail';
import { TablePager } from '@/components/fleet/TablePager';
import { SortableHeader, MobileSortBar } from '@/components/fleet/SortControls';
import { useTableView, type SortColumn } from '@/lib/hooks/useTableView';
import type { Anomaly } from '@/types/anomaly';

interface SanctionedVesselsProps {
  vessels: Anomaly[];
}

/** This tab has no Detected column, so it sorts on name and risk only. */
export const SANCTIONED_SORT_COLUMNS: SortColumn<Anomaly>[] = [
  { key: 'vesselName', label: 'Vessel Name', defaultDir: 'asc', value: (v) => v.vesselName ?? null },
  { key: 'riskScore', label: 'Risk Score', defaultDir: 'desc', value: (v) => v.riskScore ?? null },
];
```

Replace the body of the component from the `useState` line down to the opening of the desktop table's `<thead>`:

```tsx
export function SanctionedVessels({ vessels }: SanctionedVesselsProps) {
  const [expandedImo, setExpandedImo] = useState<string | null>(null);
  const view = useTableView(vessels, SANCTIONED_SORT_COLUMNS, { defaultSortKey: 'riskScore' });

  useEffect(() => {
    setExpandedImo(null);
  }, [view.page, view.sortKey, view.sortDir]);

  const [nameColumn, riskColumn] = SANCTIONED_SORT_COLUMNS;

  if (vessels.length === 0) {
    return null;
  }

  return (
    <div className="border border-red-500/30 bg-black" data-testid="sanctioned-vessels">
      {/* Header bar */}
      <div className="flex items-center gap-3 bg-gray-900/50 px-4 py-3">
        <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-red-400 text-xs font-mono uppercase tracking-widest">SANCTIONED VESSELS</span>
        <span className="text-xs font-mono text-red-400/70">[{vessels.length}]</span>
      </div>

      <MobileSortBar
        columns={SANCTIONED_SORT_COLUMNS as SortColumn<never>[]}
        activeKey={view.sortKey}
        dir={view.sortDir}
        onSort={view.toggleSort}
        accent="red"
      />

      {/* Desktop table (lg+) — clips Sanction Category on phones, so mobile uses the card list below */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-t border-red-500/10">
              <SortableHeader
                column={nameColumn as SortColumn<never>}
                activeKey={view.sortKey}
                dir={view.sortDir}
                onSort={view.toggleSort}
                accent="red"
              />
              <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-red-400/70 font-normal">
                IMO
              </th>
              <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-red-400/70 font-normal">
                Flag
              </th>
              <SortableHeader
                column={riskColumn as SortColumn<never>}
                activeKey={view.sortKey}
                dir={view.sortDir}
                onSort={view.toggleSort}
                accent="red"
              />
              <th className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-red-400/70 font-normal">
                Sanction Category
              </th>
            </tr>
          </thead>
```

In **both** the desktop `<tbody>` map and the mobile card-list map, change the iterated collection from `vessels.map(` to `view.rows.map(`. Leave every row and card body unchanged.

Finally, insert the pager immediately before the component's closing `</div>`, after the mobile card list:

```tsx
      <TablePager
        page={view.page}
        pageCount={view.pageCount}
        rangeStart={view.rangeStart}
        rangeEnd={view.rangeEnd}
        total={view.total}
        onPageChange={view.setPage}
        accent="red"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/fleet/SanctionedVessels.test.tsx`
Expected: PASS — 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/fleet/SanctionedVessels.tsx src/components/fleet/SanctionedVessels.test.tsx
git commit -m "feat(fleet): make SanctionedVessels a sortable, paged tab panel

The 60-row block no longer mounts unconditionally above everything else."
```

---

## Task 7: Wire tabs into the Fleet page

**Files:**
- Modify: `src/app/(protected)/fleet/page.tsx`

**Interfaces:**
- Consumes: `FleetTabs`, `FleetTab` (Task 3); `AnomalyTable` (Task 5); `SanctionedVessels` (Task 6).
- Produces: the finished page. Panel elements carry `id={\`fleet-panel-${id}\`}`, `role="tabpanel"` and `aria-labelledby={\`fleet-tab-${id}\`}` to match the ids `FleetTabs` emits.

**Removed:** the mobile summary strip at lines 123–130 — the tab grid renders the same counts and makes them tappable.

**Key detail:** render the active panel with `key={activeTab}`. Remounting on tab change resets `expandedImo`, sort and page for free, which is exactly the required "change tab" transition.

- [ ] **Step 1: Write the failing test**

Create `src/app/(protected)/fleet/page.test.tsx`:

```tsx
/**
 * Fleet page tests.
 * Validates tab derivation from data, default tab selection, single-panel
 * rendering and removal of the mobile summary strip.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FleetPage from './page';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock('@/components/ui/Header', () => ({ Header: () => <header /> }));
vi.mock('@/components/fleet/FleetVesselDetail', () => ({ FleetVesselDetail: () => <div /> }));

function anomaly(id: number, type: string, sanctioned = false) {
  return {
    id,
    imo: String(9200000 + id),
    anomalyType: type,
    confidence: 'confirmed',
    detectedAt: '2026-01-05T00:00:00Z',
    resolvedAt: null,
    details: {},
    vesselName: `SHIP ${id}`,
    flag: 'PA',
    riskScore: id,
    isSanctioned: sanctioned,
    sanctionRiskCategory: sanctioned ? 'sanction' : null,
  };
}

const payload = {
  anomalies: [
    ...Array.from({ length: 5 }, (_, i) => anomaly(i + 1, 'loitering', i < 2)),
    ...Array.from({ length: 3 }, (_, i) => anomaly(i + 20, 'speed')),
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => payload })),
  );
});

describe('FleetPage', () => {
  it('derives one tab per category plus a sanctioned tab', async () => {
    render(<FleetPage />);

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    const labels = screen.getAllByRole('tab').map((t) => t.textContent ?? '');
    expect(labels[0]).toMatch(/Sanctioned/);
    expect(labels.some((l) => /Loitering/.test(l))).toBe(true);
    expect(labels.some((l) => /Speed Anomaly/.test(l))).toBe(true);
    expect(labels).toHaveLength(3);
  });

  it('selects the sanctioned tab by default', async () => {
    render(<FleetPage />);

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    const selected = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent(/Sanctioned/);
  });

  it('renders exactly one tabpanel at a time', async () => {
    const user = userEvent.setup();
    render(<FleetPage />);

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: /Loitering/ }));

    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.queryByTestId('sanctioned-vessels')).not.toBeInTheDocument();
  });

  it('labels the panel with its tab', async () => {
    render(<FleetPage />);

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'fleet-tab-sanctioned');
  });

  it('no longer renders the mobile summary strip', async () => {
    render(<FleetPage />);

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    expect(screen.queryByTestId('mobile-anomaly-summary')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(protected)/fleet/page.test.tsx"`
Expected: FAIL — no `tablist` role in the document.

- [ ] **Step 3: Write the implementation**

Replace `src/app/(protected)/fleet/page.tsx` in full:

```tsx
/**
 * Fleet Overview Page (M006-S01)
 *
 * Tabbed view of active anomalies: one tab per anomaly type plus a
 * sanctioned-vessels tab. One panel is mounted at a time and each caps
 * rendering at 25 rows, keeping the page near a single screen.
 * Terminal aesthetic: bg-black, amber accents, font-mono, no border-radius.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/ui/Header';
import { AnomalyTable } from '@/components/fleet/AnomalyTable';
import { SanctionedVessels } from '@/components/fleet/SanctionedVessels';
import { FleetTabs, type FleetTab } from '@/components/fleet/FleetTabs';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import type { Anomaly, AnomalyType } from '@/types/anomaly';
import { ANOMALY_TYPE_LABELS } from '@/types/anomaly';

const SANCTIONED_TAB_ID = 'sanctioned';

/** Group anomalies by type and sort groups by count descending */
function groupByType(anomalies: Anomaly[]): Array<{ type: AnomalyType; items: Anomaly[] }> {
  const groups = new Map<AnomalyType, Anomaly[]>();

  for (const anomaly of anomalies) {
    const existing = groups.get(anomaly.anomalyType);
    if (existing) {
      existing.push(anomaly);
    } else {
      groups.set(anomaly.anomalyType, [anomaly]);
    }
  }

  return Array.from(groups.entries())
    .map(([type, items]) => ({ type, items }))
    .sort((a, b) => b.items.length - a.items.length);
}

/** Deduplicate sanctioned vessels by IMO, keeping the highest risk score */
function dedupeSanctioned(anomalies: Anomaly[]): Anomaly[] {
  const byImo = new Map<string, Anomaly>();
  for (const a of anomalies.filter((x) => x.isSanctioned)) {
    const existing = byImo.get(a.imo);
    if (!existing || (a.riskScore ?? 0) > (existing.riskScore ?? 0)) {
      byImo.set(a.imo, a);
    }
  }
  return Array.from(byImo.values());
}

export default function FleetPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAnomalies() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/anomalies');
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `HTTP ${res.status}: Failed to fetch anomalies`);
        }
        const data: { anomalies: Anomaly[] } = await res.json();
        if (!cancelled) {
          setAnomalies(data.anomalies || []);
        }
      } catch (err) {
        console.error('Fleet page fetch error:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load fleet data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAnomalies();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupByType(anomalies), [anomalies]);
  const sanctionedVessels = useMemo(() => dedupeSanctioned(anomalies), [anomalies]);

  const tabs = useMemo<FleetTab[]>(() => {
    const list: FleetTab[] = [];
    if (sanctionedVessels.length > 0) {
      list.push({
        id: SANCTIONED_TAB_ID,
        label: 'Sanctioned',
        count: sanctionedVessels.length,
        accent: 'red',
      });
    }
    for (const { type, items } of groups) {
      list.push({ id: type, label: ANOMALY_TYPE_LABELS[type], count: items.length });
    }
    return list;
  }, [groups, sanctionedVessels]);

  // Pick a default once data lands, and recover if the active tab disappears.
  useEffect(() => {
    if (tabs.length === 0) return;
    if (activeTab && tabs.some((t) => t.id === activeTab)) return;
    setActiveTab(tabs[0].id);
  }, [tabs, activeTab]);

  const activeGroup = groups.find((g) => g.type === activeTab);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <main className="p-6 max-w-7xl mx-auto max-lg:p-3">
        {/* Page title */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500">FLEET OVERVIEW</h1>
            {!loading && !error && (
              <p className="text-xs text-gray-600 mt-0.5 font-mono">
                {anomalies.length} active anomalies across {groups.length} categories
              </p>
            )}
          </div>
          {/* Export current fleet snapshot for offline analysis */}
          <div className="flex gap-2 shrink-0">
            <a
              href="/api/export?format=csv"
              className="inline-flex items-center max-lg:min-h-[44px] px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition-colors"
            >
              Export CSV
            </a>
            <a
              href="/api/export?format=json"
              className="inline-flex items-center max-lg:min-h-[44px] px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-gray-600/50 text-gray-400 hover:bg-gray-800/50 transition-colors"
            >
              JSON
            </a>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <p className="text-amber-500 font-mono text-sm uppercase tracking-widest animate-pulse">
              LOADING FLEET DATA...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 border border-red-500/50 bg-red-900/10">
            <p className="text-red-400 font-mono text-sm">ERROR: {error}</p>
            <p className="text-gray-500 font-mono text-xs mt-2">
              Check network connection and try refreshing the page.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && anomalies.length === 0 && (
          <div className="flex items-center justify-center h-64 border border-amber-500/10 bg-gray-900/30">
            <p className="text-gray-500 font-mono text-sm uppercase tracking-widest">
              NO ACTIVE ANOMALIES DETECTED
            </p>
          </div>
        )}

        {/* Tabbed panels */}
        {!loading && !error && anomalies.length > 0 && activeTab && (
          <ErrorBoundary>
            <FleetTabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />

            <div
              role="tabpanel"
              id={`fleet-panel-${activeTab}`}
              aria-labelledby={`fleet-tab-${activeTab}`}
              className="mt-4"
            >
              {/* key remounts the panel on tab change, resetting sort, page and any open dossier */}
              {activeTab === SANCTIONED_TAB_ID ? (
                <SanctionedVessels key={activeTab} vessels={sanctionedVessels} />
              ) : activeGroup ? (
                <AnomalyTable key={activeTab} anomalyType={activeGroup.type} anomalies={activeGroup.items} />
              ) : null}
            </div>
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(protected)/fleet/page.test.tsx"`
Expected: PASS — 5 passed.

- [ ] **Step 5: Run the whole suite and the linter**

Run: `npx vitest run && npm run lint`
Expected: all tests pass; lint reports no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(protected)/fleet/page.tsx" "src/app/(protected)/fleet/page.test.tsx"
git commit -m "feat(fleet): replace accordion layout with tabs

Tabs are derived from the data, so an empty category produces no tab.
One panel mounts at a time, keyed by tab id so switching resets sort,
page and any open dossier. Deletes the mobile summary strip, now
superseded by the tappable tab grid."
```

---

## Task 8: Stage 1 — Playwright measurement script

**Files:**
- Create: `scripts/verify-fleet-layout.mjs`
- Modify: `package.json` (add the `verify:fleet` script)

**Interfaces:**
- Consumes: the running app from Task 7.
- Produces: `npm run verify:fleet` — exits 0 on pass, 1 on any failed assertion, printing each check with its measured number.

Screenshot review alone is insufficient here: a prior audit of this project missed four user-visible defects precisely because screenshots cannot show content below the fold or state that only exists after interaction. Every check below asserts a number.

- [ ] **Step 1: Write the verification script**

Create `scripts/verify-fleet-layout.mjs`:

```js
/**
 * Stage 1 fleet layout verification.
 *
 * Asserts the measured claims from the design spec against a running dev
 * server. Screenshots cannot show below-the-fold content or post-interaction
 * state, so every check here is a number.
 *
 * Usage: npm run verify:fleet   (requires `npm run dev` on :3000)
 */
import { chromium } from 'playwright';

const BASE = process.env.FLEET_URL ?? 'http://localhost:3000/fleet';
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const PAGE_SIZE = 25;

const results = [];

function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

async function tabIds(page) {
  return page.$$eval('[role="tab"]', (els) => els.map((e) => e.id.replace('fleet-tab-', '')));
}

async function openTab(page, id) {
  await page.click(`#fleet-tab-${id}`);
  await page.waitForTimeout(250);
}

async function metrics(page) {
  return page.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    viewH: window.innerHeight,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    rows: document.querySelectorAll('[role="tabpanel"] tbody tr[data-imo]').length,
    cards: document.querySelectorAll('[role="tabpanel"] .lg\\:hidden button[data-imo]').length,
    selected: document.querySelectorAll('[aria-selected="true"]').length,
  }));
}

async function run() {
  const browser = await chromium.launch();

  for (const [label, viewport] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
    const page = await browser.newPage({ viewport });
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('[role="tablist"]', { timeout: 30000 });

    const ids = await tabIds(page);
    check(`${label}: tabs exist`, ids.length > 0, `${ids.length} tabs: ${ids.join(', ')}`);

    for (const id of ids) {
      await openTab(page, id);
      const m = await metrics(page);
      const screens = +(m.scrollH / m.viewH).toFixed(2);

      // The Sanctioned tab renders a taller card list on mobile — see the
      // page-size trade-off in the design spec.
      const limit =
        label === 'desktop' ? 1.5 : id === 'sanctioned' ? 3.5 : 2.2;

      check(`${label}/${id}: height`, screens <= limit, `${screens} screens (limit ${limit})`);
      check(`${label}/${id}: no horizontal overflow`, m.overflow === 0, `${m.overflow}px`);
      check(
        `${label}/${id}: rows capped`,
        m.rows <= PAGE_SIZE && m.cards <= PAGE_SIZE,
        `${m.rows} table rows, ${m.cards} cards (cap ${PAGE_SIZE})`,
      );
      check(`${label}/${id}: single selected tab`, m.selected === 1, `${m.selected} aria-selected`);
    }

    if (label === 'mobile') {
      const heights = await page.$$eval('[role="tab"]', (els) =>
        els.map((e) => Math.round(e.getBoundingClientRect().height)),
      );
      const min = Math.min(...heights);
      check('mobile: tab touch targets', min >= 44, `smallest tab ${min}px`);
    }

    await page.close();
  }

  // Interaction checks on desktop.
  const page = await browser.newPage({ viewport: DESKTOP });
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('[role="tablist"]', { timeout: 30000 });

  const ids = await tabIds(page);
  const busiest = ids.find((i) => i !== 'sanctioned') ?? ids[0];
  await openTab(page, busiest);

  const risks = () =>
    page.$$eval('[role="tabpanel"] tbody tr[data-imo]', (rows) =>
      rows.map((r) => {
        const cell = r.querySelectorAll('td')[3];
        const text = cell?.textContent?.trim() ?? '';
        return text === '—' ? null : Number(text);
      }),
    );

  const desc = await risks();
  const descOk = desc.filter((v) => v !== null).every((v, i, a) => i === 0 || a[i - 1] >= v);
  check('sort: default is risk descending', descOk, `first values ${desc.slice(0, 5).join(', ')}`);

  const nullsLastDesc = desc.every((v, i) => v !== null || desc.slice(i).every((x) => x === null));
  check('sort: nulls last when descending', nullsLastDesc, `${desc.filter((v) => v === null).length} nulls`);

  await page.click('[role="tabpanel"] th button:has-text("Risk Score")');
  await page.waitForTimeout(250);

  const asc = await risks();
  const ascOk = asc.filter((v) => v !== null).every((v, i, a) => i === 0 || a[i - 1] <= v);
  check('sort: click reverses to ascending', ascOk, `first values ${asc.slice(0, 5).join(', ')}`);

  const nullsLastAsc = asc.every((v, i) => v !== null || asc.slice(i).every((x) => x === null));
  check('sort: nulls last when ascending', nullsLastAsc, `${asc.filter((v) => v === null).length} nulls`);

  check('sort: order actually changed', JSON.stringify(desc) !== JSON.stringify(asc), 'desc !== asc');

  // Paging changes the rendered set and the label.
  const before = await page.$$eval('[role="tabpanel"] tbody tr[data-imo]', (r) =>
    r.map((x) => x.getAttribute('data-imo')),
  );
  const label = await page.textContent('[role="tabpanel"] [aria-live="polite"]');
  await page.click('[aria-label="Next page"]');
  await page.waitForTimeout(250);
  const after = await page.$$eval('[role="tabpanel"] tbody tr[data-imo]', (r) =>
    r.map((x) => x.getAttribute('data-imo')),
  );
  const labelAfter = await page.textContent('[role="tabpanel"] [aria-live="polite"]');

  check('paging: row set changes', JSON.stringify(before) !== JSON.stringify(after), `${before.length} → ${after.length}`);
  check('paging: range label updates', label !== labelAfter, `"${label?.trim()}" → "${labelAfter?.trim()}"`);

  // Dossier still opens.
  await page.click('[role="tabpanel"] tbody tr[data-imo]');
  await page.waitForTimeout(400);
  const expanded = await page.$$eval('[role="tabpanel"] tr[aria-expanded="true"]', (e) => e.length);
  check('dossier: row expands', expanded === 1, `${expanded} expanded rows`);

  await page.close();
  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `"scripts"` after the `"lint"` entry:

```json
    "verify:fleet": "node scripts/verify-fleet-layout.mjs",
```

- [ ] **Step 3: Start the dev server**

Run in a separate shell: `npm run dev`
Wait for `Ready` and confirm `http://localhost:3000/fleet` loads with data.

- [ ] **Step 4: Run the verification**

Run: `npm run verify:fleet`
Expected: every line prints `PASS`, final line reads `N/N checks passed`, exit code 0.

If any check fails, fix the component — **do not relax the threshold**. The thresholds come from the approved spec.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-fleet-layout.mjs package.json
git commit -m "test(fleet): add Playwright layout verification

Asserts scroll height, overflow, row caps, touch targets, sort ordering
with nulls last, paging and dossier expansion. Numbers, not screenshots."
```

---

## Task 9: Stage 2 — review council

**Files:** none created; this task produces findings and any resulting fixes.

**Interfaces:**
- Consumes: the running app and a passing `npm run verify:fleet` from Task 8.

**Prerequisite:** Task 8 must be green. The council reviews a page that already passes its own measurements.

- [ ] **Step 1: Confirm the dev server is running and Stage 1 passes**

Run: `npm run verify:fleet`
Expected: `N/N checks passed`.

- [ ] **Step 2: Dispatch three reviewer agents in parallel**

Dispatch three agents with `run_in_background: false` so their results arrive before proceeding. Each drives Playwright against `http://localhost:3000/fleet` independently. Give each this shared preamble plus its own brief:

> You are reviewing the Fleet page of a maritime intelligence dashboard at http://localhost:3000/fleet. Playwright is installed in the project — write a script under the scratchpad directory, run it with `node` from the project root so `playwright` resolves, and drive the real page. Every finding you report MUST include a reproducible assertion and a measured number. Findings expressed as impressions, preferences or "this feels…" will be discarded. If you find nothing, say so plainly — do not invent findings. Read `docs/superpowers/specs/2026-07-27-fleet-tabs-design.md` first; it is the contract.

1. **Layout reviewer** — measure `scrollHeight / innerHeight` and `scrollWidth - innerWidth` for **every** tab at 1440×900, 1024×768 and 390×844. Report any tab exceeding 1.5 screens on desktop, 2.2 on mobile (3.5 for Sanctioned). Check that no element is clipped and that the tab strip does not wrap oddly at the `lg` breakpoint boundary.
2. **Interaction reviewer** — verify the state-transition table: changing tab resets page to 1, sort to Risk descending, and closes any open dossier; changing sort resets page to 1 and closes the dossier; changing page closes the dossier. Verify sorting on all three columns in both directions places nulls last. Verify the pager disables Prev on page 1 and Next on the last page, and that the range label matches the rendered row count.
3. **Accessibility reviewer** — verify exactly one `aria-selected="true"` exists at all times; `role="tablist"`/`tab"`/`tabpanel"` wiring and that `aria-controls` resolves to the rendered panel id; roving tabindex; ←/→/Home/End keyboard navigation; `aria-sort` on sortable headers reflecting the active column; every interactive element ≥44px tall at 390px width.

- [ ] **Step 3: Triage the findings**

Discard any finding without a measurement. For each surviving finding, decide: fix now, or record as out of scope. The Flag column rendering `—` for all rows is **known and out of scope** — expect at least one reviewer to raise it, and dismiss it.

- [ ] **Step 4: Fix confirmed defects**

For each confirmed defect, add a failing test at the appropriate level (hook test, component test, or a new assertion in `scripts/verify-fleet-layout.mjs`), make it pass, and commit separately.

- [ ] **Step 5: Re-run everything**

Run: `npx vitest run && npm run lint && npm run verify:fleet`
Expected: all unit tests pass, lint clean, all layout checks pass.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(fleet): address review council findings"
```

---

## Task 10: Final verification against the original problem

**Files:** none.

- [ ] **Step 1: Measure the finished page and compare to the baseline**

Run: `npm run verify:fleet`

Confirm against the spec's baseline table:

| Metric | Before | Target |
|---|---|---|
| Desktop, at rest | 3.3 screens | ≤ 1.5 |
| Mobile, at rest | 7.8 screens | ≤ 2.2 (Sanctioned ≤ 3.5) |
| One category open, desktop | 17.3 screens | ≤ 1.5 |
| One category open, mobile | 36 screens | ≤ 2.2 |
| Navigation position | y=2455, below fold | above the fold |

- [ ] **Step 2: Confirm the full suite is green**

Run: `npx vitest run && npm run lint`
Expected: all tests pass, no lint errors.

- [ ] **Step 3: Report honestly**

State the measured numbers. If any target was missed, say which and by how much — do not round a miss into a pass.
