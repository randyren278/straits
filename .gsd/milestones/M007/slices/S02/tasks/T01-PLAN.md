---
estimated_steps: 4
estimated_files: 3
---

# T01: Enrich API with shipCategory and extract shared anomaly type labels

**Slice:** S02 — The Anomaly Matrix Visualizer
**Milestone:** M007

## Description

Add `shipCategory` to the `/api/anomalies` SQL query and the `Anomaly` TypeScript type, then extract `ANOMALY_TYPE_LABELS` from `AnomalyTable.tsx` to a shared location so both `AnomalyTable` and the upcoming `AnomalyMatrix` can import it. This retires the "API Data Completeness" risk from the M007 roadmap.

## Steps

1. **Add `ShipCategory` type and `shipCategory` field to `src/types/anomaly.ts`:**
   - Add `export type ShipCategory = 'tanker' | 'cargo' | 'other';` near the top (after `AnomalyType` and `Confidence`).
   - Add `shipCategory?: ShipCategory;` to the `Anomaly` interface (after the existing `riskScore` field). Keep it optional — the vessels table allows `ship_type` to be NULL.
   - Add and export `ANOMALY_TYPE_LABELS`:
     ```typescript
     export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
       going_dark: 'Going Dark',
       loitering: 'Loitering',
       deviation: 'Route Deviation',
       speed: 'Speed Anomaly',
       repeat_going_dark: 'Repeat Going Dark',
       sts_transfer: 'STS Transfer',
     };
     ```

2. **Add `shipCategory` CASE expression to the SQL SELECT in `src/app/api/anomalies/route.ts`:**
   - In the `SELECT` clause (after `vrs.score AS "riskScore"`), add:
     ```sql
     CASE WHEN v.ship_type BETWEEN 80 AND 89 THEN 'tanker'
          WHEN v.ship_type BETWEEN 70 AND 79 THEN 'cargo'
          ELSE 'other'
     END AS "shipCategory"
     ```
   - The `vessels` table is already LEFT JOINed (`LEFT JOIN vessels v ON v.imo = va.imo`), so `v.ship_type` is available. When the join yields no match, `v.ship_type` is NULL, and the ELSE clause returns `'other'`.

3. **Update `src/components/fleet/AnomalyTable.tsx` to import labels:**
   - Remove the local `ANOMALY_TYPE_LABELS` constant (lines 19-26).
   - Add `import { ANOMALY_TYPE_LABELS } from '@/types/anomaly';` to the imports (alongside the existing `AnomalyType` import).
   - Ensure all existing usages of `ANOMALY_TYPE_LABELS[anomalyType]` continue to work unchanged.

4. **Verify no regressions:**
   - Run `npx tsc --noEmit` — must exit 0.
   - Run `npx vitest run src/components/fleet/__tests__/` — all 12 existing S01 tests must pass.

## Must-Haves

- [ ] `ShipCategory` type exported from `src/types/anomaly.ts`
- [ ] `shipCategory?: ShipCategory` field on the `Anomaly` interface
- [ ] `ANOMALY_TYPE_LABELS` exported from `src/types/anomaly.ts`
- [ ] SQL query in `route.ts` includes a CASE expression producing `"shipCategory"`
- [ ] `AnomalyTable.tsx` imports `ANOMALY_TYPE_LABELS` from `@/types/anomaly` (no local duplicate)
- [ ] Zero TypeScript errors
- [ ] All 12 existing fleet tests pass

## Verification

- `npx tsc --noEmit` exits 0
- `npx vitest run src/components/fleet/__tests__/` — 12 tests pass, zero failures
- `grep -q 'ShipCategory' src/types/anomaly.ts` — type alias exists
- `grep -q '"shipCategory"' src/app/api/anomalies/route.ts` — SQL column alias present
- `grep -q 'ANOMALY_TYPE_LABELS' src/types/anomaly.ts` — labels exported from shared location

## Inputs

- `src/types/anomaly.ts` — existing Anomaly interface to extend with shipCategory
- `src/app/api/anomalies/route.ts` — existing SQL query to enrich with CASE expression
- `src/components/fleet/AnomalyTable.tsx` — existing local ANOMALY_TYPE_LABELS to extract

## Expected Output

- `src/types/anomaly.ts` — modified: ShipCategory type, shipCategory field, ANOMALY_TYPE_LABELS export
- `src/app/api/anomalies/route.ts` — modified: CASE expression for shipCategory in SELECT
- `src/components/fleet/AnomalyTable.tsx` — modified: imports ANOMALY_TYPE_LABELS from @/types/anomaly
