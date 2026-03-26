---
id: T01
parent: S01
milestone: M010
provides: []
requires: []
affects: []
key_files: ["src/app/api/anomalies/route.ts"]
key_decisions: ["EXISTS subquery placed before shipTypeClause and imo filter so it always applies regardless of optional params"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "TypeScript compilation clean (npx tsc --noEmit exit 0). Staleness audit via rg confirms anomalies/route.ts now appears alongside positions.ts, sanctions.ts, chokepoints.ts. Detection files confirmed untouched via git diff."
completed_at: 2026-03-26T19:59:34.083Z
blocker_discovered: false
---

# T01: Added EXISTS staleness subquery to /api/anomalies using IMO→MMSI bridge join so anomalies only return for vessels with positions within VESSEL_STALENESS_INTERVAL

> Added EXISTS staleness subquery to /api/anomalies using IMO→MMSI bridge join so anomalies only return for vessels with positions within VESSEL_STALENESS_INTERVAL

## What Happened
---
id: T01
parent: S01
milestone: M010
key_files:
  - src/app/api/anomalies/route.ts
key_decisions:
  - EXISTS subquery placed before shipTypeClause and imo filter so it always applies regardless of optional params
duration: ""
verification_result: passed
completed_at: 2026-03-26T19:59:34.084Z
blocker_discovered: false
---

# T01: Added EXISTS staleness subquery to /api/anomalies using IMO→MMSI bridge join so anomalies only return for vessels with positions within VESSEL_STALENESS_INTERVAL

**Added EXISTS staleness subquery to /api/anomalies using IMO→MMSI bridge join so anomalies only return for vessels with positions within VESSEL_STALENESS_INTERVAL**

## What Happened

Imported VESSEL_STALENESS_INTERVAL from @/lib/constants/staleness and added an EXISTS subquery to the anomalies SQL query. The subquery joins vessel_positions → vessels via MMSI to bridge back to the anomaly's IMO, filtering out anomalies for vessels without recent position data. The EXISTS clause is positioned before shipTypeClause and imo filter so it always applies. Pattern matches existing implementations in sanctions.ts, positions.ts, and chokepoints.ts.

## Verification

TypeScript compilation clean (npx tsc --noEmit exit 0). Staleness audit via rg confirms anomalies/route.ts now appears alongside positions.ts, sanctions.ts, chokepoints.ts. Detection files confirmed untouched via git diff.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 3700ms |
| 2 | `rg 'STALENESS_INTERVAL' src/ | grep -q 'anomalies/route.ts'` | 0 | ✅ pass | 100ms |
| 3 | `git diff --name-only src/lib/detection/` | 0 | ✅ pass (no files) | 100ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/app/api/anomalies/route.ts`


## Deviations
None.

## Known Issues
None.
