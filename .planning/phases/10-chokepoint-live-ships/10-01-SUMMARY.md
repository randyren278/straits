---
phase: 10-chokepoint-live-ships
plan: "01"
subsystem: api
tags: [postgres, nextjs, chokepoints, vessels, anomalies]

requires:
  - phase: 02-intelligence-layers
    provides: chokepoints-constants.ts with CHOKEPOINTS registry and bounding boxes
  - phase: 03-anomaly-detection
    provides: vessel_anomalies table with resolved_at NULL = active anomaly pattern

provides:
  - getVesselsInChokepoint(id) — returns ChokepointVessel[] or null for unknown IDs
  - GET /api/chokepoints/[id]/vessels — JSON endpoint for live vessel list inside a chokepoint zone

affects:
  - 10-chokepoint-live-ships (plans 02+) — UI widgets consume this endpoint

tech-stack:
  added: []
  patterns:
    - "DISTINCT ON (mmsi) + 1-hour freshness window for latest vessel positions"
    - "null return signals unknown resource (caller returns 404)"
    - "Next.js 16 async params: await params before accessing id"

key-files:
  created:
    - src/app/api/chokepoints/[id]/vessels/route.ts
  modified:
    - src/lib/geo/chokepoints.ts

key-decisions:
  - "getVesselsInChokepoint returns null (not throws) for unknown chokepoint IDs — caller owns the 404 response"
  - "DISTINCT ON (mmsi) ORDER BY mmsi, time DESC — most recent position per vessel within 1-hour window"
  - "LEFT JOIN vessel_anomalies on imo + resolved_at IS NULL — active anomaly detection consistent with existing pattern"

patterns-established:
  - "Chokepoint data layer pattern: null = not found, [] = empty zone, [...] = vessels present"

requirements-completed: [CHKP-01]

duration: 1min
completed: 2026-03-17
---

# Phase 10 Plan 01: Chokepoint Live Ships — Vessel List API Summary

**PostgreSQL query function and Next.js API route that return live vessels inside any chokepoint bounding box, enriched with active anomaly status via LEFT JOIN on vessel_anomalies.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-17T22:08:11Z
- **Completed:** 2026-03-17T22:09:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `ChokepointVessel` interface and `getVesselsInChokepoint()` to `chokepoints.ts`, following the established DISTINCT ON + 1-hour freshness pattern
- Created `GET /api/chokepoints/[id]/vessels` route returning `{ vessels: ChokepointVessel[] }`, with 404 for unknown IDs and 500 on DB error
- TypeScript compiles clean with no errors; both existing functions (`countVesselsInChokepoint`, `getChokepointStats`) remain unchanged

## Task Commits

1. **Task 1: Add getVesselsInChokepoint() to chokepoints.ts** - `f6d7a7a` (feat)
2. **Task 2: Create GET /api/chokepoints/[id]/vessels route** - `9587bcf` (feat)

## Files Created/Modified

- `src/lib/geo/chokepoints.ts` - Added `ChokepointVessel` interface and `getVesselsInChokepoint()` function
- `src/app/api/chokepoints/[id]/vessels/route.ts` - New Next.js App Router route for live vessel list

## Decisions Made

- `getVesselsInChokepoint` returns `null` for unknown IDs (not an error throw) — the route layer owns the HTTP 404 response shape
- Used `await params` in the route handler per Next.js 16 async params pattern (consistent with other API routes in this project)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Data layer is complete: `getVesselsInChokepoint(id)` is exported and typed
- API endpoint `GET /api/chokepoints/[id]/vessels` is live
- Ready for Phase 10 plan 02 — UI widgets can now fetch live vessel lists for each chokepoint

---
*Phase: 10-chokepoint-live-ships*
*Completed: 2026-03-17*
