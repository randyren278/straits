---
phase: 03-anomaly-detection
plan: 04
subsystem: ui
tags: [react, maplibre, zustand, anomaly-detection, notifications, watchlist]

# Dependency graph
requires:
  - phase: 03-01
    provides: "Anomaly types, schema, geo utilities"
  - phase: 03-02
    provides: "Detection algorithms, cron jobs"
  - phase: 03-03
    provides: "Watchlist/alerts CRUD, APIs, Zustand state"
provides:
  - "AnomalyBadge component with color-coded badges by type/confidence"
  - "NotificationBell with unread count and alert dropdown"
  - "WatchlistPanel sidebar showing watched vessels"
  - "AnomalyFilter toggle for map filtering"
  - "Anomaly section in VesselPanel with watchlist button"
  - "Anomaly-aware marker coloring on map"
  - "/api/anomalies endpoint for fetching active anomalies"
affects: [04-historical-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anomaly badge color mapping: going_dark(red/yellow), loitering(orange), speed(blue)"
    - "localStorage-based user ID for watchlist/alerts association"
    - "Optimistic UI updates with Zustand for watchlist toggle"
    - "MapLibre expression-based circle coloring with anomaly priority"

key-files:
  created:
    - "src/components/ui/AnomalyBadge.tsx"
    - "src/components/ui/NotificationBell.tsx"
    - "src/components/ui/AnomalyFilter.tsx"
    - "src/components/panels/WatchlistPanel.tsx"
    - "src/app/api/anomalies/route.ts"
  modified:
    - "src/components/map/VesselMap.tsx"
    - "src/components/panels/VesselPanel.tsx"
    - "src/components/ui/Header.tsx"
    - "src/lib/map/geojson.ts"
    - "src/lib/db/sanctions.ts"
    - "src/app/(protected)/dashboard/page.tsx"

key-decisions:
  - "Anomaly color priority: going_dark_confirmed > going_dark_suspected > loitering > sanctioned > tanker"
  - "Badge icons: Radio for going_dark, Navigation for loitering, Gauge for speed"
  - "30-second polling interval for alert refresh in NotificationBell"
  - "WatchlistPanel positioned absolute left-4 top-20 for non-interfering sidebar"

patterns-established:
  - "BADGE_CONFIG pattern: nested object mapping type+confidence to bg color, icon, label"
  - "User ID generation: localStorage check with crypto.randomUUID fallback"
  - "Expandable sidebar panels with ChevronUp/ChevronDown toggle"

requirements-completed: [ANOM-01, ANOM-02, HIST-02]

# Metrics
duration: 12min
completed: 2026-03-12
---

# Phase 03 Plan 04: Anomaly Detection UI Summary

**Anomaly badges on map markers, notification bell with alerts, watchlist sidebar, and anomaly filter toggle completing the detection UI**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-12T07:00:00Z (estimated)
- **Completed:** 2026-03-12T07:14:00Z
- **Tasks:** 5 (4 auto + 1 checkpoint)
- **Files modified:** 12

## Accomplishments

- Anomaly API endpoint returning active anomalies with type/confidence
- Color-coded vessel markers on map based on anomaly type (red/yellow/orange/blue)
- AnomalyBadge component with icons and labels by type and confidence
- Anomaly section in VesselPanel showing detection details and timestamp
- Watchlist toggle button in vessel panel with optimistic UI updates
- NotificationBell with unread count badge and alert dropdown
- WatchlistPanel sidebar showing all watched vessels with status
- AnomalyFilter toggle in header for filtering to anomaly vessels only

## Task Commits

Each task was committed atomically:

1. **Task 1: Create anomaly API and extend vessels** - `3aa449b` (feat)
2. **Task 2: Create anomaly badge and update vessel markers** - `e9331c7` (feat)
3. **Task 3: Update vessel panel with anomaly section** - `4be9287` (feat)
4. **Task 4: Create notification bell and watchlist panel** - `df57dce` (feat)
5. **Task 5: Checkpoint - Human Verification** - approved

**Additional fix:** `2ca0144` (fix) - Added WatchlistPanel to dashboard layout

## Files Created/Modified

- `src/app/api/anomalies/route.ts` - API endpoint for fetching active anomalies
- `src/components/ui/AnomalyBadge.tsx` - Reusable badge component with color/icon mapping
- `src/components/ui/NotificationBell.tsx` - Bell with dropdown showing recent alerts
- `src/components/ui/AnomalyFilter.tsx` - Toggle button for anomaly filtering
- `src/components/panels/WatchlistPanel.tsx` - Sidebar panel listing watched vessels
- `src/components/map/VesselMap.tsx` - Updated with anomaly-aware circle coloring
- `src/components/panels/VesselPanel.tsx` - Added anomaly section and watchlist button
- `src/components/ui/Header.tsx` - Added NotificationBell and anomaly filter
- `src/lib/map/geojson.ts` - Extended to include anomaly properties in GeoJSON
- `src/lib/db/sanctions.ts` - Extended vessel query with anomaly LEFT JOIN
- `src/app/(protected)/dashboard/page.tsx` - Added WatchlistPanel to layout

## Decisions Made

- **Anomaly color priority:** going_dark confirmed (red) > suspected (yellow) > loitering (orange) > speed (blue) > sanctioned (red) > tanker (amber)
- **Badge icons:** Radio for AIS gaps, Navigation for loitering, Gauge for speed anomalies
- **Alert refresh:** 30-second polling interval balances freshness and API load
- **Watchlist position:** Absolute left-4 top-20 keeps it accessible without blocking map

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added WatchlistPanel to dashboard layout**
- **Found during:** Post-task 4 verification
- **Issue:** WatchlistPanel created but not imported/rendered in dashboard
- **Fix:** Added import and <WatchlistPanel /> to dashboard page.tsx
- **Files modified:** src/app/(protected)/dashboard/page.tsx
- **Verification:** Panel renders when vessels added to watchlist
- **Committed in:** 2ca0144

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for feature to be visible. No scope creep.

## Issues Encountered

None - plan executed smoothly after blocking fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 complete: anomaly detection fully operational with UI
- All requirements (ANOM-01, ANOM-02, HIST-02) satisfied
- Ready for Phase 4: Historical Analytics
- Data accumulating for trend analysis

## Self-Check: PASSED

All files and commits verified:
- 5/5 created files exist
- 6/6 modified files exist
- 5/5 commits found in git history

---
*Phase: 03-anomaly-detection*
*Completed: 2026-03-12*
