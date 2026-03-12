---
phase: 03-anomaly-detection
plan: 02
subsystem: detection, ingester
tags: [going-dark, loitering, speed-anomaly, cron, haversine, coverage-zones]

# Dependency graph
requires:
  - phase: 03-01
    provides: coverage-zones.ts, anchorages.ts, haversine.ts, anomaly types, CRUD stubs
provides:
  - detectGoingDark() for AIS gap detection in coverage zones
  - detectLoitering() with Haversine radius calculation
  - detectSpeedAnomaly() for slow tankers outside anchorages
  - startDetectionJobs() cron scheduler for AIS ingester
  - generateAlertsForNewAnomalies() for automatic alerting
affects: [03-03, 03-04, 04-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD for detection logic, cron scheduling, confidence levels, anchorage exclusion]

key-files:
  created:
    - src/lib/detection/going-dark.ts
    - src/lib/detection/going-dark.test.ts
    - src/lib/detection/loitering.ts
    - src/lib/detection/loitering.test.ts
    - src/lib/detection/deviation.ts
    - src/lib/detection/deviation.test.ts
    - src/services/ais-ingester/detection-jobs.ts
  modified:
    - src/lib/db/anomalies.test.ts
    - src/lib/db/alerts.ts
    - src/services/ais-ingester/index.ts

key-decisions:
  - "Confidence levels: suspected (2-4h gap) vs confirmed (>4h gap) for going-dark"
  - "5nm (9.26km) radius threshold for loitering detection using Haversine"
  - "3 knots speed threshold for slow tanker anomalies"
  - "Deviation detection stubbed for v1 - requires destination geocoding infrastructure"
  - "1-hour deduplication window for alerts to prevent spam"
  - "Cron schedules: 15min for going-dark, 30min for route anomalies"

patterns-established:
  - "TDD for detection algorithms: test behaviors first, then implement"
  - "Mocked pool.query for unit testing DB interactions"
  - "Coverage zone filtering before flagging anomalies"
  - "Anchorage exclusion to prevent false positive loitering alerts"

requirements-completed: [ANOM-01, ANOM-02]

# Metrics
duration: 6min
completed: 2026-03-12
---

# Phase 3 Plan 2: Anomaly Detection Algorithms Summary

**Going-dark detection with coverage zone filtering, loitering detection with Haversine radius calculation, speed anomaly detection, and cron job integration into AIS ingester**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-12T06:20:20Z
- **Completed:** 2026-03-12T06:25:42Z
- **Tasks:** 3
- **Files created:** 7
- **Files modified:** 3
- **Tests added:** 56 (14 going-dark, 17 anomalies CRUD, 15 loitering, 10 deviation/speed)

## Accomplishments

- Implemented going-dark detection with 2-tier confidence (suspected 2-4h, confirmed >4h)
- Created loitering detection using Haversine distance with 5nm radius threshold
- Built speed anomaly detection for tankers <3 knots outside anchorages
- Integrated cron jobs into AIS ingester (15min/30min schedules)
- Added generateAlertsForNewAnomalies for automatic alert creation with deduplication
- Converted anomalies.test.ts from it.todo() stubs to real tests with mocks

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement going-dark detection** - `48c65b0` (feat - TDD)
   - detectGoingDark(), determineConfidence(), shouldFlagAsGoingDark()
   - Coverage zone filtering, confidence level logic
   - 31 tests (14 going-dark, 17 anomalies CRUD)

2. **Task 2: Implement loitering and route anomaly detection** - `e2fd5d9` (feat - TDD)
   - detectLoitering(), calculateCentroid(), isLoiteringBehavior()
   - detectSpeedAnomaly(), isSpeedAnomaly()
   - detectDeviation() stub for v2
   - 25 tests (15 loitering, 10 deviation/speed)

3. **Task 3: Integrate detection cron jobs into AIS ingester** - `312e5d3` (feat)
   - detection-jobs.ts with startDetectionJobs()
   - Updated index.ts to call startDetectionJobs() after WebSocket connection
   - generateAlertsForNewAnomalies() with 1-hour dedup window

## Files Created/Modified

**Created:**
- `src/lib/detection/going-dark.ts` - AIS gap detection in coverage zones
- `src/lib/detection/going-dark.test.ts` - 14 tests for going-dark logic
- `src/lib/detection/loitering.ts` - Loitering detection with Haversine
- `src/lib/detection/loitering.test.ts` - 15 tests for loitering logic
- `src/lib/detection/deviation.ts` - Speed anomaly + deviation stub
- `src/lib/detection/deviation.test.ts` - 10 tests for speed anomaly
- `src/services/ais-ingester/detection-jobs.ts` - Cron job definitions

**Modified:**
- `src/lib/db/anomalies.test.ts` - Converted 17 it.todo() to real tests
- `src/lib/db/alerts.ts` - Added generateAlertsForNewAnomalies()
- `src/services/ais-ingester/index.ts` - Import and call startDetectionJobs()

## Decisions Made

- **Confidence levels:** 2-4h gap = suspected, >4h = confirmed (matches research)
- **Loitering radius:** 5nm = 9.26km (standard maritime definition)
- **Speed threshold:** <3 knots outside anchorage indicates drifting/disabled
- **Deviation detection stubbed:** Requires destination geocoding which is complex
- **Alert deduplication:** 1-hour window prevents multiple alerts for same anomaly
- **Cron integration:** Jobs start after WebSocket connects to ensure DB pool ready

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully.

## Verification Checklist

- [x] detectGoingDark queries vessels with >2h gap, checks coverage zone, creates anomaly
- [x] Confidence levels correct: suspected (2-4h), confirmed (>4h)
- [x] detectLoitering calculates centroid, checks 5nm radius, excludes anchorages
- [x] detectSpeedAnomaly flags tankers <3 knots outside anchorages
- [x] Cron jobs scheduled: going_dark every 15 min, route anomalies every 30 min
- [x] generateAlertsForNewAnomalies creates alerts for watched vessels only
- [x] All tests pass: 312 passing, 17 todo

## Next Phase Readiness

- Detection algorithms ready for real vessel data
- Alert system ready for UI integration (notification bell)
- Cron jobs will auto-run when ingester deployed
- Detection results can be queried via existing CRUD functions

**Ready for:** Plan 03-03 (Watchlist API Routes) and Plan 03-04 (Anomaly UI Components)

---
*Phase: 03-anomaly-detection*
*Completed: 2026-03-12*
