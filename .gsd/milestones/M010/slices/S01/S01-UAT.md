# S01: Anomalies Staleness Filter & Data Parity — UAT

**Milestone:** M010
**Written:** 2026-03-26T20:00:58.840Z

# S01: Anomalies Staleness Filter & Data Parity — UAT

**Milestone:** M010
**Written:** 2026-03-26

## UAT Type

- UAT mode: mixed (artifact-driven + live-runtime)
- Why this mode is sufficient: The code change is a SQL filter — artifact inspection confirms correct syntax and placement, but live runtime confirms the query executes without error and returns the expected subset.

## Preconditions

- TimescaleDB running (`docker compose up -d`)
- Next.js dev server running (`npm run dev`)
- Database has vessel position and anomaly data (some vessels should have positions older than 7 days to verify filtering)

## Smoke Test

```bash
curl -s http://localhost:3000/api/anomalies | jq '.anomalies | length'
```
Should return a count. If the database has vessels with stale positions, this count should be less than total unresolved anomalies in the `vessel_anomalies` table.

## Test Cases

### 1. Anomaly IMOs are subset of map vessel IMOs

1. Fetch anomaly IMOs: `curl -s http://localhost:3000/api/anomalies | jq '[.anomalies[].imo] | unique | sort'`
2. Fetch vessel IMOs (map uses positions endpoint): `curl -s http://localhost:3000/api/vessels/positions | jq '[.vessels[].imo // empty] | unique | sort'`
3. **Expected:** Every IMO in the anomalies response also appears in the vessels/positions response. Anomaly IMOs ⊆ vessel IMOs.

### 2. Anomalies API returns valid response with shipType filter

1. `curl -s http://localhost:3000/api/anomalies?shipType=tanker | jq '.anomalies | length'`
2. `curl -s http://localhost:3000/api/anomalies?shipType=cargo | jq '.anomalies | length'`
3. **Expected:** Both return valid JSON with `anomalies` array. No SQL errors. Counts are ≤ total unfiltered count.

### 3. Anomalies API returns valid response with IMO filter

1. Pick an IMO from test case 1 results.
2. `curl -s http://localhost:3000/api/anomalies?imo=<IMO> | jq '.anomalies'`
3. **Expected:** Returns anomalies only for that IMO. All returned entries have matching IMO.

### 4. Staleness constant audit

1. Run `rg 'STALENESS_INTERVAL' src/`
2. **Expected:** `anomalies/route.ts` appears in results alongside `positions.ts`, `sanctions.ts`, `chokepoints.ts`. Files in `src/lib/detection/` and `src/lib/db/analytics.ts` do NOT appear.

### 5. TypeScript compilation

1. Run `npx tsc --noEmit`
2. **Expected:** Exit code 0, no errors.

## Edge Cases

### Vessel with NULL IMO

1. If there are anomalies in the database for vessels with NULL IMO, they should be excluded by the `v2.imo IS NOT NULL` guard.
2. **Expected:** No anomalies with null IMO appear in the response.

### No recent positions for any vessel

1. If all vessel positions are older than 7 days (unlikely in prod, possible in test), the anomalies endpoint should return an empty array.
2. **Expected:** `{ \"anomalies\": [] }` — not an error.

## Failure Signals

- SQL error in anomalies response (500 status)
- Anomaly IMOs that don't appear in the vessels/positions response (parity broken)
- `STALENESS_INTERVAL` appearing in detection or analytics files (staleness boundary violated)
- TypeScript compilation errors

## Not Proven By This UAT

- Actual vessel count reduction (depends on database state — requires vessels with stale positions)
- UI rendering of the filtered anomalies on the fleet page (visual verification not in scope for this SQL-layer slice)
- Performance impact of the EXISTS subquery under load

## Notes for Tester

The key verification is test case 1 — anomaly IMOs ⊆ vessel IMOs. If the database has no stale vessels (all positions within 7 days), the filter won't visibly reduce the result set, but the SQL correctness is still provable via the artifact audit (test cases 4 and 5).
