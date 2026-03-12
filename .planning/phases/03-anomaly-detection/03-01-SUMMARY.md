---
phase: 03-anomaly-detection
plan: 01
subsystem: database, detection
tags: [timescaledb, uuid, haversine, geofencing, anomaly-detection, crud]

# Dependency graph
requires:
  - phase: 02-intelligence-layers
    provides: chokepoints.ts bounding box pattern, node-cron, base schema
provides:
  - vessel_anomalies table with JSONB details for detection storage
  - watchlist table with session-based user_id
  - alerts table for notification system
  - Type definitions for Anomaly, Alert, WatchlistEntry with discriminated unions
  - Haversine distance and bearing calculation utilities
  - 5 AIS coverage zones (Persian Gulf, Red Sea North/South, Suez, Oman Coast)
  - 8 anchorage zones for loitering exclusion
  - CRUD stubs for anomalies, watchlist, alerts
affects: [03-02, 03-03, 04-analytics]

# Tech tracking
tech-stack:
  added: [uuid]
  patterns: [coverage zone bounding box, anchorage exclusion, discriminated unions for anomaly details]

key-files:
  created:
    - src/lib/db/schema.sql (Phase 3 section)
    - src/types/anomaly.ts
    - src/lib/geo/haversine.ts
    - src/lib/detection/coverage-zones.ts
    - src/lib/geo/anchorages.ts
    - src/lib/db/anomalies.ts
    - src/lib/db/watchlist.ts
    - src/lib/db/alerts.ts
  modified:
    - package.json (uuid dependency)

key-decisions:
  - "Session-based user identification via localStorage UUID - no full auth needed for friend group"
  - "JSONB for anomaly details allows flexible type-specific data without schema changes"
  - "Anchorage exclusion prevents false loitering alerts at known waiting areas"
  - "Coverage zones restrict going-dark detection to terrestrial AIS areas"

patterns-established:
  - "CoverageZone interface with minLat/maxLat/minLon/maxLon bounds"
  - "Anchorage interface following same bounding box pattern as chokepoints"
  - "Haversine distance for great-circle calculations in detection logic"
  - "it.todo() scaffolds for DB tests requiring mock setup"

requirements-completed: [ANOM-01, ANOM-02, HIST-02]

# Metrics
duration: 7min
completed: 2026-03-12
---

# Phase 3 Plan 1: Anomaly Detection Foundation Summary

**Database schema with vessel_anomalies/watchlist/alerts tables, haversine geo utilities, coverage zone definitions, and type-safe CRUD stubs for detection system**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-12T05:00:00Z
- **Completed:** 2026-03-12T05:07:00Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Extended database schema with Phase 3 tables (vessel_anomalies, watchlist, alerts) including partial indexes
- Created discriminated union types for type-safe anomaly handling
- Implemented haversine distance and bearing calculation with 41 passing tests
- Defined 5 AIS coverage zones and 8 anchorage zones for Middle East
- Created CRUD stubs with 51 test scaffolds ready for implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and extend database schema** - `bd88c25` (feat)
2. **Task 2: Create type definitions and geo utilities** - `df196dc` (feat - TDD)
3. **Task 3: Create CRUD functions and test scaffolds** - `84547dc` (feat)

## Files Created/Modified

- `src/lib/db/schema.sql` - Phase 3 tables for anomalies, watchlist, alerts
- `src/types/anomaly.ts` - Discriminated union types for anomaly system
- `src/lib/geo/haversine.ts` - Great-circle distance and bearing calculation
- `src/lib/detection/coverage-zones.ts` - 5 terrestrial AIS coverage zones
- `src/lib/geo/anchorages.ts` - 8 known anchorage zones
- `src/lib/db/anomalies.ts` - CRUD for vessel anomalies
- `src/lib/db/watchlist.ts` - CRUD for user watchlist
- `src/lib/db/alerts.ts` - CRUD for user alerts
- `package.json` - Added uuid dependency

## Decisions Made

- Used uuid v13 for session-based user identification instead of full auth system
- JSONB column for anomaly details enables flexible type-specific storage
- Coverage zones use simple bounding boxes (not PostGIS) - sufficient for rectangular regions
- Anchorage zones defined with generous bounds to prevent false loitering alerts
- Created it.todo() scaffolds for DB tests requiring proper mocking infrastructure

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed coverage zone test for Suez approaches**
- **Found during:** Task 2 (Coverage zones test)
- **Issue:** Test coordinate (30.0, 32.5) overlapped with red_sea_north zone due to shared boundary
- **Fix:** Changed test to use (31.0, 32.5) which is uniquely in suez_approaches
- **Files modified:** src/lib/detection/coverage-zones.test.ts
- **Verification:** All 14 coverage zone tests pass
- **Committed in:** df196dc (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test)
**Impact on plan:** Minor test coordinate adjustment. No scope creep.

## Issues Encountered

None - plan executed as specified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema ready for anomaly storage
- Types ready for detection job implementation
- Geo utilities ready for distance/bearing calculations in loitering and deviation detection
- Coverage zones ready for going-dark detection logic
- CRUD stubs ready for API route integration

**Ready for:** Plan 03-02 (Going Dark Detection) and Plan 03-03 (Route Anomaly Detection)

---
*Phase: 03-anomaly-detection*
*Completed: 2026-03-12*
