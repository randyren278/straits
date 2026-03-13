---
phase: 06-data-wiring
plan: 01
subsystem: ais-ingester
tags: [cron, data-wiring, prices, news, sanctions, ingester]
dependency_graph:
  requires:
    - src/lib/prices/fetcher.ts
    - src/lib/db/prices.ts
    - src/lib/news/fetcher.ts
    - src/lib/db/news.ts
    - src/lib/external/opensanctions.ts
    - src/lib/db/sanctions.ts
    - src/services/ais-ingester/detection-jobs.ts
  provides:
    - src/services/ais-ingester/refresh-jobs.ts
    - npm run ingester (root script)
  affects:
    - src/services/ais-ingester/index.ts
    - package.json
    - src/services/ais-ingester/package.json
tech_stack:
  added:
    - tsx (root devDependency for running TypeScript ingester)
    - node-cron (added to ingester package.json for standalone deploys)
  patterns:
    - Eager startup fetch before scheduling crons (prevents cold-start empty UI)
    - Relative imports only in ingester (no @/ alias — runs outside Next.js)
    - try/catch on every async cron body — errors logged, process never crashes
key_files:
  created:
    - src/services/ais-ingester/refresh-jobs.ts
    - src/services/ais-ingester/refresh-jobs.test.ts
  modified:
    - src/services/ais-ingester/index.ts
    - package.json
    - src/services/ais-ingester/package.json
decisions:
  - Eager startup fetch runs all three fetchers immediately on startRefreshJobs() call so UI shows data without waiting for first cron tick
  - Relative imports only (../../lib/...) — @/ alias won't resolve in standalone Node.js ingester process
  - Prices every 6h (8/day, within Alpha Vantage 25/day free tier)
  - News every 30m (48/day, within NewsAPI 100/day limit)
  - Sanctions daily at 2AM (OpenSanctions CSV, no rate limit concern)
metrics:
  duration: "2 min"
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_changed: 5
---

# Phase 6 Plan 01: Refresh Jobs and Ingester Script Summary

**One-liner:** Background cron jobs for prices (6h), news (30m), and sanctions (daily) wired into the AIS ingester with eager startup fetch using node-cron and relative imports.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create refresh-jobs.ts and test scaffold (TDD) | 700c31d | refresh-jobs.ts, refresh-jobs.test.ts |
| 2 | Wire refresh jobs into ingester and fix package.json scripts | 6c64c4d | index.ts, package.json, ais-ingester/package.json |

## What Was Built

### refresh-jobs.ts

Exports `startRefreshJobs()` following the same pattern as `detection-jobs.ts`. When called:

1. **Eager fetch** — calls all three fetchers immediately (prices, news, sanctions) so the UI is populated before any cron fires
2. **Prices cron** — `0 */6 * * *` every 6 hours; calls `fetchOilPrices()` + `insertPrice()` per result
3. **News cron** — `*/30 * * * *` every 30 minutes; calls `fetchNews()` + `insertNewsItem()` per headline
4. **Sanctions cron** — `0 2 * * *` daily at 2AM; calls `fetchSanctionsList()` + `upsertSanction()` per entry

All cron callbacks are wrapped in try/catch — errors are logged but the process never crashes.

### package.json scripts

Added to root `package.json`:
```json
"ingester": "tsx src/services/ais-ingester/index.ts",
"ingester:dev": "tsx watch src/services/ais-ingester/index.ts"
```

`tsx` added to `devDependencies`. `node-cron ^4.0.0` added to `src/services/ais-ingester/package.json` for standalone Railway/Render deploys.

### index.ts wiring

`startRefreshJobs()` called immediately after `startDetectionJobs()` inside `ws.on('open', ...)`.

## Tests

- 4 passing: no-throw, fetchOilPrices called, fetchNews called, fetchSanctionsList called
- 3 todo: cron timer tests (require fake timers — scoped out per plan)
- Full suite: 350 tests passing, 34 test files

## Deviations from Plan

None — plan executed exactly as written.

## Success Criteria

- [x] WIRE-01: `npm run ingester` script exists at project root
- [x] WIRE-02: Prices refresh cron wired; eager fetch on startup populates DB immediately
- [x] WIRE-03: News refresh cron wired; eager fetch on startup populates DB immediately
- [x] WIRE-04: Sanctions refresh cron wired; eager fetch populates `vessel_sanctions` on startup
- [x] All tests green (350 passing)
