---
phase: 03-anomaly-detection
plan: 03
subsystem: api
tags: [watchlist, alerts, zustand, rest-api, crud, postgres]

# Dependency graph
requires:
  - phase: 03-01
    provides: "Database schema (watchlist, alerts tables), types (WatchlistEntry, Alert)"
provides:
  - "Watchlist CRUD with vessel info JOIN"
  - "Alerts CRUD with vessel info JOIN"
  - "Watchlist REST API (GET/POST/DELETE)"
  - "Alerts REST API (GET, mark-read)"
  - "Zustand state for watchlist, alerts, unreadCount, anomalyFilter"
  - "Optimistic update helpers for responsive UI"
affects: [03-04, 04-ui, ui-components]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "X-User-Id header for session-based user identification"
    - "LEFT JOIN with vessels table for API responses"
    - "Optimistic updates in Zustand for responsive UI"
    - "JSONB details column for flexible alert data"

key-files:
  created:
    - "src/app/api/watchlist/route.ts"
    - "src/app/api/alerts/route.ts"
    - "src/app/api/alerts/[id]/read/route.ts"
  modified:
    - "src/lib/db/watchlist.ts"
    - "src/lib/db/alerts.ts"
    - "src/stores/vessel.ts"
    - "src/lib/db/watchlist.test.ts"
    - "src/lib/db/alerts.test.ts"

key-decisions:
  - "X-User-Id header from localStorage UUID for session-based user identification"
  - "LEFT JOIN with vessels for API responses to include vessel names"
  - "Optimistic updates in store for immediate UI feedback"
  - "markAlertRead uses Math.max(0, count-1) to prevent negative unread count"

patterns-established:
  - "Watchlist/alerts API routes use X-User-Id header for user identification"
  - "API responses include vessel info via LEFT JOIN"
  - "Zustand setAlerts auto-calculates unreadCount"

requirements-completed: [HIST-02]

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 3 Plan 03: Watchlist and Alerts System Summary

**Watchlist and alerts CRUD with REST APIs, vessel info JOINs, and Zustand state management for UI integration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T06:20:25Z
- **Completed:** 2026-03-12T06:24:02Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Watchlist CRUD with `getWatchlistWithVessels` JOIN for vessel names
- Alerts CRUD with `getAlertsWithVessels` JOIN for vessel names
- REST API routes: `/api/watchlist` (GET/POST/DELETE), `/api/alerts` (GET), `/api/alerts/[id]/read` (POST)
- Zustand store extended with watchlist, alerts, unreadCount, anomalyFilter state
- Optimistic update helpers for responsive UI (addToWatchlist, removeFromWatchlist, markAlertRead)
- 41 new tests (18 watchlist + 23 alerts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Watchlist CRUD and API** - `e4e13a1` (feat)
2. **Task 2: Alerts CRUD and API** - `43d1f58` (feat)
3. **Task 3: Zustand store extension** - `ca4dbfe` (feat)

## Files Created/Modified

- `src/lib/db/watchlist.ts` - Added getWatchlistWithVessels with vessel info JOIN
- `src/lib/db/alerts.ts` - Added getAlertsWithVessels with vessel info JOIN
- `src/app/api/watchlist/route.ts` - Watchlist REST API (GET/POST/DELETE)
- `src/app/api/alerts/route.ts` - Alerts REST API (GET)
- `src/app/api/alerts/[id]/read/route.ts` - Mark alert as read API (POST)
- `src/stores/vessel.ts` - Extended with watchlist, alerts, unreadCount state
- `src/lib/db/watchlist.test.ts` - 18 real tests with mocked pool
- `src/lib/db/alerts.test.ts` - 23 real tests with mocked pool

## Decisions Made

- **X-User-Id header**: Used header instead of cookies for user ID to allow simple localStorage UUID approach
- **LEFT JOIN for vessel info**: API responses include vessel names/flags without requiring separate queries
- **Optimistic updates**: Store provides immediate UI feedback while API calls complete
- **Math.max for unread count**: Prevents negative count if markAlertRead called multiple times

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Watchlist and alerts APIs ready for UI integration
- Zustand store ready for components to consume watchlist/alerts state
- Detection jobs (03-02) can use generateAlertsForAnomaly to notify watchers

## Self-Check: PASSED

All files and commits verified:
- `src/app/api/watchlist/route.ts` - FOUND
- `src/app/api/alerts/route.ts` - FOUND
- `src/app/api/alerts/[id]/read/route.ts` - FOUND
- Commit `e4e13a1` (Task 1) - FOUND
- Commit `43d1f58` (Task 2) - FOUND
- Commit `ca4dbfe` (Task 3) - FOUND

---
*Phase: 03-anomaly-detection*
*Completed: 2026-03-12*
