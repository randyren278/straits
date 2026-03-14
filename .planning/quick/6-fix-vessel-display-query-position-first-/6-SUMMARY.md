---
phase: quick-6
plan: 1
subsystem: vessels/map
tags: [ais, vessels, database, map, typescript]
dependency_graph:
  requires: []
  provides: [position-first vessel query, nullable VesselWithSanctions, null-safe filterTankers]
  affects: [VesselMap, VesselPanel, geojson, filter, vessel-store]
tech_stack:
  added: []
  patterns: [position-first LEFT JOIN, DISTINCT ON CTE, nullable vessel metadata]
key_files:
  created: []
  modified:
    - src/lib/db/sanctions.ts
    - src/lib/map/filter.ts
    - src/lib/map/geojson.ts
    - src/components/map/VesselMap.tsx
    - src/components/panels/VesselPanel.tsx
    - src/stores/vessel.ts
decisions:
  - VesselWithSanctions defined independently (not extending VesselWithPosition) to allow nullable vessel metadata
  - filterTankers generic constraint relaxed to { shipType: number | null } for broad compatibility
  - geojson.ts VesselForGeoJSON interface replaces VesselWithPossibleSanctions to accept nullable fields
  - vessel.ts store uses SelectableVessel union type to accept both VesselWithPosition and VesselWithSanctions
metrics:
  duration: ~8 min
  completed: 2026-03-14
  tasks_completed: 2
  files_modified: 6
---

# Quick Task 6: Fix Vessel Display — Query Position-First

**One-liner:** Rewrote vessel query to SELECT DISTINCT ON (mmsi) from vessel_positions first, making IMO-less AIS ships visible on the map, with nullable VesselWithSanctions cascaded through all downstream components.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Rewrite getVesselsWithSanctions to query position-first | 58d0aff | src/lib/db/sanctions.ts |
| 2 | Fix nullable shipType in filter.ts and VesselMap click handler | f3c63c6 | filter.ts, geojson.ts, VesselMap.tsx, VesselPanel.tsx, vessel.ts |

## What Was Done

### Task 1: Position-First Query (sanctions.ts)

Rewrote `getVesselsWithSanctions` to source from `vessel_positions` as the primary table:

- `VesselWithSanctions` redefined as an independent interface (no longer extends `VesselWithPosition`)
- Nullable fields: `imo: string | null`, `name: string | null`, `flag: string | null`, `shipType: number | null`
- `position` field is always non-null (guaranteed by the CTE — every row originated in `vessel_positions`)
- SQL uses `SELECT DISTINCT ON (mmsi) ... ORDER BY mmsi, time DESC` CTE then LEFT JOINs vessels/sanctions/anomalies
- `tankersOnly=true`: `WHERE v.ship_type IS NOT NULL AND v.ship_type BETWEEN 80 AND 89` (excludes IMO-less vessels — they're unclassifiable)
- `tankersOnly=false`: no WHERE clause — all vessels including IMO-less ships appear on the map

### Task 2: Downstream Nullable Fixes

**filter.ts:** Generic constraint changed from `T extends VesselWithPosition` to `T extends { shipType: number | null }`. Added `v.shipType != null` guard before range comparison.

**geojson.ts:** `VesselForGeoJSON` replaces `VesselWithPossibleSanctions extends VesselWithPosition` — all vessel metadata fields are nullable, position is nullable (vessels without positions are skipped via `.filter(v => v.position !== null)`).

**VesselMap.tsx:** Click handler updated — `imo/name/flag` default to `null` instead of empty string, `shipType` uses `?? null` instead of `|| 0`.

**VesselPanel.tsx:**
- `vesselImo` extracted with null coalescing for watchlist operations
- `shipType` comparison guarded with `!= null` check, falls back to `'Unknown'`
- Sanctions section uses `as VesselWithSanctions` cast instead of broken `as Record<string, unknown>`
- Imported `VesselWithSanctions` type

**vessel.ts:** Added `SelectableVessel = VesselWithPosition | VesselWithSanctions` union type for `selectedVessel` and `setSelectedVessel`.

## Verification

```
npx tsc --noEmit  → exit 0 (no errors)
npm run build     → success, all routes compiled
```

## Deviations from Plan

None — plan executed exactly as written. The store and panel changes (vessel.ts, VesselPanel.tsx, geojson.ts) were extensions of Task 2 scope as hinted by the plan's "Also check if VesselPanel or other components..." instruction.

## Self-Check

- [x] sanctions.ts: uses `SELECT DISTINCT ON (mmsi) FROM vessel_positions` CTE
- [x] tankersOnly filter: `v.ship_type IS NOT NULL AND v.ship_type BETWEEN 80 AND 89`
- [x] filterTankers: handles null shipType
- [x] VesselWithSanctions: position always non-null
- [x] TypeScript: zero errors
- [x] Build: success

## Self-Check: PASSED
