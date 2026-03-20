---
id: T01
parent: S01
milestone: M007
provides:
  - AnomalyTable defaults to collapsed state
  - Component test locking collapsed-by-default behavior
key_files:
  - src/components/fleet/AnomalyTable.tsx
  - src/components/fleet/__tests__/AnomalyTable.test.tsx
  - tests/setup.ts
key_decisions:
  - Added @testing-library/user-event and @testing-library/jest-dom as dev dependencies for component testing
patterns_established:
  - React component tests use afterEach(cleanup) with happy-dom to prevent DOM accumulation between tests
  - Use getByRole with name filter (e.g. { name: /Going Dark anomalies/ }) to scope queries in tests with complex child components
  - Mock heavy child components (FleetVesselDetail) via vi.mock to keep unit tests focused
observability_surfaces:
  - aria-expanded attribute on AnomalyTable toggle button reflects collapsed/expanded state
duration: 12m
verification_result: passed
completed_at: 2026-03-20
blocker_discovered: false
---

# T01: Collapse AnomalyTable by default and add component test

**Changed AnomalyTable initial state from expanded to collapsed and added 5 Vitest+RTL tests covering default state, toggle, and accessibility attributes.**

## What Happened

1. Changed `useState<boolean>(true)` to `useState<boolean>(false)` in `AnomalyTable.tsx` (line 49) — the sole production code change.
2. Installed `@testing-library/user-event` and `@testing-library/jest-dom` as dev dependencies (neither was present).
3. Added `import '@testing-library/jest-dom/vitest'` to `tests/setup.ts` to enable DOM matchers like `toBeInTheDocument()` and `toHaveAttribute()`.
4. Created `src/components/fleet/__tests__/AnomalyTable.test.tsx` with 5 tests:
   - Renders collapsed by default (no table, `aria-expanded="false"`)
   - Expands on click (table visible, vessel names appear, `aria-expanded="true"`)
   - Collapses on second click (round-trip toggle)
   - Displays anomaly count `[2]` in header
   - Renders accessible label with anomaly type and count
5. Happy-dom required explicit `afterEach(cleanup)` — without it, multiple renders accumulate in the DOM causing "multiple elements found" errors.

## Verification

- `npx vitest run src/components/fleet/__tests__/AnomalyTable.test.tsx` — 5/5 tests pass (154ms)
- `npx tsc --noEmit` — clean, zero errors

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/components/fleet/__tests__/AnomalyTable.test.tsx` | 0 | ✅ pass | 615ms |
| 2 | `npx tsc --noEmit` | 0 | ✅ pass | ~4s |

## Diagnostics

- Inspect `aria-expanded` attribute on the AnomalyTable toggle button in browser DevTools to verify collapsed state at runtime.
- Run `npx vitest run src/components/fleet/__tests__/AnomalyTable.test.tsx` to re-verify the behavior contract.

## Deviations

- Installed `@testing-library/user-event` and `@testing-library/jest-dom` (not in plan, but required for the tests to work — no prior component tests existed in the project).
- Added `@testing-library/jest-dom/vitest` import to `tests/setup.ts` to enable DOM matchers globally.
- Added explicit `afterEach(cleanup)` in the test file because happy-dom doesn't auto-cleanup between test runs, causing DOM accumulation.

## Known Issues

None.

## Files Created/Modified

- `src/components/fleet/AnomalyTable.tsx` — Changed `useState<boolean>(true)` to `useState<boolean>(false)` (collapsed by default)
- `src/components/fleet/__tests__/AnomalyTable.test.tsx` — New: 5 component tests for collapsed-by-default behavior and toggle
- `tests/setup.ts` — Added `@testing-library/jest-dom/vitest` import for DOM matchers
- `.gsd/milestones/M007/slices/S01/S01-PLAN.md` — Added Observability / Diagnostics section; marked T01 done
