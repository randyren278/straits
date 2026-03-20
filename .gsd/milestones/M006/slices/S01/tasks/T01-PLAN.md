---
estimated_steps: 4
estimated_files: 3
---

# T01: Enhance anomaly API with vessel metadata and change default filter

**Slice:** S01 — Default All-Vessels & Fleet Page with Anomaly Tables
**Milestone:** M006

## Description

The Fleet page (T02) needs vessel names, flags, and risk scores from the `/api/anomalies` endpoint, but the current SQL query only returns anomaly fields. This task enhances the API response and changes the dashboard default filter from tankers-only to all vessels.

Three changes:
1. In `src/stores/vessel.ts`, change `tankersOnly: true` to `tankersOnly: false` on line 70.
2. In `src/app/api/anomalies/route.ts`, add `v.name as "vesselName"`, `v.flag`, and a LEFT JOIN to `vessel_risk_scores vrs` to include `vrs.score as "riskScore"` in the SQL SELECT.
3. In `src/types/anomaly.ts`, add `vesselName?: string`, `flag?: string`, and `riskScore?: number` fields to the existing `Anomaly` interface (optional fields since they're joined data).

## Steps

1. Open `src/stores/vessel.ts` and change `tankersOnly: true` to `tankersOnly: false` on line 70.
2. Open `src/app/api/anomalies/route.ts` and modify the SQL query:
   - Add `v.name as "vesselName", v.flag` to the SELECT clause (after the existing `vs.risk_category` line)
   - Add `LEFT JOIN vessel_risk_scores vrs ON vrs.imo = va.imo` after the existing `LEFT JOIN vessel_sanctions vs` line
   - Add `vrs.score as "riskScore"` to the SELECT clause
3. Open `src/types/anomaly.ts` and add three optional fields to the `Anomaly` interface:
   - `vesselName?: string;`
   - `flag?: string;`
   - `riskScore?: number;`
4. Run `npm run build` to verify TypeScript compiles with no errors.

## Must-Haves

- [ ] `tankersOnly` default is `false` in vessel store
- [ ] `/api/anomalies` SQL includes `v.name as "vesselName"`, `v.flag`, and LEFT JOIN to `vessel_risk_scores` for `riskScore`
- [ ] `Anomaly` type includes `vesselName`, `flag`, and `riskScore` optional fields
- [ ] `npm run build` passes

## Verification

- `npm run build` exits 0
- `grep -q 'tankersOnly: false' src/stores/vessel.ts` exits 0
- `grep -q 'vesselName' src/app/api/anomalies/route.ts` exits 0
- `grep -q 'vesselName' src/types/anomaly.ts` exits 0
- `grep -q 'riskScore' src/types/anomaly.ts` exits 0

## Inputs

- `src/stores/vessel.ts` — line 70 has `tankersOnly: true`
- `src/app/api/anomalies/route.ts` — SQL query currently JOINs `vessels v` but doesn't SELECT `v.name` or `v.flag`; no join to `vessel_risk_scores`
- `src/types/anomaly.ts` — `Anomaly` interface currently has `isSanctioned` and `sanctionRiskCategory` but no vessel metadata fields

## Expected Output

- `src/stores/vessel.ts` — `tankersOnly: false` on line 70
- `src/app/api/anomalies/route.ts` — SQL returns `vesselName`, `flag`, `riskScore` per anomaly row
- `src/types/anomaly.ts` — `Anomaly` interface includes `vesselName?: string`, `flag?: string`, `riskScore?: number`
