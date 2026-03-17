---
phase: 08-all-ships-anomalies
plan: "01"
subsystem: anomaly-detection
tags: [vitest, tdd, postgresql, vessel-detection, ais]

# Dependency graph
requires:
  - phase: 03-anomaly-detection
    provides: detectGoingDark, detectLoitering, detectSpeedAnomaly with ship_type 80-89 filter
provides:
  - Going-dark detection runs on all vessel types (no ship_type restriction)
  - Loitering detection runs on all vessel types (no ship_type restriction)
  - Speed anomaly detection runs on all vessel types (no ship_type restriction)
affects: [09-all-ships-ui, 10-all-ships-analytics, any-phase-consuming-anomaly-data]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All anomaly detectors now operate on full vessel set — cargo, bulk carriers, tankers, and unclassified vessels"
    - "TDD: RED (test fails asserting .not.toContain) → GREEN (remove SQL clause) pattern for filter removal"

key-files:
  created: []
  modified:
    - src/lib/detection/going-dark.ts
    - src/lib/detection/going-dark.test.ts
    - src/lib/detection/loitering.ts
    - src/lib/detection/loitering.test.ts
    - src/lib/detection/deviation.ts
    - src/lib/detection/deviation.test.ts

key-decisions:
  - "ANOM-05: anomaly detection now applies to all vessel types, not only tankers (ship_type 80-89) — cargo, bulk carriers, and unclassified vessels are now included"

patterns-established:
  - "SQL filter removal pattern: remove AND/WHERE clause, update JSDoc comment from 'tankers' to 'all vessels', add .not.toContain test to guard regression"

requirements-completed: [ANOM-05]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 08 Plan 01: All-Ships Anomalies Summary

**Going-dark, loitering, and speed anomaly detectors extended to all vessel types by removing ship_type BETWEEN 80 AND 89 SQL filter from three detection queries**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-17T21:41:00Z
- **Completed:** 2026-03-17T21:45:18Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Removed `AND v.ship_type BETWEEN 80 AND 89` from `detectGoingDark()` SQL query (going-dark.ts)
- Removed `WHERE v.ship_type BETWEEN 80 AND 89` from `detectLoitering()` SQL query (loitering.ts)
- Removed `AND v.ship_type BETWEEN 80 AND 89` from `detectSpeedAnomaly()` SQL query (deviation.ts)
- Updated JSDoc comments in all three files from "tankers only" / "tankers" to "all vessels"
- TDD: updated tests to assert `.not.toContain('ship_type BETWEEN 80 AND 89')` and added non-tanker vessel (ship_type 72 cargo) positive-detection tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove ship_type tanker filter from going-dark detection** - `0835e69` (feat)
2. **Task 2: Remove ship_type tanker filter from loitering and speed detection** - `7edcae4` (feat)

_Note: TDD RED phase was verified (tests failed with old code) before GREEN implementation for each task._

## Files Created/Modified
- `src/lib/detection/going-dark.ts` - Removed ship_type filter from detectGoingDark() query
- `src/lib/detection/going-dark.test.ts` - Updated to assert no ship_type filter; added cargo vessel test
- `src/lib/detection/loitering.ts` - Removed ship_type filter from detectLoitering() query
- `src/lib/detection/loitering.test.ts` - Updated to assert no ship_type filter; added cargo vessel test
- `src/lib/detection/deviation.ts` - Removed ship_type filter from detectSpeedAnomaly() query
- `src/lib/detection/deviation.test.ts` - Updated to assert no ship_type filter; added cargo vessel test

## Decisions Made
- ANOM-05 confirmed: anomaly detection should cover all vessel types. The ship_type 80-89 constraint was a legacy restriction that excluded cargo ships, bulk carriers, and unclassified vessels from going-dark, loitering, and speed anomaly detection. All three detectors now operate on the full vessel dataset.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Plan referenced `npm test -- --testPathPattern=...` but the project uses vitest which requires `npx vitest run <path>`. Used correct syntax throughout. No impact on execution.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three anomaly detectors now operate on full vessel set — ready for Phase 9 UI work to surface non-tanker anomalies
- 42 tests passing across all three detection files, TypeScript build clean

---
*Phase: 08-all-ships-anomalies*
*Completed: 2026-03-17*
