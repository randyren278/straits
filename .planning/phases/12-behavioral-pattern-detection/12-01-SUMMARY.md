---
phase: 12-behavioral-pattern-detection
plan: "01"
subsystem: anomaly-types, schema, ais-ingester
tags: [types, schema, ingester, behavioral-patterns]
dependency_graph:
  requires: []
  provides: [repeat_going_dark type, sts_transfer type, vessel_destination_changes table, destination change detection]
  affects: [anomaly detection pipeline, AIS ingester, AnomalyBadge UI]
tech_stack:
  added: []
  patterns: [discriminated union extension, pre-upsert SELECT for change detection, try/catch isolation]
key_files:
  created: []
  modified:
    - src/types/anomaly.ts
    - src/lib/db/schema.sql
    - src/services/ais-ingester/index.ts
    - src/components/ui/AnomalyBadge.tsx
decisions:
  - "Destination change detection: pre-upsert SELECT captures old value before COALESCE overwrites it"
  - "Only non-null to non-null transitions logged — NULL-to-value transitions are noise (first-seen vessels)"
  - "Case-insensitive trimmed comparison prevents duplicate logging for whitespace/case-variant destinations"
  - "try/catch isolation: destination change logging errors do not break the main upsert flow"
  - "AnomalyBadge extended in same plan to keep TypeScript compilation green"
metrics:
  duration: "2 min"
  completed: "2026-03-18T05:44:22Z"
  tasks_completed: 2
  files_modified: 4
---

# Phase 12 Plan 01: Behavioral Pattern Detection Foundation Summary

Extended anomaly types with repeat_going_dark and sts_transfer, added vessel_destination_changes DDL to schema.sql, and wired destination change detection into the AIS ingester upsert path.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend anomaly types and database schema | 86ac767 | src/types/anomaly.ts, src/lib/db/schema.sql |
| 2 | Add destination change detection to AIS ingester | 46fbef9 | src/services/ais-ingester/index.ts, src/components/ui/AnomalyBadge.tsx |

## What Was Built

### Type Extensions (src/types/anomaly.ts)
- `AnomalyType` union extended: added `'repeat_going_dark'` and `'sts_transfer'`
- `RepeatGoingDarkDetails` interface: `goingDarkCount`, `windowDays`, `recentEvents` (array of detectedAt/resolvedAt pairs)
- `StsTransferDetails` interface: `otherImo`, `otherName`, `distanceKm`, `lat`, `lon`
- `Anomaly.details` and `UpsertAnomalyInput.details` unions updated to include both new detail types

### Schema Extension (src/lib/db/schema.sql)
- Phase 12 section comment added
- `vessel_destination_changes` table: `id`, `imo`, `previous_destination`, `new_destination`, `changed_at`
- Index `idx_dest_changes_imo_time` on `(imo, changed_at DESC)` for efficient per-vessel history

### Ingester Change Detection (src/services/ais-ingester/index.ts)
- `upsertVessel()` now SELECTs current destination before the upsert
- After upsert: compares old vs new destination (case-insensitive, trimmed)
- Logs to `vessel_destination_changes` only when both are non-null and differ
- Error isolation: destination change INSERT is wrapped in try/catch

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended AnomalyBadge to support new anomaly types**
- **Found during:** Task 2 TypeScript verification (`npx tsc --noEmit`)
- **Issue:** `AnomalyBadge` component had hardcoded `type` prop restricted to 4 original types — extending `AnomalyType` caused 3 compile errors in VesselPanel, WatchlistPanel, NotificationBell
- **Fix:** Extended `AnomalyBadgeProps.type` union to include `repeat_going_dark` and `sts_transfer`, added badge configs (red-600 for repeat dark pattern, purple-600 for STS transfer)
- **Files modified:** src/components/ui/AnomalyBadge.tsx
- **Commit:** 46fbef9

## Verification

- `npx tsc --noEmit`: PASSED
- `grep "repeat_going_dark"` in anomaly.ts: FOUND
- `grep "sts_transfer"` in anomaly.ts: FOUND
- `grep "vessel_destination_changes"` in schema.sql: FOUND (2 lines — table + index)
- `grep "vessel_destination_changes"` in ingester: FOUND

## Self-Check: PASSED

- src/types/anomaly.ts: modified and committed (86ac767)
- src/lib/db/schema.sql: modified and committed (86ac767)
- src/services/ais-ingester/index.ts: modified and committed (46fbef9)
- src/components/ui/AnomalyBadge.tsx: modified and committed (46fbef9)
- Both commits confirmed in git log
