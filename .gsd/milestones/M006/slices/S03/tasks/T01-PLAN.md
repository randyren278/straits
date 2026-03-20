---
estimated_steps: 3
estimated_files: 3
---

# T01: Extend vessel store and emit target IMO on navigation

**Slice:** S03 — End-to-End Fleet Integration & Verification
**Milestone:** M006

## Description

The store needs a way to hold a pending vessel selection during cross-route map jumps, since the fleet page doesn't have the full vessel data payload required by `setSelectedVessel`. We will extend `useVesselStore` with a new `targetVesselImo` property, and update `FleetVesselDetail` and `DashboardPage` to emit this property when performing map fly-to navigation.

## Steps

1. Update `src/stores/vessel.ts` to add `targetVesselImo: string | null` state and a `setTargetVesselImo` action to `VesselStore` interface. Add them to the store implementation.
2. Update `src/components/fleet/FleetVesselDetail.tsx` in `handleShowOnMap`: alongside `setMapCenter`, call `useVesselStore.getState().setTargetVesselImo(imo)`.
3. Update `src/app/(protected)/dashboard/page.tsx` in `handleSearchSelect`: alongside `setMapCenter`, call `setTargetVesselImo(result.imo)` by bringing `setTargetVesselImo` from `useVesselStore`.

## Must-Haves

- [ ] `targetVesselImo` state defaults to `null`.
- [ ] Navigation from `/fleet` sets `targetVesselImo`.
- [ ] Navigation from search sets `targetVesselImo`.

## Verification

- `npx tsc --noEmit` passes without type errors.
- Manual verification: Console should not throw when clicking "Show on Map".

## Inputs

- `src/stores/vessel.ts`
- `src/components/fleet/FleetVesselDetail.tsx`
- `src/app/(protected)/dashboard/page.tsx`

## Expected Output

- `src/stores/vessel.ts` — Store updated with `targetVesselImo`
- `src/components/fleet/FleetVesselDetail.tsx` — Produces target IMO on map show
- `src/app/(protected)/dashboard/page.tsx` — Produces target IMO on search

## Observability Impact
- Target vessel IMO is trackable in Zustand DevTools to ensure cross-page state is maintained correctly.
- Add console logs when target vessel IMO is set or cleared, which helps trace cross-route jumps and target hydration without relying solely on DevTools.
