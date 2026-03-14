---
phase: quick-9
plan: 9
subsystem: vessel-filter
tags: [sql, filter, vessel-panel, null-handling]
dependency_graph:
  requires: []
  provides: [tankersOnly-null-inclusive-filter, vessel-type-display]
  affects: [getVesselsWithSanctions, VesselPanel]
tech_stack:
  added: []
  patterns: [null-safe-sql-or, explicit-null-check-tsx]
key_files:
  created: []
  modified:
    - src/lib/db/sanctions.ts
    - src/components/panels/VesselPanel.tsx
decisions:
  - "tankersOnly filter now uses (ship_type IS NULL OR ship_type BETWEEN 80 AND 89) — unclassified ships are operator-visible, not silently dropped"
  - "VesselPanel Type field uses explicit null check (== null) rather than implicit ?? fallback; non-tanker types render as 'Type N' not raw number"
metrics:
  duration: "<1 min"
  completed_date: "2026-03-14"
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 9: Fix Tanker Filter to Include Unclassified Vessels — Summary

**One-liner:** SQL tankersOnly filter changed to `(ship_type IS NULL OR BETWEEN 80 AND 89)` so ~92 unclassified vessels appear on the map instead of being silently dropped.

## What Was Done

The tankersOnly mode in `getVesselsWithSanctions` was filtering with `WHERE v.ship_type IS NOT NULL AND v.ship_type BETWEEN 80 AND 89`. Vessels with NULL ship_type (ships that broadcast position but never sent ShipStaticData) were silently excluded — these are exactly the unclassified ships most worth watching in the Middle East.

The fix also tightened the VesselPanel Type field: the old `?? 'Unknown'` implicit fallback was made explicit, and non-tanker ships with known type codes now render as "Type 70" instead of the raw number "70".

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix tankersOnly SQL filter to include NULL ship_type | 09c3126 | src/lib/db/sanctions.ts |
| 2 | Verify VesselPanel handles NULL shipType gracefully | e76bc44 | src/components/panels/VesselPanel.tsx |

## Changes

### src/lib/db/sanctions.ts
- `WHERE v.ship_type IS NOT NULL AND v.ship_type BETWEEN 80 AND 89` → `WHERE (v.ship_type IS NULL OR v.ship_type BETWEEN 80 AND 89)`
- Updated function comment to document that tankersOnly includes unclassified vessels

### src/components/panels/VesselPanel.tsx
- Replaced `shipType != null && ... ? ... : (shipType ?? 'Unknown')` with explicit three-branch ternary
- NULL → `'Unknown'`; 80-89 → `'Tanker (8X)'`; other → `'Type N'`

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes clean after both tasks
- `grep -n "ship_type IS NULL" src/lib/db/sanctions.ts` confirms filter on line 152
- `grep -n "Unknown" src/components/panels/VesselPanel.tsx` confirms explicit null label on line 122

## Self-Check: PASSED

- [x] `src/lib/db/sanctions.ts` modified — confirmed
- [x] `src/components/panels/VesselPanel.tsx` modified — confirmed
- [x] Commit 09c3126 exists
- [x] Commit e76bc44 exists
