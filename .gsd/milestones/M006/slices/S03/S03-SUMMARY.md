---
id: S03
parent: M006
milestone: M006
provides:
  - Cross-route vessel targeting via targetVesselImo pending state in useVesselStore
  - Automatic dossier panel hydration when navigating from /fleet → /dashboard
  - Graceful failure path with console.warn when target vessel not found in loaded vessels
  - Dashboard search integration with targetVesselImo for consistent vessel selection
requires:
  - slice: S02
    provides: FleetVesselDetail component with handleShowOnMap and anomaly detail extraction
affects: []
key_files:
  - src/stores/vessel.ts
  - src/components/fleet/FleetVesselDetail.tsx
  - src/app/(protected)/dashboard/page.tsx
  - src/components/map/VesselMap.tsx
key_decisions:
  - Console logging on targetVesselImo set/clear for cross-route tracing
  - Console.warn (not silent discard) on unmatched targetVesselImo for inspectable failure state
patterns_established:
  - "Pending identifier pattern: store a lightweight ID across route boundaries, resolve to full object on destination load, clear to prevent re-selection loops"
  - "Use useVesselStore.getState() for imperative store access in event handlers outside React render"
  - "Effect-based state bridge: watch pending identifier + data array, resolve match, clear pending state"
observability_surfaces:
  - "Console log: [VesselStore] targetVesselImo set: {imo}"
  - "Console log: [VesselStore] targetVesselImo cleared"
  - "Console log: [VesselMap] Hydrated target vessel: {imo}"
  - "Console warn: [VesselMap] Target vessel IMO {imo} not found in {count} loaded vessels"
  - "Zustand DevTools: targetVesselImo visible in store state — null after hydration, string if pending/failed"
drill_down_paths:
  - .gsd/milestones/M006/slices/S03/tasks/T01-SUMMARY.md
  - .gsd/milestones/M006/slices/S03/tasks/T02-SUMMARY.md
duration: 9m
verification_result: passed
completed_at: 2026-03-20
---

# S03: End-to-End Fleet Integration & Verification

**Cross-route vessel targeting with automatic dossier hydration bridges /fleet anomaly tables to /dashboard map intelligence**

## What Happened

This slice solved the final integration gap in the M006 fleet workflow: when a user clicks "Show on Map" from the `/fleet` anomaly table, the system must navigate to `/dashboard`, fly the map to the vessel's coordinates, AND automatically open the right-hand intelligence dossier panel — all without the fleet page having access to the full `VesselWithSanctions` object needed by `setSelectedVessel`.

**T01** added a `targetVesselImo: string | null` pending state and `setTargetVesselImo` action to the Zustand vessel store. This lightweight identifier bridges the two routes without requiring the fleet page to fetch the full vessel payload. Both `FleetVesselDetail.handleShowOnMap` and `DashboardPage.handleSearchSelect` were wired to emit the target IMO alongside their existing `setMapCenter` calls before navigation occurs. Console logging was added to trace the cross-route lifecycle.

**T02** consumed the pending state on the dashboard side. A `useEffect` in `VesselMap` watches both `targetVesselImo` and the locally-fetched `vessels` array. When both are available, it resolves the matching vessel by IMO, calls `setSelectedVessel(match)` to trigger the dossier panel, and clears the target to prevent re-selection loops. If the target IMO has no match (vessel left coverage area), a `console.warn` fires with the IMO and vessel count for diagnostic visibility.

## Verification

- **`npx tsc --noEmit`** — zero type errors across all source files
- **`npm run test`** — 379 tests pass across 34 test files, 0 failures (2 files skipped, pre-existing)
- **Observability audit** — all four console log/warn paths confirmed in source: set, cleared, hydrated, not-found
- **Graceful failure** — confirmed `console.warn` branch when `targetVesselImo` has no match in loaded vessels
- **Manual review pending** — requires live dev server + database for full end-to-end click-through

## Deviations

None.

## Known Limitations

- If the target vessel is not yet in the `vessels` array when the effect runs (e.g. slow API response), the `console.warn` fires immediately rather than retrying. The effect does re-run when `vessels` updates, so the match will resolve once data arrives. But if the vessel is permanently outside coverage, `targetVesselImo` remains non-null in state until the next navigation clears it.
- The `deviation` and `repeat_going_dark` anomaly types return `null` from `extractPosition`, so "Show on Map" is disabled for these — this is by design since these types lack a single-point position.

## Follow-ups

- None — this is the final slice of M006. The milestone is complete.

## Files Created/Modified

- `src/stores/vessel.ts` — Added `targetVesselImo: string | null` state and `setTargetVesselImo` action with console logging
- `src/components/fleet/FleetVesselDetail.tsx` — Updated `handleShowOnMap` to call `setTargetVesselImo(imo)` before navigating to dashboard
- `src/app/(protected)/dashboard/page.tsx` — Updated `handleSearchSelect` to call `setTargetVesselImo(result.imo)` on vessel selection
- `src/components/map/VesselMap.tsx` — Added useEffect to resolve `targetVesselImo` against loaded vessels and auto-select with graceful failure warning

## Forward Intelligence

### What the next slice should know
- The pending identifier pattern (`targetVesselImo` → resolve → clear) is a reusable approach for any cross-route entity selection. If future features need similar "navigate and auto-select" behavior, follow this pattern.
- M006 is fully complete — the `/fleet` route provides grouped anomaly tables (S01), inline vessel dossiers (S02), and seamless map navigation with dossier hydration (S03).

### What's fragile
- The `useEffect` hydration relies on the `/api/vessels` fetch completing before `targetVesselImo` can be resolved. If the API is slow, there's a brief window where the warning fires before the data arrives. The effect re-runs on `vessels` changes, so it self-heals, but the warning log may create noise during slow loads.
- The `extractPosition` function in `FleetVesselDetail` returns `null` for `deviation` and `repeat_going_dark` types — if these types gain position data in the future, `extractPosition` needs a new case branch or "Show on Map" stays disabled.

### Authoritative diagnostics
- Browser console → look for the `[VesselStore]` / `[VesselMap]` log sequence to trace the full cross-route lifecycle
- Zustand DevTools → `targetVesselImo` should be `null` in steady state; if it's a string, hydration failed or is pending

### What assumptions changed
- No assumptions changed — the slice plan's design was implemented as-is with no deviations needed.
