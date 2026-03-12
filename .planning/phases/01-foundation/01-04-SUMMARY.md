---
phase: 01-foundation
plan: 04
subsystem: data-ingestion
tags: [ais, websocket, gps-filter, timescale, streaming]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: TypeScript types (VesselPosition, Vessel, AISMessage)
  - phase: 01-foundation/01-02
    provides: Database tables (vessel_positions, vessels) and insertPosition/upsertVessel functions
provides:
  - AIS message parser (parsePositionReport, parseShipStaticData, parseAISMessage)
  - GPS quality filter (filterPosition, isInJammingZone)
  - Standalone AIS ingestion service with WebSocket to AISStream.io
affects: [02-features, 03-anomaly-detection]

# Tech tracking
tech-stack:
  added: [ws, pg, dotenv, tsx]
  patterns: [standalone-service, websocket-reconnect, gps-jamming-zones]

key-files:
  created:
    - src/lib/ais/parser.ts
    - src/lib/ais/filter.ts
    - src/services/ais-ingester/index.ts
    - src/services/ais-ingester/package.json
  modified:
    - src/lib/ais/parser.test.ts
    - src/lib/ais/filter.test.ts

key-decisions:
  - "Standalone service for Railway/Render - Vercel cannot maintain WebSocket connections"
  - "50 knot speed limit for filtering - tankers rarely exceed 20 knots"
  - "Flag jamming zone positions as low_confidence, don't discard"
  - "COALESCE pattern in upsert preserves existing vessel metadata when null"

patterns-established:
  - "GPS jamming zone detection: bounding box check with configurable zones"
  - "WebSocket auto-reconnect: 5 second delay on close"
  - "Standalone service pattern: separate package.json, self-contained types"

requirements-completed: [DATA-01, DATA-03, DATA-04]

# Metrics
duration: 3min
completed: 2026-03-12
---

# Phase 1 Plan 4: AIS Data Ingestion Summary

**AIS message parser and GPS filter with TDD, plus standalone WebSocket ingestion service for Railway/Render deployment**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T05:05:08Z
- **Completed:** 2026-03-12T05:08:29Z
- **Tasks:** 3
- **Files created:** 4
- **Files modified:** 2

## Accomplishments
- AIS parser extracts position and vessel data from AISStream.io message format
- GPS filter rejects impossible speeds (>50 knots) and flags jamming zones
- Standalone ingestion service connects to AISStream.io WebSocket with auto-reconnect
- 27 unit tests covering all parser and filter functionality

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement AIS message parser** - `f825ca5` (feat - TDD)
2. **Task 2: Implement GPS data quality filter** - `8ae1025` (feat - TDD)
3. **Task 3: Create standalone AIS ingestion service** - `8a28ca2` (feat)

## Files Created/Modified
- `src/lib/ais/parser.ts` - AIS message parser with discriminated union result type
- `src/lib/ais/parser.test.ts` - 12 tests for parser edge cases
- `src/lib/ais/filter.ts` - GPS quality filter with jamming zone detection
- `src/lib/ais/filter.test.ts` - 15 tests for filter and zone detection
- `src/services/ais-ingester/index.ts` - Standalone WebSocket ingestion service
- `src/services/ais-ingester/package.json` - Service dependencies and scripts

## Decisions Made
- **Standalone service architecture:** Vercel serverless cannot maintain persistent WebSocket connections (per research pitfall #3). Service runs on Railway/Render with its own package.json.
- **50 knot speed threshold:** Tankers rarely exceed 20 knots; anything above 50 is clearly GPS error.
- **Flag, don't discard jamming zones:** Per CONTEXT.md, positions in Persian Gulf and Red Sea are marked low_confidence but still stored for analysis.
- **Self-contained types:** Ingester service defines its own types instead of importing from main project to avoid bundling complexity.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed as specified.

## User Setup Required

**External services require configuration for the AIS ingester:**

1. **AISStream.io API Key:**
   - Register at https://aisstream.io/
   - Get API key from dashboard
   - Set `AISSTREAM_API_KEY` environment variable

2. **Railway/Render Deployment:**
   - Create new project
   - Point to `src/services/ais-ingester` directory
   - Set environment variables:
     - `DATABASE_URL` - PostgreSQL connection string
     - `AISSTREAM_API_KEY` - AISStream.io API key
   - Platform auto-runs `npm start`

## Next Phase Readiness
- AIS data pipeline complete (parser, filter, ingester)
- Position and vessel metadata flow ready for map display (Phase 1 Plan 5)
- Low-confidence flagging enables anomaly detection (Phase 3)
- Foundation for sanctions matching via IMO lookup (Phase 2)

---
*Phase: 01-foundation*
*Completed: 2026-03-12*

## Self-Check: PASSED

All created files verified to exist. All commits verified in git history.
