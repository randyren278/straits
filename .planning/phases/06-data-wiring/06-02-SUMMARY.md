---
phase: 06-data-wiring
plan: 02
subsystem: api, ui
tags: [nextjs, postgresql, react, typescript, status-monitoring, vitest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: pool (PostgreSQL connection from src/lib/db/index.ts)
  - phase: 05-ui-redesign
    provides: Header component pattern, terminal aesthetic (amber-500 palette, font-mono)
provides:
  - GET /api/status endpoint returning per-source DB freshness status
  - StatusBar client component polling /api/status every 60s
  - classify() utility exported for testing freshness thresholds
affects:
  - 06-data-wiring
  - future monitoring/alerting phases

# Tech tracking
tech-stack:
  added: []
  patterns:
    - classify() pure function exported separately from route handler to enable unit testing without HTTP layer
    - Pool.query mocked via vi.mock('@/lib/db/index') pattern for API route unit tests
    - setInterval with useEffect cleanup for polling client components

key-files:
  created:
    - src/app/api/status/route.ts
    - src/app/api/status/route.test.ts
    - src/components/ui/StatusBar.tsx
  modified:
    - src/components/ui/Header.tsx

key-decisions:
  - "Status derived from DB freshness timestamps — no external API pings (avoids rate limit cost)"
  - "classify() exported from route.ts to allow direct unit testing without HTTP overhead"
  - "StatusBar polling: 60s setInterval with useEffect cleanup to prevent memory leaks"
  - "Dot colors: amber-500 live, yellow-400 degraded, red-500 offline, gray-600 loading"

patterns-established:
  - "Route logic exported as pure functions for testability alongside Next.js handler export"
  - "Client polling component: fetch on mount + setInterval + clearInterval cleanup pattern"

requirements-completed:
  - WIRE-05

# Metrics
duration: 5min
completed: 2026-03-13
---

# Phase 6 Plan 02: Status Endpoint and StatusBar Summary

**DB-freshness-based source health API (/api/status) with live polling StatusBar component in dashboard header**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-13T17:29:17Z
- **Completed:** 2026-03-13T17:34:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Built GET /api/status that runs 3 parallel DB freshness queries via Promise.all and classifies each source as live/degraded/offline
- 8 unit tests using vi.mock for pool, all passing without a real DB connection
- Built StatusBar 'use client' component with per-source colored dot indicators, 60s polling, and proper cleanup
- Integrated StatusBar as last child in Header right flex row after NotificationBell

## Task Commits

Each task was committed atomically:

1. **Task 1: Build /api/status route with freshness logic** - `a381d00` (feat)
2. **Task 2: Build StatusBar component and add to Header** - `de8d320` (feat)

**Plan metadata:** (to be added)

_Note: Task 1 used TDD — tests written and confirmed failing before implementation._

## Files Created/Modified
- `src/app/api/status/route.ts` - GET handler + exported classify() with 3 parallel DB queries
- `src/app/api/status/route.test.ts` - 8 unit tests covering live/degraded/offline/null and HTTP response
- `src/components/ui/StatusBar.tsx` - 'use client' polling component with colored dot indicators
- `src/components/ui/Header.tsx` - Added StatusBar import and rendering

## Decisions Made
- Status derived from DB timestamps only — no external API pings to avoid rate limit cost
- classify() exported from route module to allow direct unit testing
- Dot color scheme: amber-500 (live), yellow-400 (degraded), red-500 (offline), gray-600 (loading)
- StatusBar label text uses text-amber-500/60 when active, text-gray-500 when offline/loading

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- /api/status endpoint is live and ready for consumption
- StatusBar visible in header on both dashboard and analytics pages
- Ready to continue with remaining data wiring plans (06-03+)

---
*Phase: 06-data-wiring*
*Completed: 2026-03-13*

## Self-Check: PASSED

- src/app/api/status/route.ts: FOUND
- src/app/api/status/route.test.ts: FOUND
- src/components/ui/StatusBar.tsx: FOUND
- .planning/phases/06-data-wiring/06-02-SUMMARY.md: FOUND
- Commit a381d00: FOUND
- Commit de8d320: FOUND
