---
id: T01
parent: S03
milestone: M006
provides:
  - targetVesselImo state in useVesselStore for cross-route vessel targeting
  - Fleet "Show on Map" emits target IMO before navigation
  - Dashboard search emits target IMO on vessel selection
key_files:
  - src/stores/vessel.ts
  - src/components/fleet/FleetVesselDetail.tsx
  - src/app/(protected)/dashboard/page.tsx
key_decisions:
  - Console logging on targetVesselImo set/clear for cross-route tracing
patterns_established:
  - Use useVesselStore.getState() for imperative store access in event handlers outside React render
observability_surfaces:
  - Console logs: "[VesselStore] targetVesselImo set: {imo}" and "[VesselStore] targetVesselImo cleared"
  - Zustand DevTools: targetVesselImo visible in store state
duration: 5m
verification_result: passed
completed_at: 2026-03-20
blocker_discovered: false
---

# T01: Extend vessel store and emit target IMO on navigation

**Added targetVesselImo state to useVesselStore and wired fleet/search navigation to emit target IMO before cross-route map jumps**

## What Happened

Extended the Zustand vessel store with a `targetVesselImo: string | null` property and `setTargetVesselImo` action to support cross-route vessel targeting. This state bridges the gap between the `/fleet` page (which knows the vessel IMO but not the full vessel data) and the `/dashboard` page (which needs a full vessel object for the dossier panel).

Updated `FleetVesselDetail.handleShowOnMap` to call `setTargetVesselImo(imo)` alongside the existing `setMapCenter` call before navigating to `/dashboard`. Updated `DashboardPage.handleSearchSelect` to call `setTargetVesselImo(result.imo)` alongside its `setMapCenter` call. Both producers now correctly inject the target IMO into global state before any fly-to navigation occurs.

Added console logging in `setTargetVesselImo` to trace cross-route jumps: logs on both set and clear operations.

## Verification

- `npx tsc --noEmit` passes with zero errors (clean compilation).
- `npm run test` passes: 379 tests pass across 34 test files, 2 skipped.
- Grep confirms all three files correctly reference `targetVesselImo` / `setTargetVesselImo`.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 2.7s |
| 2 | `npm run test` | 0 | ✅ pass | 2.8s |

## Diagnostics

- Console logs: `[VesselStore] targetVesselImo set: {imo}` when a vessel target is emitted, `[VesselStore] targetVesselImo cleared` when hydration completes (T02 will add the clearing).
- Zustand DevTools: `targetVesselImo` visible in store state inspector.

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/stores/vessel.ts` — Added `targetVesselImo: string | null` state (defaults to `null`) and `setTargetVesselImo` action with console logging
- `src/components/fleet/FleetVesselDetail.tsx` — Updated `handleShowOnMap` to call `setTargetVesselImo(imo)` before navigating to dashboard
- `src/app/(protected)/dashboard/page.tsx` — Updated `handleSearchSelect` to subscribe to `setTargetVesselImo` and call it with `result.imo` on vessel search selection
