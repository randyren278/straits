---
id: S02
parent: M007
milestone: M007
provides:
  - AnomalyMatrix component — terminal-style 3×6 heatmap grid (Ship Type × Anomaly Type) with amber brightness scaling
  - shipCategory field on Anomaly TypeScript interface and API response
  - ANOMALY_TYPE_LABELS extracted to shared types module for reuse across components
key_files:
  - src/components/fleet/AnomalyMatrix.tsx
  - src/components/fleet/__tests__/AnomalyMatrix.test.tsx
  - src/types/anomaly.ts
  - src/app/api/anomalies/route.ts
  - src/components/fleet/AnomalyTable.tsx
  - src/app/(protected)/fleet/page.tsx
requires:
  - slice: S01
    provides: SanctionedVessels component and collapsed AnomalyTable defaults (layout ordering context for matrix placement)
affects: []
key_decisions:
  - Brightness tiers use 5 pre-defined static Tailwind classes (bg-amber-500/5 through bg-amber-500/80) — no dynamic class concatenation, required for Tailwind v4 scanner compatibility
  - Anomaly type labels extracted to src/types/anomaly.ts as the single shared source for AnomalyTable and AnomalyMatrix
  - Ship type code ranges: 80-89 = tanker, 70-79 = cargo, everything else (including NULL) = other
patterns_established:
  - getBrightnessTier() maps count → static CSS class via threshold array — reusable for any count-based intensity visualization
  - Mock anomaly helper with sensible defaults and explicit overrides for readable fleet component tests
observability_surfaces:
  - "data-testid='anomaly-matrix'" on outer div — DOM inspection confirms component mounted
  - "curl localhost:3000/api/anomalies | jq '.anomalies[0].shipCategory'" returns tanker/cargo/other
  - Component returns null for empty arrays — absence of testid element confirms empty-state path
drill_down_paths:
  - .gsd/milestones/M007/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M007/slices/S02/tasks/T02-SUMMARY.md
duration: 11m
verification_result: passed
completed_at: 2026-03-20T14:05:00-07:00
---

# S02: The Anomaly Matrix Visualizer

**Terminal-style 3×6 heatmap grid rendering anomaly counts by ship type × anomaly type with amber brightness scaling, powered by a new `shipCategory` field from the API**

## What Happened

T01 enriched the data pipeline: the `/api/anomalies` SQL query gained a CASE expression mapping AIS ship type codes to `'tanker'` (80-89), `'cargo'` (70-79), or `'other'` (everything else, including NULL). The `Anomaly` TypeScript interface and `ShipCategory` type alias were added to `src/types/anomaly.ts`. As a cleanup, `ANOMALY_TYPE_LABELS` was extracted from `AnomalyTable.tsx` into the shared types module so both `AnomalyTable` and the new `AnomalyMatrix` consume labels from a single source.

T02 built the `AnomalyMatrix` component — a dense `<table>` with 3 rows (TANKER/CARGO/OTHER) × 6 columns (DARK/LOITER/ROUTE/DRIFT/REPEAT/STS). It receives the full `Anomaly[]`, aggregates counts into a `Map<string, number>` keyed by `${shipCategory}-${anomalyType}`, and renders each cell with one of 5 pre-defined Tailwind opacity tiers based on count thresholds (0 → near-invisible, 10+ → vivid amber). Missing `shipCategory` defaults to `'other'`. Empty arrays produce `null` (no render). The component was wired into `FleetPage` between `<SanctionedVessels>` and the anomaly group tables. Six unit tests cover grid dimensions, count aggregation accuracy, brightness tier selection, empty state, missing-shipCategory fallback, and data-testid presence.

This completes M007. The `/fleet` page now has: (1) sanctioned vessels at the top (S01), (2) the anomaly matrix heatmap (S02), and (3) collapsed anomaly detail tables (S01).

## Verification

- **TypeScript:** `npx tsc --noEmit` — zero errors
- **Tests:** `npx vitest run src/components/fleet/__tests__/` — 18/18 pass (6 AnomalyMatrix + 5 AnomalyTable + 7 SanctionedVessels)
- **Structural checks:** `shipCategory` present in types and API route, `ANOMALY_TYPE_LABELS` exported from types, `data-testid="anomaly-matrix"` in component, `AnomalyMatrix` imported in FleetPage — all pass
- **Regression:** All 12 pre-existing S01 tests continue to pass

## Deviations

None.

## Known Limitations

- Brightness thresholds (0/1-2/3-5/6-9/10+) are hardcoded — tuning requires editing `BRIGHTNESS_TIERS` in `AnomalyMatrix.tsx`. If fleet sizes vary dramatically, these may need to become relative (percentile-based) rather than absolute.
- The matrix does not support click-through from cells to filtered anomaly lists — it's read-only visualization.
- `shipCategory` is derived from AIS `ship_type` integer codes, which may not cover all vessel classification nuances (e.g. ship_type 30-39 for fishing vessels all map to `'other'`).

## Follow-ups

- None — this is the final slice of M007.

## Files Created/Modified

- `src/types/anomaly.ts` — Added `ShipCategory` type, `shipCategory` field on `Anomaly`, exported `ANOMALY_TYPE_LABELS`
- `src/app/api/anomalies/route.ts` — Added CASE expression for `shipCategory` in SQL SELECT
- `src/components/fleet/AnomalyTable.tsx` — Replaced local `ANOMALY_TYPE_LABELS` with import from `@/types/anomaly`
- `src/components/fleet/AnomalyMatrix.tsx` — New: terminal-style 3×6 heatmap grid component
- `src/components/fleet/__tests__/AnomalyMatrix.test.tsx` — New: 6 tests for the matrix component
- `src/app/(protected)/fleet/page.tsx` — Wired `AnomalyMatrix` between `SanctionedVessels` and anomaly tables

## Forward Intelligence

### What the next slice should know
- M007 is complete. The `/fleet` page layout is now: SanctionedVessels → AnomalyMatrix → collapsed AnomalyTable groups. Any new section should consider where it fits in this visual hierarchy.
- `ANOMALY_TYPE_LABELS` in `src/types/anomaly.ts` is the canonical source for anomaly type display names — use it, don't redeclare.
- `ShipCategory` type is available for any feature that needs vessel categorization by AIS ship type codes.

### What's fragile
- `getBrightnessTier()` thresholds are absolute counts — if the fleet grows 10x, most cells will saturate at the highest tier and the matrix loses its diagnostic value. Monitor whether cells cluster at `bg-amber-500/80`.
- The SQL CASE expression in `/api/anomalies` hardcodes ship type ranges. If AIS classification conventions change or new categories are needed, this is a single-point edit.

### Authoritative diagnostics
- `curl localhost:3000/api/anomalies | jq '.anomalies[0].shipCategory'` — confirms API enrichment is live
- `document.querySelector('[data-testid="anomaly-matrix"]')` — confirms component rendered in the DOM
- 18 tests in `src/components/fleet/__tests__/` — comprehensive regression baseline for all fleet components

### What assumptions changed
- No assumptions changed — the API had the `vessels.ship_type` column as expected, and the Tailwind v4 static class approach worked without issues.
