# S02: The Anomaly Matrix Visualizer

**Goal:** A dense, terminal-style heatmap grid renders at the top of the fleet page, providing an instant cross-section of anomalies by ship type and anomaly type, with cell brightness scaled by count.
**Demo:** Visit `/fleet` — between the Sanctioned Vessels panel and the collapsed anomaly tables, a 3×6 grid shows Ship Type rows (Tanker, Cargo, Other) × Anomaly Type columns (DARK, LOITER, ROUTE, DRIFT, REPEAT, STS) with amber cells whose brightness reflects anomaly count. The API now returns `shipCategory` for every anomaly.

## Must-Haves

- `Anomaly` TypeScript type includes `shipCategory?: 'tanker' | 'cargo' | 'other'`
- `/api/anomalies` SQL query returns `shipCategory` via a CASE expression on `v.ship_type`
- `AnomalyMatrix` component renders a 3-row × 6-column grid with amber brightness scaling
- Matrix slots between `SanctionedVessels` and the anomaly group tables in `FleetPage`
- Anomaly type labels are shared (not duplicated) between `AnomalyTable` and `AnomalyMatrix`
- Component returns `null` for empty anomalies array
- Anomalies with missing `shipCategory` fall into the "Other" category

## Proof Level

- This slice proves: integration (API → type → component → page composition)
- Real runtime required: no (contract + component test level is sufficient)
- Human/UAT required: yes (visual inspection of amber luminescence scaling)

## Verification

- `npx tsc --noEmit` — zero type errors after adding `shipCategory` field
- `npx vitest run src/components/fleet/__tests__/AnomalyMatrix.test.tsx` — all matrix tests pass
- `npx vitest run src/components/fleet/__tests__/` — all existing S01 tests still pass (regression)
- `grep -q 'shipCategory' src/types/anomaly.ts` — field exists in type definition
- `grep -q 'shipCategory' src/app/api/anomalies/route.ts` — field produced by SQL query

## Integration Closure

- Upstream surfaces consumed: `src/app/api/anomalies/route.ts` (SQL query, `Anomaly` type), `src/components/fleet/AnomalyTable.tsx` (label map extracted to shared location), S01's `SanctionedVessels` component (layout ordering)
- New wiring introduced in this slice: `<AnomalyMatrix>` composed into `FleetPage` between `<SanctionedVessels>` and anomaly group `<div>`
- What remains before the milestone is truly usable end-to-end: nothing — this is the final slice

## Tasks

- [x] **T01: Enrich API with shipCategory and extract shared anomaly type labels** `est:20m`
  - Why: The frontend matrix needs `shipCategory` from the API, and both `AnomalyTable` and the new `AnomalyMatrix` need the same anomaly type labels. This retires the "API Data Completeness" risk.
  - Files: `src/app/api/anomalies/route.ts`, `src/types/anomaly.ts`, `src/components/fleet/AnomalyTable.tsx`
  - Do: Add a `CASE WHEN v.ship_type BETWEEN 80 AND 89 THEN 'tanker' WHEN v.ship_type BETWEEN 70 AND 79 THEN 'cargo' ELSE 'other' END AS "shipCategory"` to the SQL SELECT. Add `shipCategory?: 'tanker' | 'cargo' | 'other'` and `ShipCategory` type alias to the `Anomaly` interface. Export `ANOMALY_TYPE_LABELS` from `src/types/anomaly.ts` and update `AnomalyTable.tsx` to import from there instead of defining locally.
  - Verify: `npx tsc --noEmit` exits 0; `npx vitest run src/components/fleet/__tests__/` — all 12 existing tests pass
  - Done when: `shipCategory` appears in SQL SELECT and TypeScript type, labels are exported from `src/types/anomaly.ts`, AnomalyTable imports from there, and zero regressions

- [x] **T02: Build AnomalyMatrix component with tests and wire into FleetPage** `est:30m`
  - Why: The matrix is the core deliverable of this slice — a dense grid that visualizes anomaly counts by ship type × anomaly type with amber luminescence scaling.
  - Files: `src/components/fleet/AnomalyMatrix.tsx`, `src/components/fleet/__tests__/AnomalyMatrix.test.tsx`, `src/app/(protected)/fleet/page.tsx`
  - Do: Create `AnomalyMatrix` component receiving `anomalies: Anomaly[]`, aggregating into a count grid, rendering a `<table>` with 3 rows (Tanker/Cargo/Other) × 6 columns (anomaly types). Use pre-defined Tailwind opacity tiers for brightness scaling (never concatenate class names at runtime). Use abbreviated column headers (DARK, LOITER, ROUTE, DRIFT, REPEAT, STS). Return `null` for empty arrays. Treat missing `shipCategory` as `'other'`. Write tests covering: grid dimensions, count aggregation accuracy, brightness tier selection, empty state, missing-shipCategory fallback. Wire into FleetPage between `<SanctionedVessels>` and the anomaly groups `<div>`. Load skill: `react-best-practices`.
  - Verify: `npx vitest run src/components/fleet/__tests__/AnomalyMatrix.test.tsx`; `npx vitest run src/components/fleet/__tests__/`; `npx tsc --noEmit`
  - Done when: AnomalyMatrix renders 3×6 grid, tests pass, component appears between SanctionedVessels and anomaly tables in FleetPage, all existing tests still pass

## Observability / Diagnostics

- **Runtime signals:** The `/api/anomalies` response now includes `shipCategory` on every anomaly object — inspect any response payload to confirm the field is present. A missing `shipCategory` (null/undefined) means the vessel had no `ship_type` in the DB; the SQL CASE maps this to `'other'`.
- **Inspection surfaces:** `curl localhost:3000/api/anomalies | jq '.anomalies[0].shipCategory'` should return `"tanker"`, `"cargo"`, or `"other"`. The `AnomalyMatrix` component renders `data-testid="anomaly-matrix"` for DOM inspection.
- **Failure visibility:** If the `vessels` table JOIN fails or `ship_type` column is missing, the query will error and the API returns `{ error: 'Failed to fetch anomalies' }` with status 500 — logged to server stderr.
- **Redaction constraints:** None — `shipCategory` is derived from AIS ship type codes (public data, no PII).

## Files Likely Touched

- `src/types/anomaly.ts`
- `src/app/api/anomalies/route.ts`
- `src/components/fleet/AnomalyTable.tsx`
- `src/components/fleet/AnomalyMatrix.tsx`
- `src/components/fleet/__tests__/AnomalyMatrix.test.tsx`
- `src/app/(protected)/fleet/page.tsx`
