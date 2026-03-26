---
id: S01
parent: M010
milestone: M010
provides:
  - Anomalies API staleness parity with map, positions, sanctions, and chokepoints
requires:
  []
affects:
  []
key_files:
  - src/app/api/anomalies/route.ts
  - src/lib/constants/staleness.ts
key_decisions:
  - EXISTS subquery placed before shipTypeClause and imo filter so it always applies regardless of optional params
patterns_established:
  - (none)
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M010/slices/S01/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-03-26T20:00:58.839Z
blocker_discovered: false
---

# S01: Anomalies Staleness Filter & Data Parity

**Anomalies API now filters to vessels with positions within VESSEL_STALENESS_INTERVAL, closing the data parity gap between map and fleet views.**

## What Happened

The anomalies API route (`/api/anomalies`) was the last current-state display query missing staleness filtering. The map, positions, sanctions, and chokepoints endpoints all filtered to vessels seen within the staleness window, but the anomalies route returned all unresolved anomalies regardless of vessel position recency. This meant the fleet tab showed anomalies for vessels that didn't appear on the map — a data parity gap.

T01 added an EXISTS subquery to the anomalies route SQL using the established IMO→MMSI bridge join pattern. The subquery joins `vessel_positions` → `vessels` via MMSI to bridge back to the anomaly's IMO, filtering out anomalies where the vessel has no position data within `VESSEL_STALENESS_INTERVAL` (7 days). The EXISTS clause is placed before the optional `shipTypeClause` and `imo` parameter filters so it always applies. The implementation imports from the shared `src/lib/constants/staleness.ts` module, maintaining the single-source-of-truth pattern established in M008.

Detection intervals and analytics windows were confirmed untouched — the staleness audit via `rg` shows the constants are consumed only by display queries.

## Verification

TypeScript compilation clean (`npx tsc --noEmit` exit 0). Staleness audit via `rg 'STALENESS_INTERVAL' src/` confirms `anomalies/route.ts` now appears alongside `positions.ts`, `sanctions.ts`, `chokepoints.ts`. Detection files confirmed untouched (`git diff --name-only src/lib/detection/` empty). Analytics file does not import staleness constants.

## Requirements Advanced

- R001 — All current-state vessel queries (map, fleet, anomalies) now use VESSEL_STALENESS_INTERVAL
- R002 — Anomalies parity ensures fleet tab data is consistent with map and chokepoint views

## Requirements Validated

- R003 — EXISTS staleness subquery added to /api/anomalies. TypeScript compiles clean. Staleness audit confirms anomalies/route.ts consumes VESSEL_STALENESS_INTERVAL from shared constants.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

None.

## Known Limitations

None. All current-state display queries now use the shared staleness constant.

## Follow-ups

None.

## Files Created/Modified

- `src/app/api/anomalies/route.ts` — Added VESSEL_STALENESS_INTERVAL import and EXISTS subquery with IMO→MMSI bridge join to filter anomalies to vessels with recent position data
