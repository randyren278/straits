---
estimated_steps: 5
estimated_files: 3
---

# T02: Build AnomalyMatrix component with tests and wire into FleetPage

**Slice:** S02 — The Anomaly Matrix Visualizer
**Milestone:** M007

## Description

Create the `AnomalyMatrix` component — a dense, terminal-style heatmap grid showing anomaly counts at the intersection of Ship Type (rows) × Anomaly Type (columns) with amber brightness scaling. Write comprehensive tests. Wire the component into `FleetPage` between `<SanctionedVessels>` and the anomaly group tables.

**Load skill:** `react-best-practices` — this is a React component with non-trivial rendering logic and test coverage.

## Steps

1. **Create `src/components/fleet/AnomalyMatrix.tsx`:**
   - Import `Anomaly`, `AnomalyType`, `ShipCategory`, `ANOMALY_TYPE_LABELS` from `@/types/anomaly`.
   - Props: `{ anomalies: Anomaly[] }`. Return `null` if `anomalies.length === 0`.
   - Define column order: `const COLUMN_ORDER: AnomalyType[] = ['going_dark', 'loitering', 'deviation', 'speed', 'repeat_going_dark', 'sts_transfer']`.
   - Define abbreviated column headers: `const SHORT_LABELS: Record<AnomalyType, string> = { going_dark: 'DARK', loitering: 'LOITER', deviation: 'ROUTE', speed: 'DRIFT', repeat_going_dark: 'REPEAT', sts_transfer: 'STS' }`.
   - Define row order: `const ROW_ORDER: ShipCategory[] = ['tanker', 'cargo', 'other']` with display labels `{ tanker: 'TANKER', cargo: 'CARGO', other: 'OTHER' }`.
   - **Aggregation:** Build a `Map<string, number>` keyed by `${shipCategory}-${anomalyType}`. For each anomaly, treat missing/undefined `shipCategory` as `'other'`. Count occurrences.
   - **Brightness tiers:** Define a static array of 5 pre-built Tailwind classes for amber cell backgrounds, selected by count thresholds. Example tiers:
     - 0: `'bg-amber-500/5'` (barely visible)
     - 1-2: `'bg-amber-500/15'`
     - 3-5: `'bg-amber-500/30'`
     - 6-9: `'bg-amber-500/50'`
     - 10+: `'bg-amber-500/80'`
     **Critical:** Never dynamically concatenate Tailwind class names — Tailwind v4's scanner won't detect them. Select from the pre-defined array.
   - **Render:** A Bloomberg-style `<table>` with `font-mono`, `text-xs`, `uppercase`, amber text, black background. Column headers use the short labels. Each cell shows the count as a number and has the brightness-tier background class. Include a header row labeling the grid `ANOMALY MATRIX`.
   - Add `data-testid="anomaly-matrix"` on the outer `<div>` for diagnostic inspection.

2. **Create `src/components/fleet/__tests__/AnomalyMatrix.test.tsx`:**
   - Import `{ describe, it, expect, afterEach }` from `vitest`, `{ render, screen, cleanup }` from `@testing-library/react`.
   - Import `AnomalyMatrix` and `Anomaly` type.
   - `afterEach(cleanup)` — required for happy-dom (pattern from S01).
   - Build mock anomaly arrays with explicit `shipCategory` values.
   - **Test cases:**
     - **Grid dimensions:** Renders 3 data rows (Tanker, Cargo, Other) and 6 data columns (one per anomaly type). Use `getAllByRole('row')` to count rows (1 header + 3 data = 4). Use header cells to count columns.
     - **Count aggregation:** Given 3 tanker going_dark anomalies and 1 cargo loitering anomaly, verify cell text content shows `3` and `1` in the correct cells and `0` elsewhere.
     - **Brightness tier selection:** Given a cell with count ≥ 10, verify its class contains `bg-amber-500/80`. Given a cell with count 0, verify `bg-amber-500/5`.
     - **Empty state:** When passed `[]`, the component returns null — `queryByTestId('anomaly-matrix')` returns null.
     - **Missing shipCategory fallback:** Anomalies with `undefined` shipCategory should be counted in the "Other" row. Create mock anomalies without `shipCategory` and verify the Other row has the correct count.
   - Minimum 5 tests.

3. **Wire `AnomalyMatrix` into `src/app/(protected)/fleet/page.tsx`:**
   - Add `import { AnomalyMatrix } from '@/components/fleet/AnomalyMatrix';` to the imports.
   - In the JSX, insert `<AnomalyMatrix anomalies={anomalies} />` between `<SanctionedVessels vessels={sanctionedVessels} />` and the `<div className={...space-y-4...}>` that wraps the anomaly group tables.
   - The matrix should have a small top margin when the sanctions panel is present. Use something like `<div className="mt-4"><AnomalyMatrix ... /></div>` or add conditional spacing similar to how the anomaly groups div already handles it.

4. **Type check the entire project:**
   - Run `npx tsc --noEmit` — must exit 0.

5. **Run all fleet tests:**
   - Run `npx vitest run src/components/fleet/__tests__/` — all tests pass (existing 12 from S01 + new matrix tests).

## Must-Haves

- [ ] `AnomalyMatrix` component renders a 3×6 grid (Ship Type rows × Anomaly Type columns)
- [ ] Cell brightness uses pre-defined Tailwind class tiers (no runtime concatenation)
- [ ] Column headers use abbreviated labels (DARK, LOITER, ROUTE, DRIFT, REPEAT, STS)
- [ ] Returns `null` for empty anomalies array
- [ ] Missing `shipCategory` defaults to `'other'`
- [ ] `data-testid="anomaly-matrix"` on outer div
- [ ] At least 5 tests covering grid dimensions, aggregation, brightness, empty state, and missing-category fallback
- [ ] Component wired into FleetPage between SanctionedVessels and anomaly group tables
- [ ] All existing S01 tests still pass (regression)

## Verification

- `npx vitest run src/components/fleet/__tests__/AnomalyMatrix.test.tsx` — all tests pass
- `npx vitest run src/components/fleet/__tests__/` — all tests pass (S01 + S02)
- `npx tsc --noEmit` — zero errors
- `grep -q 'AnomalyMatrix' src/app/\\(protected\\)/fleet/page.tsx` — component imported and used in FleetPage
- `grep -q 'data-testid="anomaly-matrix"' src/components/fleet/AnomalyMatrix.tsx` — diagnostic hook present

## Inputs

- `src/types/anomaly.ts` — `Anomaly` type with `shipCategory` field, `ShipCategory` type, `ANOMALY_TYPE_LABELS` (from T01)
- `src/app/(protected)/fleet/page.tsx` — existing FleetPage to wire the component into
- `src/components/fleet/__tests__/AnomalyTable.test.tsx` — reference for test patterns (happy-dom cleanup, mock structure)

## Expected Output

- `src/components/fleet/AnomalyMatrix.tsx` — new: terminal-style heatmap grid component
- `src/components/fleet/__tests__/AnomalyMatrix.test.tsx` — new: 5+ tests for matrix behavior
- `src/app/(protected)/fleet/page.tsx` — modified: AnomalyMatrix wired between SanctionedVessels and anomaly tables

## Observability Impact

- **New diagnostic surface:** The `AnomalyMatrix` component renders `data-testid="anomaly-matrix"` on its outer div — DOM inspection or `document.querySelector('[data-testid="anomaly-matrix"]')` confirms it mounted.
- **Aggregation visibility:** Each cell displays its numeric count, making it possible to visually verify that the aggregation logic matches the raw anomaly data. Compare cell values against `curl localhost:3000/api/anomalies | jq '[.anomalies[] | select(.shipCategory=="tanker" and .anomalyType=="going_dark")] | length'`.
- **Empty state:** When no anomalies exist, the component returns `null` — absence of the `data-testid="anomaly-matrix"` element in the DOM confirms this path.
- **Failure visibility:** If the matrix renders incorrect counts, the 6 unit tests (grid dimensions, aggregation, brightness, empty state, missing-category fallback, testid) will catch it. The brightness tier test specifically validates that the CSS class changes with count thresholds.
