---
phase: 14-panel-intelligence
plan: "02"
subsystem: frontend-panel
tags: [vessel-panel, risk-score, anomaly-history, destination-log, intelligence-dossier]
dependency_graph:
  requires: ["14-01"]
  provides: ["PANL-01", "PANL-02", "PANL-03"]
  affects: ["src/components/panels/VesselPanel.tsx"]
tech_stack:
  added: []
  patterns: ["collapsible-sections", "parallel-fetch", "color-coded-bar-chart"]
key_files:
  created: []
  modified:
    - src/components/panels/VesselPanel.tsx
decisions:
  - "All hooks (useState, useEffect, useCallback) moved before early return to satisfy React rules of hooks"
  - "vesselImo derived before early return so useEffect dependency is stable"
  - "getRiskColor and getBarColor defined as plain functions (not useCallback) since they are pure helpers with no deps"
  - "expandedSections defaults: risk expanded, anomalies/destinations collapsed — risk score is most actionable intel"
metrics:
  duration: "~5 min"
  completed_date: "2026-03-18"
  tasks_completed: 1
  files_modified: 1
---

# Phase 14 Plan 02: Panel Intelligence Dossier Summary

**One-liner:** VesselPanel upgraded to full intelligence dossier with collapsible risk score bar chart, full anomaly history list, and destination change log fetched in parallel from existing APIs.

## What Was Built

Enhanced `src/components/panels/VesselPanel.tsx` with three new collapsible intelligence sections added below the existing anomaly detection section.

### Section 1 — RISK SCORE (PANL-02)
- Collapsible section expanded by default
- Header shows Shield icon + total score (0-100) with color coding: green (<40), yellow (40-69), red (70+)
- Expanded view shows 5-factor bar chart: Going Dark (max 40), Sanctions (max 25), Flag Risk (max 15), Loitering (max 10), STS Events (max 10)
- Each factor bar color-coded by percentage fill
- Shows "Computed N minutes ago" timestamp

### Section 2 — ANOMALY HISTORY (PANL-01)
- Collapsible, collapsed by default; shows count in header
- Scrollable list (max-h-48 overflow-y-auto) in reverse-chronological order from API
- Each row: AnomalyBadge (type + confidence) + detected timestamp
- Shows "Resolved MM/DD HH:mm" when resolved

### Section 3 — DESTINATION LOG (PANL-03)
- Collapsible, collapsed by default; shows count in header
- Scrollable list (max-h-48 overflow-y-auto)
- Each row: "PREVIOUS → NEW" with amber arrow and timestamp

### Data Fetching
- `Promise.all` parallel fetch from `/api/vessels/[imo]/risk` and `/api/vessels/[imo]/history` on vessel select
- `useEffect` gated on `vesselImo` — clears state when no vessel selected
- Error logging via `console.error` with `[VesselPanel]` prefix

### Panel Scroll
- Outermost div changed to `max-h-[calc(100vh-4rem)] overflow-y-auto` to handle tall content

## Decisions Made

- All hooks placed before the `if (!selectedVessel) return null` guard to satisfy React rules of hooks — `vesselImo` derived conditionally using ternary before the guard
- `getRiskColor` and `getBarColor` defined as plain inline functions (not `useCallback`) since they are pure computations with no captured state
- `expandedSections` defaults: `risk: true` (most actionable), `anomalies: false`, `destinations: false` (progressive disclosure)

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 653b2fd | feat(14-02): add risk score, anomaly history, and destination change sections to VesselPanel |

## Self-Check: PASSED
