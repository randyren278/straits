---
phase: quick-4
plan: 01
subsystem: api
tags: [oil-prices, fallback, database, vitest, tdd]

requires:
  - phase: 06-data-wiring
    provides: getLatestPrices DB helper returning price rows with history

provides:
  - fetchOilPrices with DB last-known fallback when both Alpha Vantage and FRED are unavailable

affects:
  - OilPricePanel (no longer shows empty state on API failure if DB has prior data)

tech-stack:
  added: []
  patterns:
    - "DB last-known fallback: query DB and map rows to API shape after dual external API failure"

key-files:
  created: []
  modified:
    - src/lib/prices/fetcher.ts
    - src/lib/prices/fetcher.test.ts

key-decisions:
  - "DB fallback does not insert to DB — avoids overwriting fresh data with stale rows"
  - "Fallback only activates after BOTH external APIs throw, preserving normal API behavior"

patterns-established:
  - "Map DB rows to OilPriceData shape: symbol, current: price, change, changePercent, history with new Date()"

requirements-completed: [WIRE-02]

duration: 5min
completed: 2026-03-14
---

# Quick Task 4: Persist Last Known Oil Price Summary

**fetchOilPrices falls back to last-known DB rows (via getLatestPrices) when both Alpha Vantage and FRED are unavailable, preventing $0.00/empty panel on API failure**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-14T22:34:00Z
- **Completed:** 2026-03-14T22:39:00Z
- **Tasks:** 1 (TDD)
- **Files modified:** 2

## Accomplishments

- Added `getLatestPrices` import to `fetcher.ts` and DB fallback in the outer catch block
- DB rows mapped to `OilPriceData` shape without inserting stale data back to DB
- TDD cycle: failing test added first, then implementation made all 5 tests pass

## Task Commits

1. **Task 1: Add DB last-known fallback to fetchOilPrices** - `0675c75` (feat)

## Files Created/Modified

- `src/lib/prices/fetcher.ts` - Added `getLatestPrices` import and DB fallback after dual-API failure
- `src/lib/prices/fetcher.test.ts` - Added mock for `../db/prices`, updated empty-DB test, added new DB fallback test case

## Decisions Made

- DB fallback does not insert back to DB to avoid overwriting real data with stale cached rows
- `date: new Date()` used for history entries from DB (actual fetched_at not in the history shape returned by `getLatestPrices`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx jest` was invoked initially but project uses Vitest — corrected to `npx vitest run`. No code change required.

## Next Phase Readiness

- OilPricePanel will now display last-known prices on API failure as long as DB has been populated at least once
- No follow-up work needed

---
*Phase: quick-4*
*Completed: 2026-03-14*
