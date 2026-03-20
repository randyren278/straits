# S03: End-to-End Fleet Integration & Verification — Research

**Date:** 2026-03-20

## Summary

Slice S03 focuses on verifying the end-to-end fleet workflow, specifically ensuring that when a user clicks "Show on Map" from the `/fleet` page, the application seamlessly transitions to the main dashboard map with the "correct vessel context applied." Our research confirms that while S02 successfully implemented the map coordinate fly-to functionality using `setMapCenter` and route navigation, it did not select the vessel in the Zustand global state. As a result, the right-hand `VesselPanel` intelligence dossier remains empty upon arrival at the dashboard. 

The core issue is that the `useVesselStore.getState().setSelectedVessel()` method expects a complete `VesselWithSanctions` object, which the `/fleet` page does not possess (it only has partial anomaly records). This same limitation also currently affects the `SearchInput` component on the dashboard.

## Recommendation

To fulfill the milestone's definition of done ("correct vessel context applied"), we should implement a "pending selection" pattern. We will add a `targetVesselImo` state to the `useVesselStore`. The `FleetVesselDetail` component will set this target IMO alongside the map center coordinates before navigating. When the `/dashboard` route mounts and the `VesselMap` successfully fetches the complete fleet payload, it will detect the `targetVesselImo`, match it against the loaded `vessels` dataset, hydrate the `selectedVessel` object, and clear the pending target. We will also apply this pattern to the global `SearchInput` to resolve its identical context hydration bug.

## Implementation Landscape

### Key Files

- `src/stores/vessel.ts` — Add `targetVesselImo: string | null` and its setter `setTargetVesselImo` to manage pending vessel selections across route transitions.
- `src/components/fleet/FleetVesselDetail.tsx` — Update `handleShowOnMap` to call `setTargetVesselImo(imo)` before invoking `router.push('/dashboard')`.
- `src/app/(protected)/dashboard/page.tsx` — Update `handleSearchSelect` to also call `setTargetVesselImo(result.imo)` so that search lookups properly expand the dossier panel.
- `src/components/map/VesselMap.tsx` — Add a `useEffect` hook to observe `targetVesselImo` and the local `vessels` array. When a match is found, call `setSelectedVessel` and reset the target IMO to `null`.

### Build Order

1. **State Extension**: Update `src/stores/vessel.ts` to add the `targetVesselImo` property. This establishes the contract.
2. **Context Producers**: Update `FleetVesselDetail.tsx` and `DashboardPage` (search handler) to emit the `targetVesselImo` when a navigation/search action occurs.
3. **Context Consumer**: Update `VesselMap.tsx` to listen for the pending target, find the matching vessel object, and trigger `setSelectedVessel`.

### Verification Approach

1. **Fleet Integration**: Start dev server, navigate to `/fleet`, expand a vessel row, and click "Show on Map". Verify that the app transitions to `/dashboard`, the map centers on the coordinates, AND the `VesselPanel` automatically opens on the right side populated with the vessel's intelligence dossier.
2. **Search Integration**: Use the top search bar to lookup a vessel by name or IMO. Click the result and verify the map flies to the coordinates AND the `VesselPanel` automatically opens.
3. **Type Safety**: Run `npx tsc --noEmit` to ensure the Zustand store modifications are fully type-safe.
