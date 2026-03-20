---
id: T02
parent: S03
milestone: M006
provides:
  - Cross-route vessel targeting hydration in VesselMap — targetVesselImo resolved to selectedVessel on dashboard load
  - Graceful console warning when target IMO not found in loaded vessels
key_files:
  - src/components/map/VesselMap.tsx
key_decisions:
  - Console.warn (not silent discard) on unmatched targetVesselImo for inspectable failure state
patterns_established:
  - Effect-based state bridge: watch pending identifier + data array, resolve match, clear pending state
observability_surfaces:
  - "Console log: [VesselMap] Hydrated target vessel: {imo} on successful match"
  - "Console warn: [VesselMap] Target vessel IMO {imo} not found in {count} loaded vessels on failure"
  - "Store log pairing: set → cleared confirms full cross-route lifecycle"
  - "Zustand DevTools: targetVesselImo returns to null after successful hydration"
duration: 4m
verification_result: passed
completed_at: 2026-03-20
blocker_discovered: false
---

# T02: Consume target IMO in VesselMap and hydrate selection

**Added useEffect in VesselMap to resolve targetVesselImo against loaded vessels and auto-select the dossier panel**

## What Happened

Added a `useEffect` in `src/components/map/VesselMap.tsx` that watches `targetVesselImo` and the local `vessels` array. When both are available, it finds the matching vessel by IMO, calls `setSelectedVessel(match)` to trigger the right-hand intelligence dossier panel, and clears the pending state via `setTargetVesselImo(null)` to prevent re-selection loops.

The effect also handles the failure case: if `targetVesselImo` is set but no matching vessel exists in the loaded array (e.g. the vessel left the coverage area), a `console.warn` is emitted with the IMO and vessel count for diagnostic visibility. This satisfies the slice verification requirement for inspectable failure state.

The `targetVesselImo` and `setTargetVesselImo` were destructured from `useVesselStore` alongside the existing store subscriptions — no new imports needed since `useVesselStore` was already imported.

## Verification

- `npx tsc --noEmit` passes with zero type errors.
- `npm run test` passes: 379 tests across 34 files, 2 skipped (pre-existing), no regressions.
- Slice verification: Console warns gracefully when targetVesselImo has no match (else branch with `console.warn`).
- Slice verification: `npx tsc --noEmit` ✅, `npm run test` ✅.
- Manual review pending (final slice task — requires live dev server + database).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 7.5s |
| 2 | `npm run test` | 0 | ✅ pass | 3.5s |

## Diagnostics

- **Success path:** Console shows `[VesselStore] targetVesselImo set: {imo}` → `[VesselMap] Hydrated target vessel: {imo}` → `[VesselStore] targetVesselImo cleared` in sequence.
- **Failure path:** Console shows `[VesselStore] targetVesselImo set: {imo}` → `[VesselMap] Target vessel IMO {imo} not found in {count} loaded vessels`. The `targetVesselImo` remains non-null in Zustand DevTools until next navigation clears it.
- **Inspection:** Zustand DevTools → `targetVesselImo` should be `null` after successful hydration. If it persists as a string, the vessel wasn't found in the map's vessel array.

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/components/map/VesselMap.tsx` — Added `targetVesselImo`/`setTargetVesselImo` extraction from store; added useEffect that resolves pending target vessel against loaded vessels array, selects the match, and clears the pending state with graceful console.warn on failure
- `.gsd/milestones/M006/slices/S03/tasks/T02-PLAN.md` — Added Observability Impact section (pre-flight fix)
