---
estimated_steps: 2
estimated_files: 1
---

# T02: Consume target IMO in VesselMap and hydrate selection

**Slice:** S03 — End-to-End Fleet Integration & Verification
**Milestone:** M006

## Description

The dashboard map must detect the pending target vessel, find its complete data in the local `vessels` array, and apply it to the main selection state to trigger the dossier panel. This handles the scenario where a user navigates to `/dashboard` with a `targetVesselImo` set from another route.

## Steps

1. In `src/components/map/VesselMap.tsx`, extract `targetVesselImo` and `setTargetVesselImo` from `useVesselStore`.
2. Add a `useEffect` inside `VesselMap` that depends on `targetVesselImo`, `vessels`, `setSelectedVessel`, and `setTargetVesselImo`.
3. Inside the effect, if `targetVesselImo` is truthy and `vessels.length > 0`, use `vessels.find()` to locate the matching vessel object. If found, call `setSelectedVessel` and clear the target IMO state by calling `setTargetVesselImo(null)`.

## Must-Haves

- [ ] A `useEffect` matching `targetVesselImo` against the `vessels` array exists.
- [ ] Resolving a target correctly clears the target IMO state to prevent looping or accidental re-selections.

## Verification

- `npx tsc --noEmit` passes cleanly.
- `npm run test` passes without regression.
- Visual check: Start dev server, search for a vessel or click "Show on Map" from `/fleet`, and verify the `VesselPanel` dossier slides out automatically with the correct vessel data upon page load.

## Inputs

- `src/stores/vessel.ts` — Contains the state signature.
- `src/components/map/VesselMap.tsx` — The map component to modify.

## Expected Output

- `src/components/map/VesselMap.tsx` — Updated to consume `targetVesselImo`
