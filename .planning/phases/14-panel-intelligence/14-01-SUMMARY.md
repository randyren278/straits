---
phase: 14-panel-intelligence
plan: 01
subsystem: api, notifications
tags: [vessel-history, anomalies, destination-changes, sts-transfer, notification-bell]
dependency_graph:
  requires: []
  provides: [vessel-history-api, sts-notification-names]
  affects: [plan-02-vessel-panel-ui]
tech_stack:
  added: []
  patterns: [next-js-16-async-params, promise-all-parallel-queries]
key_files:
  created:
    - src/app/api/vessels/[imo]/history/route.ts
  modified:
    - src/components/ui/NotificationBell.tsx
decisions:
  - "vessel history endpoint returns all anomalies (no resolved_at IS NULL filter) — panel needs full historical view not just active alerts"
  - "Promise.all for parallel anomalies + destination changes queries — independent tables, no ordering dependency"
  - "STS partner vessel shown inline after primary IMO with fallback chain: otherName -> otherImo -> 'unknown'"
metrics:
  duration: 2 min
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_changed: 2
requirements:
  - PANL-01
  - PANL-03
  - PANL-04
---

# Phase 14 Plan 01: Vessel History API and STS Notification Names Summary

**One-liner:** GET /api/vessels/[imo]/history endpoint returning full anomaly + destination change history, plus STS partner vessel display in notification bell.

## What Was Built

**Task 1 — GET /api/vessels/[imo]/history:**
Created new API endpoint at `src/app/api/vessels/[imo]/history/route.ts`. Runs two parallel queries (via `Promise.all`) against `vessel_anomalies` and `vessel_destination_changes`, both filtered by IMO and ordered reverse-chronologically. Returns all anomalies including resolved ones — no `resolved_at IS NULL` filter — because the vessel panel needs full historical view.

**Task 2 — STS alert display in NotificationBell:**
Updated `src/components/ui/NotificationBell.tsx` to conditionally render the STS partner vessel identity for `sts_transfer` anomalies. Adds an inline `+ VESSEL NAME` after the primary vessel IMO and a `Proximity with [name]` description line below the AnomalyBadge. Falls back to `otherImo` then "unknown vessel" when the name is absent.

## Decisions Made

1. **All anomalies, not just active:** The history endpoint omits `resolved_at IS NULL` so the panel can show complete event history — active + resolved. The existing `/api/anomalies` endpoint already handles the active-only case.

2. **Promise.all for parallel queries:** The two table queries (`vessel_anomalies`, `vessel_destination_changes`) are independent, so running them in parallel halves the round-trip latency.

3. **STS fallback chain:** `otherName || otherImo || 'unknown'` handles incomplete JSONB details gracefully without throwing or showing empty spans.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All 5 plan verification checks passed:
- `src/app/api/vessels/[imo]/history/route.ts` exists
- Queries `vessel_anomalies` table
- Queries `vessel_destination_changes` table
- `NotificationBell.tsx` contains `otherName` references
- TypeScript compiles clean (`npx tsc --noEmit` — no errors)

## Self-Check: PASSED

Files exist:
- FOUND: src/app/api/vessels/[imo]/history/route.ts
- FOUND: src/components/ui/NotificationBell.tsx (modified)

Commits exist:
- 7fb72dd — feat(14-01): create GET /api/vessels/[imo]/history endpoint
- aa53354 — feat(14-01): show both vessel names in STS notification bell alerts
