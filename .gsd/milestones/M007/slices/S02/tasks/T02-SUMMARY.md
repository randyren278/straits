---
id: T02
parent: S02
milestone: M007
provides:
  - AnomalyMatrix component rendering 3×6 heatmap grid (Ship Type × Anomaly Type)
  - 6 unit tests covering grid dimensions, aggregation, brightness, empty state, missing-category fallback, and testid
  - AnomalyMatrix wired into FleetPage between SanctionedVessels and anomaly group tables
key_files:
  - src/components/fleet/AnomalyMatrix.tsx
  - src/components/fleet/__tests__/AnomalyMatrix.test.tsx
  - src/app/(protected)/fleet/page.tsx
key_decisions:
  - Brightness tiers use 5 pre-defined static Tailwind classes (bg-amber-500/5 through bg-amber-500/80) selected by count threshold — no dynamic class concatenation for Tailwind v4 compatibility
patterns_established:
  - getBrightnessTier() function maps count → static CSS class via threshold array — reusable for any count-based intensity visualization
  - Mock anomaly helper pattern with sensible defaults and explicit overrides for test readability
observability_surfaces:
  - "data-testid='anomaly-matrix'" on outer div — DOM inspection confirms component mounted
  - Each cell shows numeric count — visual verification of aggregation against raw API data
  - Component returns null for empty arrays — absence of testid element confirms empty-state path
duration: 6m
verification_result: passed
completed_at: 2026-03-20T13:40:00-07:00
blocker_discovered: false
---

# T02: Build AnomalyMatrix component with tests and wire into FleetPage

**Built terminal-style 3×6 heatmap grid component with amber brightness scaling, 6 unit tests, and wired into FleetPage between SanctionedVessels and anomaly tables**

## What Happened

Created `AnomalyMatrix` component that receives `Anomaly[]`, aggregates counts into a `Map<string, number>` keyed by `${shipCategory}-${anomalyType}`, and renders a Bloomberg-style `<table>` with 3 rows (TANKER/CARGO/OTHER) × 6 columns (DARK/LOITER/ROUTE/DRIFT/REPEAT/STS). Cell backgrounds use 5 pre-defined Tailwind opacity tiers selected by count thresholds (0 → `bg-amber-500/5`, 10+ → `bg-amber-500/80`). Missing `shipCategory` defaults to `'other'`. Returns `null` for empty arrays. Component uses `<caption>` for the "ANOMALY MATRIX" label.

Wrote 6 tests following the S01 pattern (happy-dom cleanup, mock helpers): grid dimensions (row/column count + labels), count aggregation accuracy, brightness tier CSS class selection, empty state null return, missing-shipCategory fallback to Other row, and data-testid presence.

Wired `<AnomalyMatrix>` into `FleetPage` between `<SanctionedVessels>` and the anomaly group tables `<div>`, wrapped in a `<div className="mt-4">` for spacing.

## Verification

- `npx tsc --noEmit` — zero errors (exit 0)
- `npx vitest run src/components/fleet/__tests__/` — 18/18 tests pass (6 AnomalyMatrix + 5 AnomalyTable + 7 SanctionedVessels)
- `npx vitest run src/components/fleet/__tests__/AnomalyMatrix.test.tsx` — 6/6 pass
- `grep -q 'AnomalyMatrix' src/app/(protected)/fleet/page.tsx` — pass
- `grep -q 'data-testid="anomaly-matrix"' src/components/fleet/AnomalyMatrix.tsx` — pass
- `grep -q 'shipCategory' src/types/anomaly.ts` — pass (slice-level check)
- `grep -q 'shipCategory' src/app/api/anomalies/route.ts` — pass (slice-level check)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 2.9s |
| 2 | `npx vitest run src/components/fleet/__tests__/` | 0 | ✅ pass | 2.9s |
| 3 | `npx vitest run src/components/fleet/__tests__/AnomalyMatrix.test.tsx` | 0 | ✅ pass | (included above) |
| 4 | `grep -q 'AnomalyMatrix' src/app/\(protected\)/fleet/page.tsx` | 0 | ✅ pass | <1s |
| 5 | `grep -q 'data-testid="anomaly-matrix"' src/components/fleet/AnomalyMatrix.tsx` | 0 | ✅ pass | <1s |
| 6 | `grep -q 'shipCategory' src/types/anomaly.ts` | 0 | ✅ pass | <1s |
| 7 | `grep -q 'shipCategory' src/app/api/anomalies/route.ts` | 0 | ✅ pass | <1s |

All slice-level verification checks pass. This is the final task of S02.

## Diagnostics

- Inspect matrix in DOM: `document.querySelector('[data-testid="anomaly-matrix"]')` — present when anomalies exist, absent when empty
- Verify cell counts against API: `curl localhost:3000/api/anomalies | jq '[.anomalies[] | select(.shipCategory=="tanker" and .anomalyType=="going_dark")] | length'`
- Brightness tiers are fully static — if a cell shows wrong brightness, check `getBrightnessTier()` threshold logic in `AnomalyMatrix.tsx`

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/components/fleet/AnomalyMatrix.tsx` — New: terminal-style 3×6 heatmap grid component with amber brightness scaling
- `src/components/fleet/__tests__/AnomalyMatrix.test.tsx` — New: 6 tests for grid dimensions, aggregation, brightness, empty state, missing-category fallback, testid
- `src/app/(protected)/fleet/page.tsx` — Modified: imported and wired AnomalyMatrix between SanctionedVessels and anomaly group tables
- `.gsd/milestones/M007/slices/S02/tasks/T02-PLAN.md` — Modified: added Observability Impact section (pre-flight fix)
