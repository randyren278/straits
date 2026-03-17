---
phase: 08-all-ships-anomalies
plan: "02"
subsystem: api, ui
tags: [anomalies, filtering, ship-type, notification-bell, postgres, nextjs]

# Dependency graph
requires:
  - phase: 08-all-ships-anomalies-plan-01
    provides: anomaly detection extended to all vessel types
provides:
  - GET /api/anomalies with optional ?shipType=tanker|cargo|other filter via LEFT JOIN vessels
  - NotificationBell dropdown with All/Tanker/Cargo/Other filter buttons
affects:
  - any future plan that reads from /api/anomalies or modifies NotificationBell

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server-side SQL fragment injection via controlled switch (safe because value comes from validated enum, not raw user input)
    - useRef to capture current state in 30s interval closure (avoids stale closure bug)

key-files:
  created: []
  modified:
    - src/app/api/anomalies/route.ts
    - src/components/ui/NotificationBell.tsx

key-decisions:
  - "NotificationBell switched data source from /api/alerts (watchlist-based) to /api/anomalies (all active anomalies) to support ship type filtering consistently"
  - "useRef tracks shipTypeFilter inside interval closure to prevent stale filter on 30s polling refreshes"
  - "SQL shipType clause injected as string fragment from controlled switch — safe because it never uses raw query param value directly"
  - "LEFT JOIN used (not INNER JOIN) so anomalies for vessels not yet in vessels table still appear when shipType is absent"

patterns-established:
  - "Ref-guarded polling: useRef mirrors state value so setInterval closures always read current filter without re-registering the interval"

requirements-completed:
  - ANOM-06

# Metrics
duration: 8min
completed: 2026-03-17
---

# Phase 8 Plan 02: Ship Type Filter for Anomalies Summary

**Ship type filter (All/Tanker/Cargo/Other) added to /api/anomalies via LEFT JOIN and to NotificationBell dropdown with amber active state and ref-guarded 30s polling**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-17T07:00:00Z
- **Completed:** 2026-03-17T07:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- GET /api/anomalies now accepts ?shipType=tanker|cargo|other and filters via LEFT JOIN vessels on ship_type ranges
- NotificationBell renders four filter buttons (ALL / TANKER / CARGO / OTHER) in amber-active / gray-inactive terminal style
- 30-second polling interval correctly respects the current filter via useRef stale-closure fix

## Task Commits

Each task was committed atomically:

1. **Task 1: Add shipType filter support to GET /api/anomalies** - `a0d85b9` (feat)
2. **Task 2: Add ship type filter buttons to NotificationBell alerts panel** - `4c3a37f` (feat)

## Files Created/Modified
- `src/app/api/anomalies/route.ts` - LEFT JOIN vessels + conditional WHERE clause for tanker/cargo/other
- `src/components/ui/NotificationBell.tsx` - Ship type filter state, filter buttons, useRef-guarded interval, switched data source to /api/anomalies

## Decisions Made
- NotificationBell switched from `/api/alerts` (watchlist-based user alerts) to `/api/anomalies` (all active unresolved anomalies) because the shipType filter only makes sense against the anomalies table which has the vessel ship_type JOIN available.
- `useRef` pattern used to mirror `shipTypeFilter` state into the `setInterval` closure, preventing the classic stale closure bug where the interval always uses the value captured at mount time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type cast through `unknown` for discriminated union**
- **Found during:** Task 2 (NotificationBell implementation)
- **Issue:** TypeScript error: `Conversion of type 'GoingDarkDetails | ... | SpeedDetails' to type 'Record<string, unknown>'` — SpeedDetails lacks index signature
- **Fix:** Cast `anomaly.details as unknown as Record<string, unknown>` to satisfy strict TypeScript
- **Files modified:** src/components/ui/NotificationBell.tsx
- **Verification:** npm run build exits 0
- **Committed in:** 4c3a37f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 type bug)
**Impact on plan:** Minor TypeScript strictness fix. No scope creep.

## Issues Encountered
- None beyond the type casting deviation above.

## Next Phase Readiness
- ANOM-06 complete. /api/anomalies filter infrastructure ready for any future panel that needs ship type segregation.
- NotificationBell now uses /api/anomalies directly; the /api/alerts watchlist endpoint is unchanged and still available for other consumers.

---
*Phase: 08-all-ships-anomalies*
*Completed: 2026-03-17*
