---
phase: 12-behavioral-pattern-detection
plan: 03
subsystem: database
tags: [postgres, detection, sts-transfer, proximity, behavioral-patterns]

# Dependency graph
requires:
  - phase: 12-02
    provides: detectStsTransfers() implementation and sts_transfer anomaly type

provides:
  - vessel_proximity_events table DDL for sustained co-location tracking
  - Refactored detectStsTransfers() enforcing 30-minute sustained proximity before anomaly fires

affects: [sts-transfer detection, anomaly pipeline, schema migrations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Proximity event tracking: UPSERT with first_seen_at / last_seen_at to measure sustained co-location duration"
    - "Staleness cleanup: DELETE WHERE last_seen_at < NOW() - INTERVAL to remove no-longer-close pairs"
    - "Duration gate: SELECT WHERE last_seen_at - first_seen_at >= INTERVAL before firing anomaly"

key-files:
  created: []
  modified:
    - src/lib/db/schema.sql
    - src/lib/detection/sts-transfer.ts

key-decisions:
  - "STS proximity gate: 35-minute staleness threshold (POSITION_FRESHNESS_MINUTES + 5) accounts for cron timing drift without gaps"
  - "imo_a < imo_b ordering for vessel_proximity_events PK enforced by existing b.imo > a.imo join — no additional app logic needed"
  - "Sustained proximity set built from DB query, not in-memory set, so it works across cron restarts"

patterns-established:
  - "Proximity event table pattern: (imo_a, imo_b, first_seen_at, last_seen_at) PK-deduped by vessel pair"

requirements-completed: [PATT-03]

# Metrics
duration: 1min
completed: 2026-03-18
---

# Phase 12 Plan 03: STS Transfer Sustained Proximity Enforcement Summary

**vessel_proximity_events tracking table added; STS anomaly now requires 30+ minutes of observed co-location before firing — single coincident pings no longer trigger alerts**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-18T14:25:33Z
- **Completed:** 2026-03-18T14:26:43Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `vessel_proximity_events` table to schema.sql with composite PK `(imo_a, imo_b)` and `first_seen_at` / `last_seen_at` columns
- Refactored `detectStsTransfers()` with three-step proximity tracking (upsert, cleanup, duration-gated anomaly fire)
- PATT-03 semantic gap closed: "30 minutes together" is now enforced at the DB level, not just as a position-freshness window

## Task Commits

Each task was committed atomically:

1. **Task 1: Add vessel_proximity_events table and refactor STS detector** - `c83e515` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/db/schema.sql` - Added vessel_proximity_events DDL after idx_dest_changes_imo_time index
- `src/lib/detection/sts-transfer.ts` - Refactored detectStsTransfers() with sustained proximity tracking; updated JSDoc

## Decisions Made
- 35-minute staleness threshold for stale proximity cleanup (POSITION_FRESHNESS_MINUTES + 5 = 35) to tolerate slight cron drift without leaving ghost events
- No separate index on vessel_proximity_events — PK (imo_a, imo_b) covers all lookups (pair lookup by both keys)
- Sustained pairs queried from DB in Step C rather than derived in-memory, so state persists across cron restarts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
Database migration required: run schema.sql against the production/local PostgreSQL instance to create the `vessel_proximity_events` table. The new table is safe to add with `CREATE TABLE IF NOT EXISTS`.

## Next Phase Readiness
- Phase 12 all three plans complete (12-01, 12-02, 12-03)
- PATT-01, PATT-02, PATT-03 requirements all satisfied
- Phase 12 behavioral pattern detection is fully implemented and ready for verification

## Self-Check: PASSED
- src/lib/db/schema.sql: FOUND
- src/lib/detection/sts-transfer.ts: FOUND
- .planning/phases/12-behavioral-pattern-detection/12-03-SUMMARY.md: FOUND
- commit c83e515: FOUND

---
*Phase: 12-behavioral-pattern-detection*
*Completed: 2026-03-18*
