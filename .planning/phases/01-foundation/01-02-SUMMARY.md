---
phase: 01-foundation
plan: 02
subsystem: database
tags: [postgresql, timescaledb, pg, hypertable, crud, typescript]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Type definitions (Vessel, VesselPosition)
provides:
  - Database connection pool with pg
  - TimescaleDB schema with hypertable
  - Position CRUD functions (insert, getHistory, getLatest)
  - Vessel CRUD functions (upsert, get, getAll)
affects: [02-enrichment, 03-monitoring, 04-analytics]

# Tech tracking
tech-stack:
  added: [pg, timescaledb]
  patterns: [connection-pooling, parameterized-queries, upsert-pattern, hypertable-time-series]

key-files:
  created:
    - src/lib/db/index.ts
    - src/lib/db/schema.sql
    - src/lib/db/positions.ts
    - src/lib/db/vessels.ts
    - src/lib/db/index.test.ts
    - src/lib/db/positions.test.ts
    - src/lib/db/vessels.test.ts
  modified: []

key-decisions:
  - "IMO as primary key for vessels (DATA-03) - MMSI can be reused/spoofed"
  - "1-day chunk interval for hypertable - balances query efficiency with management overhead"
  - "7-day compression policy - reduces storage while maintaining query performance"
  - "COALESCE in upsert - preserves existing values when new values are null"

patterns-established:
  - "Parameterized queries: All SQL uses $1, $2 placeholders - prevents SQL injection"
  - "Row extraction: pool.query returns {rows}, functions return result.rows"
  - "Column aliasing: Use AS aliases for camelCase JS properties (nav_status as navStatus)"

requirements-completed: [DATA-02, DATA-03]

# Metrics
duration: 7min
completed: 2026-03-12
---

# Phase 1 Plan 02: Database Schema & CRUD Summary

**TimescaleDB schema with hypertable for position time-series, connection pool, and CRUD functions for vessels/positions**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-12T04:47:09Z
- **Completed:** 2026-03-12T04:53:50Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Created database connection pool with pg (max 20, 30s idle timeout)
- Created TimescaleDB schema with vessels table (IMO primary key) and vessel_positions hypertable
- Implemented position CRUD: insertPosition, getPositionHistory, getLatestPositions
- Implemented vessel CRUD: upsertVessel, getVessel, getAllVessels (with tanker filter)
- All functions use parameterized queries for SQL injection protection
- Added comprehensive tests with mocked database (18 tests passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database connection pool and schema** - `17665ed` (feat)
2. **Task 2: Implement position CRUD functions** - `a4b9bac` (feat)
3. **Task 3: Implement vessel metadata CRUD functions** - `6260b99` (feat)

**Blocking dependency fix:** `dca48fc` (chore) - Added project dependencies and type definitions

## Files Created/Modified

- `src/lib/db/index.ts` - Database connection pool with query helper
- `src/lib/db/schema.sql` - DDL for vessels table and vessel_positions hypertable
- `src/lib/db/positions.ts` - Position CRUD operations
- `src/lib/db/vessels.ts` - Vessel CRUD operations
- `src/lib/db/index.test.ts` - Pool configuration tests
- `src/lib/db/positions.test.ts` - Position function tests
- `src/lib/db/vessels.test.ts` - Vessel function tests

## Decisions Made

- Used IMO as primary key per DATA-03 (MMSI can be reused/spoofed)
- 1-day chunk interval for hypertable (balances query efficiency with chunk management)
- 7-day compression policy (reduces storage while maintaining queryability)
- COALESCE in upsert preserves existing values when new values are null
- Column aliasing (nav_status -> navStatus) for JavaScript conventions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added project dependencies and type definitions**
- **Found during:** Plan start (dependency check)
- **Issue:** Plan 01-01 (project initialization) had not been executed yet, missing TypeScript config, pg dependency, and vessel types
- **Fix:** Installed typescript, pg, vitest, @types/pg; created tsconfig.json, vitest.config.ts, src/types/vessel.ts
- **Files modified:** package.json, tsconfig.json, vitest.config.ts, src/types/vessel.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** dca48fc

---

**Total deviations:** 1 auto-fixed (blocking dependency)
**Impact on plan:** Necessary to proceed - plan depended on 01-01 which wasn't executed. No scope creep.

## Issues Encountered

- Mock setup for pg Pool required using a class (not vi.fn()) because Pool is instantiated with `new`
- Query result extraction needed `.rows` - pool.query returns QueryResult<T> not T[]

## User Setup Required

None - no external service configuration required for the database layer code. Database connection requires DATABASE_URL environment variable at runtime.

## Next Phase Readiness

- Database layer foundation complete
- Ready for AIS ingestion (Plan 03) to use insertPosition/upsertVessel
- Ready for API layer to use get functions
- Schema needs to be applied to actual TimescaleDB instance before runtime

---
*Phase: 01-foundation*
*Completed: 2026-03-12*

## Self-Check: PASSED

All files verified to exist. All commits verified in git history.
