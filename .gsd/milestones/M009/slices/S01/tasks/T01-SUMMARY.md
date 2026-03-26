---
id: T01
parent: S01
milestone: M009
provides: []
requires: []
affects: []
key_files: ["src/components/map/VesselMap.tsx", "src/lib/constants/staleness.ts", "src/lib/db/positions.ts"]
key_decisions: ["Wrapped Mapbox shipType expression with coalesce to handle null values", "Aligned CHOKEPOINT_STALENESS_INTERVAL from 24 hours to 7 days", "Used static import for staleness in positions.ts (not dynamic like sanctions.ts)"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "TypeScript compiles clean (npx tsc --noEmit), all 333 tests pass (npx vitest run), browser console shows zero Mapbox GL expression warnings, rg audit confirms all display queries use staleness constants"
completed_at: 2026-03-26T18:45:55.619Z
blocker_discovered: false
---

# T01: Fixed Mapbox null-shipType rendering bug and aligned all display queries to 7-day staleness window

> Fixed Mapbox null-shipType rendering bug and aligned all display queries to 7-day staleness window

## What Happened
---
id: T01
parent: S01
milestone: M009
key_files:
  - src/components/map/VesselMap.tsx
  - src/lib/constants/staleness.ts
  - src/lib/db/positions.ts
key_decisions:
  - Wrapped Mapbox shipType expression with coalesce to handle null values
  - Aligned CHOKEPOINT_STALENESS_INTERVAL from 24 hours to 7 days
  - Used static import for staleness in positions.ts (not dynamic like sanctions.ts)
duration: ""
verification_result: passed
completed_at: 2026-03-26T18:45:55.620Z
blocker_discovered: false
---

# T01: Fixed Mapbox null-shipType rendering bug and aligned all display queries to 7-day staleness window

**Fixed Mapbox null-shipType rendering bug and aligned all display queries to 7-day staleness window**

## What Happened

Investigated the map-vs-fleet discrepancy. Found three issues:\n\n1. **Mapbox GL null shipType bug**: The circle-color case expression checked `['>=', ['get', 'shipType'], 80]` which throws when shipType is null. Mapbox GL silently drops features that fail expression evaluation. Fixed by wrapping with `['coalesce', ['get', 'shipType'], -1]` so null shipTypes evaluate to -1 (no match) and fall through to the gray default color.\n\n2. **Chokepoint staleness mismatch**: CHOKEPOINT_STALENESS_INTERVAL was 24 hours while VESSEL_STALENESS_INTERVAL was 7 days. Updated to 7 days for consistency. Chokepoint counts remain 0 because no vessels are physically in those bounding boxes — legitimate data.\n\n3. **getLatestPositions() hardcoded interval**: Unused function had hardcoded '1 hour'. Updated to use VESSEL_STALENESS_INTERVAL for consistency if it's ever called.\n\nAll 333 tests pass, TypeScript compiles clean, zero Mapbox console warnings.

## Verification

TypeScript compiles clean (npx tsc --noEmit), all 333 tests pass (npx vitest run), browser console shows zero Mapbox GL expression warnings, rg audit confirms all display queries use staleness constants

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 8600ms |
| 2 | `npx vitest run` | 0 | ✅ pass | 4200ms |
| 3 | `rg STALENESS src/ -l (audit)` | 0 | ✅ pass — 5 files, all correct | 100ms |


## Deviations

Chokepoint counts remain 0 because no vessels are physically in those geographic bounding boxes — this is correct behavior, not a staleness issue.

## Known Issues

None.

## Files Created/Modified

- `src/components/map/VesselMap.tsx`
- `src/lib/constants/staleness.ts`
- `src/lib/db/positions.ts`


## Deviations
Chokepoint counts remain 0 because no vessels are physically in those geographic bounding boxes — this is correct behavior, not a staleness issue.

## Known Issues
None.
