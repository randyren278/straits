---
phase: quick-5
plan: "01"
subsystem: ais-ingester, geo
tags: [aisstream, bounding-boxes, chokepoints, websocket, bug-fix]
dependency_graph:
  requires: []
  provides: [correct-aisstream-coverage, wider-chokepoint-detection]
  affects: [src/services/ais-ingester/index.ts, src/lib/geo/chokepoints-constants.ts]
tech_stack:
  added: []
  patterns: [explicit-per-region-bounding-boxes]
key_files:
  created: []
  modified:
    - src/services/ais-ingester/index.ts
    - src/lib/geo/chokepoints-constants.ts
    - src/lib/geo/chokepoints.test.ts
    - src/lib/db/analytics.test.ts
decisions:
  - "Four explicit per-region bounding boxes replace one large catch-all box for reliable chokepoint coverage"
  - "Chokepoint detection bounds aligned to match subscription boxes (same coordinate ranges)"
metrics:
  duration: "~2 min"
  completed: "2026-03-14"
  tasks_completed: 2
  files_modified: 4
---

# Quick Task 5: Fix AISStream Bounding Boxes for Strait Coverage Summary

**One-liner:** Replaced single catch-all AISStream bounding box with four explicit per-region boxes (Hormuz, Bab-el-Mandeb, Suez, Eastern Med) and widened chokepoint detection bounds to match.

## What Was Done

The user reported only seeing ships near Cyprus, indicating the Persian Gulf, Red Sea, and Suez Canal regions were not being covered. The fix addressed two separate systems:

1. **AISStream WebSocket subscription** (`src/services/ais-ingester/index.ts`) — The single large bounding box `[[10, 30], [35, 80]]` was replaced with four targeted per-region boxes.

2. **Chokepoint detection bounds** (`src/lib/geo/chokepoints-constants.ts`) — The tight detection bounds were widened to match the subscription boxes, ensuring vessels received via AIS are also counted in chokepoint stats.

## Final Coordinate Values

### AISStream Subscription BoundingBoxes

| Region | lat_min | lon_min | lat_max | lon_max |
|--------|---------|---------|---------|---------|
| Strait of Hormuz | 23.5 | 55.5 | 27.0 | 57.5 |
| Bab-el-Mandeb | 11.0 | 42.5 | 13.5 | 45.0 |
| Suez Canal | 29.5 | 31.5 | 32.5 | 33.0 |
| Eastern Mediterranean | 33.0 | 28.0 | 37.0 | 37.0 |

### Chokepoint Detection Constants

| Chokepoint | minLat | maxLat | minLon | maxLon | Change |
|------------|--------|--------|--------|--------|--------|
| Hormuz | 23.5 | 27.0 | 55.5 | 57.5 | Was: 26.0/27.0/55.5/57.0 |
| Bab-el-Mandeb | 11.0 | 13.5 | 42.5 | 45.0 | Was: 12.4/13.0/43.0/43.7 |
| Suez | 29.5 | 32.5 | 31.5 | 33.0 | Was: 29.8/31.3/32.2/32.6 |

## Tasks Completed

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 1fd8672 | Replace single catch-all AISStream bounding box with 4 explicit boxes |
| 2 | 3fdbbaa | Widen chokepoint detection bounds + TDD test updates |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale hardcoded Hormuz bounds in analytics test**
- **Found during:** Task 2 full suite regression check
- **Issue:** `src/lib/db/analytics.test.ts` had hardcoded old Hormuz bound values `[26.0, 27.0, 55.5, 57.0]` in a `toHaveBeenCalledWith` assertion that became stale after updating `chokepoints-constants.ts`
- **Fix:** Updated assertion to use new bounds `[23.5, 27.0, 55.5, 57.5]`
- **Files modified:** `src/lib/db/analytics.test.ts`
- **Commit:** 3fdbbaa

## Self-Check: PASSED

- FOUND: src/services/ais-ingester/index.ts
- FOUND: src/lib/geo/chokepoints-constants.ts
- FOUND: src/lib/geo/chokepoints.test.ts
- FOUND: .planning/quick/5-fix-aisstream-bounding-boxes-for-strait-/5-SUMMARY.md
- FOUND commit: 1fd8672
- FOUND commit: 3fdbbaa
