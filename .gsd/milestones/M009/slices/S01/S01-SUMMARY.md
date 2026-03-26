---
id: S01
parent: M009
milestone: M009
provides:
  - Consistent 7-day display window across map, fleet, chokepoints, and anomalies
requires:
  []
affects:
  []
key_files:
  - src/components/map/VesselMap.tsx
  - src/lib/constants/staleness.ts
  - src/lib/db/positions.ts
key_decisions:
  - Used coalesce with fallback -1 for null shipType in Mapbox expression
  - Aligned chokepoint staleness to 7 days to match vessel display
  - Static import for staleness constant in positions.ts
patterns_established:
  - Use coalesce in Mapbox GL expressions for nullable numeric properties
  - All display staleness intervals sourced from src/lib/constants/staleness.ts
observability_surfaces:
  - Zero Mapbox GL expression warnings in console
  - rg STALENESS src/ audit pattern for future drift detection
drill_down_paths:
  - .gsd/milestones/M009/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M009/slices/S01/tasks/T02-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-03-26T18:47:32.734Z
blocker_discovered: false
---

# S01: Staleness Sync & Map Fix

**Fixed Mapbox null-shipType rendering bug and aligned all display queries to consistent 7-day staleness window**

## What Happened

Fixed three issues causing display inconsistency across tabs:\n\n1. **Mapbox GL null shipType bug** (root cause of missing vessels on map): The circle-color case expression used `['>=', ['get', 'shipType'], 80]` which throws when shipType is null, causing Mapbox to silently drop 107 features. Fixed with `['coalesce', ['get', 'shipType'], -1]`.\n\n2. **Chokepoint staleness mismatch**: CHOKEPOINT_STALENESS_INTERVAL was 24 hours while vessel display used 7 days. Aligned to 7 days.\n\n3. **getLatestPositions() hardcoded interval**: Updated unused but inconsistent function from '1 hour' to use VESSEL_STALENESS_INTERVAL.\n\nVerified: 399 vessels on map, 272 unique anomaly IMOs in fleet (⊆ map), zero console warnings, all tests pass.

## Verification

TypeScript clean, 333 tests pass, browser assertions 4/4 pass, API count verification confirms fleet ⊆ map, rg audit clean

## Requirements Advanced

- R001 — All 399 vessels now render on map with consistent 7-day window
- R002 — Anomaly vessels are confirmed subset of map vessels

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

Chokepoint counts remain 0 — legitimate because no vessels are in those geographic bounding boxes, not a staleness issue.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `src/components/map/VesselMap.tsx` — Wrapped shipType comparison with coalesce to handle null values in Mapbox circle-color expression
- `src/lib/constants/staleness.ts` — Changed CHOKEPOINT_STALENESS_INTERVAL from '24 hours' to '7 days'
- `src/lib/db/positions.ts` — Imported VESSEL_STALENESS_INTERVAL and replaced hardcoded '1 hour' in getLatestPositions()
