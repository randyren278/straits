---
phase: 11-route-deviation-detection
plan: "01"
subsystem: anomaly-detection
tags: [deviation, geocoding, nominatim, bearing, anomaly, cron]
dependency_graph:
  requires:
    - src/lib/geo/haversine.ts (calculateBearing)
    - src/lib/db/anomalies.ts (upsertAnomaly, resolveAnomaly)
    - src/lib/db/alerts.ts (generateAlertsForNewAnomalies)
    - src/services/ais-ingester/detection-jobs.ts (cron registration)
  provides:
    - detectDeviation() — working route deviation detector
    - geocodeDestination() — Nominatim geocoding with in-memory cache
    - isDeviating() — shortest-arc angular difference helper
  affects:
    - Notification bell (new 'deviation' anomaly type flows through existing pipeline)
    - Map badges (AnomalyBadge already handles 'deviation' type)
    - Vessel panel (anomaly details panel already handles DeviationDetails)
tech_stack:
  added: []
  patterns:
    - Nominatim geocoding with in-memory Map cache (avoid redundant API calls)
    - Shortest-arc angular difference for 0/360 wrap-around handling
    - Sustained deviation window: ALL positions in 2-hour window must deviate
    - Auto-resolve pattern: resolveAnomaly() called when heading corrects
key_files:
  created: []
  modified:
    - src/lib/detection/deviation.ts
    - src/services/ais-ingester/detection-jobs.ts
    - src/lib/detection/deviation.test.ts
decisions:
  - "Nominatim geocoding with in-memory Map cache — avoids redundant API calls per destination string"
  - "Sustained deviation: ALL positions in 2-hour window must deviate (not just latest) — reduces false positives"
  - "User-Agent: TankerTracker/1.0 required by Nominatim usage policy"
  - "Auto-resolve when heading corrects — no manual intervention needed"
  - "suspected confidence for deviation anomalies — geocoding adds uncertainty"
metrics:
  duration: 2 minutes
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_modified: 3
---

# Phase 11 Plan 01: Route Deviation Detection Summary

**One-liner:** Nominatim geocoding + bearing comparison detects vessels whose heading diverges >45° from declared destination for 2+ hours, with in-memory cache and auto-resolve.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement detectDeviation() with Nominatim geocoding and bearing comparison | acb1749 | src/lib/detection/deviation.ts |
| 2 | Register deviation detection in 30-minute cron and wire alert generation | 5f4d71d | src/services/ais-ingester/detection-jobs.ts, src/lib/detection/deviation.test.ts |

## What Was Built

### Task 1 — detectDeviation() implementation

Replaced the stub in `src/lib/detection/deviation.ts` with a full implementation:

- **`geocodeDestination(destination)`** — queries `nominatim.openstreetmap.org` with `User-Agent: TankerTracker/1.0`, caches results (including nulls) in a module-level `Map<string, {lat,lon}|null>` to avoid redundant API calls
- **`isDeviating(actualHeading, expectedHeading)`** — computes shortest-arc angular difference (handles 0/360 wrap-around), returns `true` if > 45°
- **`detectDeviation()`** — queries vessels with 2+ positions in last 2 hours + non-null destination; for each vessel geocodes destination, checks all positions against expected bearing via `calculateBearing()`, upserts `deviation` anomaly with `suspected` confidence when sustained divergence detected, auto-resolves when heading corrects

Existing `isSpeedAnomaly()` and `detectSpeedAnomaly()` functions are untouched.

### Task 2 — Cron registration and alert wiring

Updated `src/services/ais-ingester/detection-jobs.ts`:
- Added `detectDeviation` to import alongside `detectSpeedAnomaly`
- Added `const deviationCount = await detectDeviation()` in `*/30` cron callback
- Added `generateAlertsForNewAnomalies('deviation')` to alert pipeline
- Updated log strings to include deviation counts and schedule mention

Updated test file to replace broken stub test with real behavioral tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated broken stub test in deviation.test.ts**
- **Found during:** Task 2 commit
- **Issue:** Existing test `returns 0 (stub for v1)` would fail since detectDeviation() now queries the DB and geocodes destinations. Also missing mock for `resolveAnomaly` and `calculateBearing`.
- **Fix:** Added mocks for `resolveAnomaly` and `calculateBearing`, replaced stub test with behavioral tests for `isDeviating`, `geocodeDestination`, and `detectDeviation` (17 tests total, all pass)
- **Files modified:** src/lib/detection/deviation.test.ts
- **Commit:** 5f4d71d

## Verification Results

- TypeScript: `npx tsc --noEmit` passes on both modified files (no errors)
- Pattern check: `detectDeviation` defined in deviation.ts, called in detection-jobs.ts
- Alert pipeline: `generateAlertsForNewAnomalies` now invoked for 'going_dark', 'loitering', 'speed', 'deviation'
- Test suite: 17 tests pass (vitest run)
- No UI changes needed: existing anomaly pipeline handles 'deviation' type automatically

## Self-Check: PASSED

Files verified present:
- src/lib/detection/deviation.ts — FOUND
- src/services/ais-ingester/detection-jobs.ts — FOUND
- src/lib/detection/deviation.test.ts — FOUND

Commits verified:
- acb1749 (Task 1) — FOUND
- 5f4d71d (Task 2) — FOUND
