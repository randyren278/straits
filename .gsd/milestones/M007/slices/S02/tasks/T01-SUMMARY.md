---
id: T01
parent: S02
milestone: M007
provides:
  - ShipCategory type and shipCategory field on Anomaly interface
  - shipCategory CASE expression in /api/anomalies SQL query
  - ANOMALY_TYPE_LABELS exported from shared types module
key_files:
  - src/types/anomaly.ts
  - src/app/api/anomalies/route.ts
  - src/components/fleet/AnomalyTable.tsx
key_decisions:
  - Anomaly type labels extracted to src/types/anomaly.ts as the shared canonical location for both AnomalyTable and AnomalyMatrix
patterns_established:
  - Ship type code ranges: 80-89 = tanker, 70-79 = cargo, everything else (including NULL) = other
observability_surfaces:
  - "curl localhost:3000/api/anomalies | jq '.anomalies[0].shipCategory'" returns tanker/cargo/other
  - SQL CASE ELSE clause ensures NULL ship_type maps to 'other' — no undefined values in API output
duration: 5m
verification_result: passed
completed_at: 2026-03-20T13:39:00-07:00
blocker_discovered: false
---

# T01: Enrich API with shipCategory and extract shared anomaly type labels

**Added ShipCategory type, shipCategory CASE expression to anomalies SQL, and extracted ANOMALY_TYPE_LABELS to shared types module**

## What Happened

Three files modified per plan. `src/types/anomaly.ts` gained the `ShipCategory` union type, `shipCategory?: ShipCategory` on the `Anomaly` interface, and the `ANOMALY_TYPE_LABELS` constant (exported). The `/api/anomalies` SQL query now includes a CASE expression mapping `v.ship_type` ranges to `'tanker'`/`'cargo'`/`'other'`, with NULL falling through to `'other'`. `AnomalyTable.tsx` was updated to import `ANOMALY_TYPE_LABELS` from `@/types/anomaly` instead of defining it locally — the local constant was removed entirely.

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run src/components/fleet/__tests__/` — 12/12 tests pass (2 test files: AnomalyTable 5 tests, SanctionedVessels 7 tests)
- `grep -q 'ShipCategory' src/types/anomaly.ts` — pass
- `grep -q '"shipCategory"' src/app/api/anomalies/route.ts` — pass
- `grep -q 'ANOMALY_TYPE_LABELS' src/types/anomaly.ts` — pass
- AnomalyTable imports from shared location — pass
- No local ANOMALY_TYPE_LABELS duplicate in AnomalyTable — pass

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 7.2s |
| 2 | `npx vitest run src/components/fleet/__tests__/` | 0 | ✅ pass | 7.2s |
| 3 | `grep -q 'ShipCategory' src/types/anomaly.ts` | 0 | ✅ pass | <1s |
| 4 | `grep -q '"shipCategory"' src/app/api/anomalies/route.ts` | 0 | ✅ pass | <1s |
| 5 | `grep -q 'ANOMALY_TYPE_LABELS' src/types/anomaly.ts` | 0 | ✅ pass | <1s |
| 6 | `grep -q 'shipCategory' src/types/anomaly.ts` (slice check) | 0 | ✅ pass | <1s |
| 7 | `grep -q 'shipCategory' src/app/api/anomalies/route.ts` (slice check) | 0 | ✅ pass | <1s |

Slice checks not yet applicable (T02): `AnomalyMatrix.test.tsx` — test file does not exist yet (created in T02).

## Diagnostics

- Inspect API output: `curl localhost:3000/api/anomalies | jq '.anomalies[0].shipCategory'` — should return `"tanker"`, `"cargo"`, or `"other"`
- If query fails with column error, check that `vessels` table has `ship_type` column (integer AIS ship type code)
- API errors are logged to server stderr and returned as `{ error: 'Failed to fetch anomalies' }` with HTTP 500

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/types/anomaly.ts` — Added ShipCategory type, shipCategory field on Anomaly, exported ANOMALY_TYPE_LABELS
- `src/app/api/anomalies/route.ts` — Added CASE expression for shipCategory in SQL SELECT
- `src/components/fleet/AnomalyTable.tsx` — Replaced local ANOMALY_TYPE_LABELS with import from @/types/anomaly
- `.gsd/milestones/M007/slices/S02/S02-PLAN.md` — Added Observability / Diagnostics section
- `.gsd/milestones/M007/slices/S02/tasks/T01-PLAN.md` — Added Observability Impact section
