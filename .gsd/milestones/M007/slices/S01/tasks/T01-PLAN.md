---
estimated_steps: 3
estimated_files: 2
---

# T01: Collapse AnomalyTable by default and add component test

**Slice:** S01 — Default-Collapsed Tables & Sanctions Priority List
**Milestone:** M007

## Description

Change the `AnomalyTable` component to render collapsed by default instead of expanded. This is a one-line state initialization change. Then add a Vitest + React Testing Library component test to lock the collapsed-by-default behavior and verify toggle functionality.

The project uses Vitest with `happy-dom` environment and `@testing-library/react` is already installed. Follow the existing test patterns in `src/` (co-located `__tests__/` directories).

## Steps

1. In `src/components/fleet/AnomalyTable.tsx`, change `useState<boolean>(true)` to `useState<boolean>(false)` (around line 49). This is the only production code change.
2. Create `src/components/fleet/__tests__/AnomalyTable.test.tsx` with tests that:
   - Render `AnomalyTable` with a mock array of `Anomaly` objects (use the `AnomalyType` `'going_dark'` and minimal required fields).
   - Assert the table body (the `<table>` element or rows) is **not** in the document by default.
   - Assert `aria-expanded="false"` on the toggle button.
   - Simulate clicking the header button, then assert the table rows appear and `aria-expanded="true"`.
   - Assert clicking again collapses it back.
3. Run the test to verify it passes.

## Must-Haves

- [ ] `useState<boolean>(false)` — AnomalyTable starts collapsed.
- [ ] Toggle still works — clicking header expands/collapses.
- [ ] Component test file exists and passes.

## Verification

- `npx vitest run src/components/fleet/__tests__/AnomalyTable.test.tsx` — all tests pass.
- `npx tsc --noEmit` — no type errors introduced.

## Inputs

- `src/components/fleet/AnomalyTable.tsx` — the component to modify (line ~49: `useState<boolean>(true)`)
- `src/types/anomaly.ts` — type definitions needed for mock data in the test

## Expected Output

- `src/components/fleet/AnomalyTable.tsx` — modified: default expanded state changed to `false`
- `src/components/fleet/__tests__/AnomalyTable.test.tsx` — new test file validating collapsed-by-default behavior
