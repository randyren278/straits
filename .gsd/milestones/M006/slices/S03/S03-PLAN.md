# S03: End-to-End Fleet Integration & Verification

**Goal:** Provide end-to-end navigation from fleet anomalies to dashboard intelligence dossiers.
**Demo:** Clicking "Show on Map" from the `/fleet` page correctly flies to the vessel coordinates and auto-expands the right-hand intelligence panel with the target vessel's real-time risk dossier.

## Must-Haves

- The `useVesselStore` must track a pending `targetVesselImo`.
- Route transitions to `/dashboard` must set the `targetVesselImo` before navigating.
- The `VesselMap` component must hydrate the pending target IMO into a full `selectedVessel` when the vessel array loads, triggering the right-hand panel.

## Proof Level

- This slice proves: final-assembly
- Real runtime required: yes
- Human/UAT required: yes

## Verification

- `npx tsc --noEmit`
- `npm run test`
- Manual review: Go to `/fleet`, click "Show on Map" on any vessel. The map should fly to it AND the right-hand dossier should appear automatically. Also test global Search lookup to verify its dossier hydration works.

## Observability / Diagnostics

- Runtime signals: `targetVesselImo` set to IMO string and then cleared to `null` on successful hydration.
- Inspection surfaces: React DevTools / Zustand DevTools.
- Failure visibility: none
- Redaction constraints: none

## Integration Closure

- Upstream surfaces consumed: `useVesselStore` (`selectedVessel`, `vessels`), `VesselMap`, `/fleet` route.
- New wiring introduced in this slice: Pending state resolution across page boundaries.
- What remains before the milestone is truly usable end-to-end: nothing

## Tasks

- [ ] **T01: Extend vessel store and emit target IMO on navigation** `est:15m`
  - Why: The store needs a way to hold a pending vessel selection during cross-route map jumps, since the fleet page doesn't have the full vessel data payload required by `setSelectedVessel`.
  - Files: `src/stores/vessel.ts`, `src/components/fleet/FleetVesselDetail.tsx`, `src/app/(protected)/dashboard/page.tsx`
  - Do: Add `targetVesselImo: string | null` state and `setTargetVesselImo` action to `useVesselStore`. In `FleetVesselDetail`'s `handleShowOnMap` and `DashboardPage`'s `handleSearchSelect`, dispatch the imo to `setTargetVesselImo` alongside `setMapCenter`.
  - Verify: `npx tsc --noEmit` passes without errors.
  - Done when: Store typing is valid and producers successfully inject the target IMO before map fly-to commands.

- [ ] **T02: Consume target IMO in VesselMap and hydrate selection** `est:15m`
  - Why: The dashboard map must detect the pending target vessel, find its complete data in the local `vessels` array, and apply it to the main selection state to trigger the dossier panel.
  - Files: `src/components/map/VesselMap.tsx`
  - Do: Add a `useEffect` inside `VesselMap` that watches `targetVesselImo` and `vessels`. If `targetVesselImo` is present and `vessels.length > 0`, find the vessel in the list matching the target IMO. If found, call `setSelectedVessel` and clear the target IMO state to `null`.
  - Verify: `npx tsc --noEmit`
  - Done when: A pending vessel lookup perfectly matches against local map state and triggers full intelligence dossier visibility without manual user clicks.

## Files Likely Touched

- `src/stores/vessel.ts`
- `src/components/fleet/FleetVesselDetail.tsx`
- `src/app/(protected)/dashboard/page.tsx`
- `src/components/map/VesselMap.tsx`
