---
phase: 01-foundation
plan: 05
subsystem: ui
tags: [mapbox, geojson, zustand, webgl, typescript, react]

# Dependency graph
requires:
  - phase: 01-02
    provides: TimescaleDB schema and vessel/position CRUD functions
  - phase: 01-03
    provides: JWT authentication and protected route middleware
  - phase: 01-04
    provides: AIS ingestion service populating position data
provides:
  - Interactive WebGL map with live vessel positions
  - Vessel detail panel with identity information
  - Tanker filter toggle (shipType 80-89)
  - Track history polyline rendering
  - Data freshness indicator with color coding
  - Responsive mobile layout with bottom sheet
affects: [phase-2-intelligence, chokepoint-widgets, vessel-search]

# Tech tracking
tech-stack:
  added: [mapbox-gl, zustand, date-fns]
  patterns: [geojson-conversion, zustand-store, responsive-panel]

key-files:
  created:
    - src/components/map/VesselMap.tsx
    - src/components/map/TrackLayer.tsx
    - src/components/map/VesselLayer.tsx
    - src/components/panels/VesselPanel.tsx
    - src/components/ui/DataFreshness.tsx
    - src/components/ui/TankerFilter.tsx
    - src/components/ui/Header.tsx
    - src/lib/map/geojson.ts
    - src/lib/map/filter.ts
    - src/lib/map/tracks.ts
    - src/stores/vessel.ts
    - src/app/api/vessels/route.ts
    - src/app/api/positions/[mmsi]/route.ts
    - src/app/(protected)/dashboard/page.tsx
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/lib/map/geojson.test.ts
    - src/lib/map/filter.test.ts
    - src/lib/map/tracks.test.ts

key-decisions:
  - "Mapbox dark-v11 style for Bloomberg-terminal aesthetic"
  - "30-second polling interval for vessel position updates"
  - "Zustand for global state (selectedVessel, tankersOnly, showTrack)"
  - "GeoJSON FeatureCollection format for Mapbox source data"
  - "Responsive bottom sheet panel on mobile (max-md breakpoint)"

patterns-established:
  - "GeoJSON conversion: vesselsToGeoJSON converts typed arrays to FeatureCollection"
  - "Filter pattern: filterTankers checks shipType range 80-89"
  - "Track building: buildTrackLine creates LineString from position history"
  - "Store pattern: useVesselStore zustand hook for cross-component state"

requirements-completed: [MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-08]

# Metrics
duration: 15min
completed: 2026-03-11
---

# Phase 1 Plan 05: Interactive Map Dashboard Summary

**WebGL map with Mapbox GL JS showing live vessel positions, click-to-inspect panel, tanker filtering, track history polylines, and responsive mobile layout**

## Performance

- **Duration:** ~15 min (across checkpoint)
- **Started:** 2026-03-11T06:00:00Z
- **Completed:** 2026-03-11T06:15:00Z
- **Tasks:** 4 (3 auto + 1 checkpoint)
- **Files modified:** 19

## Accomplishments

- Interactive WebGL map centered on Strait of Hormuz with dark theme
- Vessel markers colored amber (tankers) / gray (other) with click-to-select
- Side panel showing vessel identity: name, IMO, MMSI, flag, speed, heading, destination
- Track history polyline toggle fetching 24h position history
- Data freshness indicator with green/yellow/red color coding
- Responsive layout: bottom sheet panel on mobile devices
- API endpoints for vessels and position history
- Zustand store managing global UI state

## Task Commits

Each task was committed atomically:

1. **Task 1: Create map utility functions and API endpoints** - `8101ac3` (feat)
2. **Task 2: Create map components with Mapbox GL JS** - `1009225` (feat)
3. **Task 3: Create UI components and dashboard layout** - `c837620` (feat)
4. **Task 4: Checkpoint - Human Verification** - approved

## Files Created/Modified

**Map Utilities:**
- `src/lib/map/geojson.ts` - Converts VesselWithPosition[] to GeoJSON FeatureCollection
- `src/lib/map/filter.ts` - Filters vessels by shipType (tankers: 80-89)
- `src/lib/map/tracks.ts` - Builds LineString from position history

**Map Components:**
- `src/components/map/VesselMap.tsx` - Main Mapbox GL JS map with vessel source and layer
- `src/components/map/TrackLayer.tsx` - Track history polyline layer
- `src/components/map/VesselLayer.tsx` - Vessel marker layer configuration

**UI Components:**
- `src/components/panels/VesselPanel.tsx` - Vessel detail side panel
- `src/components/ui/DataFreshness.tsx` - Last update indicator with color coding
- `src/components/ui/TankerFilter.tsx` - Tanker only toggle button
- `src/components/ui/Header.tsx` - Dashboard header with title and controls

**API Routes:**
- `src/app/api/vessels/route.ts` - Returns vessels with latest positions
- `src/app/api/positions/[mmsi]/route.ts` - Returns position history for track

**State Management:**
- `src/stores/vessel.ts` - Zustand store for selectedVessel, tankersOnly, showTrack, lastUpdate

**Dashboard:**
- `src/app/(protected)/dashboard/page.tsx` - Main dashboard page composing all components

**Modified:**
- `src/app/globals.css` - Added Mapbox GL CSS import
- `src/app/layout.tsx` - Dark theme defaults

## Decisions Made

- **Mapbox dark-v11:** Chosen for "Bloomberg-terminal-meets-command-center" aesthetic per CONTEXT.md
- **30-second polling:** Balance between freshness and API load (not real-time WebSocket for map)
- **Zustand over Context:** Lightweight, no boilerplate, works with React 19
- **GeoJSON source:** Standard format for Mapbox layers, enables dynamic updates
- **Bottom sheet on mobile:** Better touch UX than narrow side panel, uses max-md breakpoint

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully.

## User Setup Required

**External services require manual configuration.** The plan references Mapbox:

- **NEXT_PUBLIC_MAPBOX_TOKEN**: Required in `.env.local`
  - Source: Mapbox account -> Access tokens -> Create token (public scope)
  - Without this, map will not render

## Next Phase Readiness

- **Phase 1 Complete:** All 5 plans executed successfully
- **Data Pipeline:** AIS ingestion service ready to populate positions
- **Authentication:** Password-protected access working
- **Map Dashboard:** Live vessel visualization operational
- **Ready for Phase 2:** Intelligence layers (sanctions, prices, news, search, chokepoints)

---
*Phase: 01-foundation*
*Completed: 2026-03-11*

## Self-Check: PASSED

All files verified to exist:
- src/components/map/VesselMap.tsx
- src/components/map/TrackLayer.tsx
- src/components/panels/VesselPanel.tsx
- src/components/ui/DataFreshness.tsx
- src/lib/map/geojson.ts
- src/stores/vessel.ts
- src/app/api/vessels/route.ts
- src/app/(protected)/dashboard/page.tsx

All commits verified to exist:
- 8101ac3 (Task 1)
- 1009225 (Task 2)
- c837620 (Task 3)
