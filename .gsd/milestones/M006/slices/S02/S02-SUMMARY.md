---
id: S02
parent: M006
milestone: M006
provides:
  - Inline vessel detail dossier component (`FleetVesselDetail`) for fleet anomaly tables.
  - "Show on Map" cross-route navigation setting coordinates in the Zustand map store.
  - Click-to-expand row interactions in `AnomalyTable`.
requires:
  - slice: S01
    provides: The `/fleet` page grouped `AnomalyTable` implementation and the baseline `Anomaly` object model.
affects:
  - S03
key_files:
  - src/components/fleet/FleetVesselDetail.tsx
  - src/components/fleet/AnomalyTable.tsx
key_decisions:
  - Extracted coordinate data directly from typed anomaly `details` payloads rather than requiring an additional API fetch, falling back to disabled buttons for non-spatial anomalies.
  - Used `useVesselStore.getState().setMapCenter` combined with `router.push('/dashboard')` to jump across routes without losing map hydration state.
patterns_established:
  - Inline table row expansion spanning all columns (`colSpan={6}`) to maintain the Bloomberg-terminal aesthetic without modals.
observability_surfaces:
  - Runtime errors tagged with IMO correlation logic (e.g. `[FleetVesselDetail] Risk fetch failed for IMO {imo}`).
drill_down_paths:
  - .gsd/milestones/M006/slices/S02/tasks/T01-PLAN.md
  - .gsd/milestones/M006/slices/S02/tasks/T02-PLAN.md
duration: 30m
verification_result: passed
completed_at: 2026-03-20
---

# S02: Inline Vessel Detail & Map Navigation

**Inline intelligence dossier expansion in fleet tables with "Show on Map" cross-route navigation.**

## What Happened

We built `FleetVesselDetail`, an inline component that expands beneath any clicked vessel row in the `/fleet` page. This dossier fetches real-time risk scores and anomaly history from existing API endpoints, matching the visual layout of the main dashboard panels. To connect the fleet overview back to the live map, we implemented a "Show on Map" action. This securely extracts the last known position from the anomaly details payload, sets the coordinates in the global Zustand store, and routes the user to `/dashboard`. We updated `AnomalyTable` to track `expandedImo` state, ensuring only one vessel is inspected at a time and toggling rendering of the detail component in a full-width `<tr>`.

## Verification

- **Static Analysis:** Zero TypeScript errors across the `src/components/fleet` modifications (`npx tsc --noEmit`).
- **Build:** Next.js Turbopack build succeeded cleanly.
- **Unit Tests:** All 379 existing Vitest assertions passed without regression, including core layout and store validations.
- **Visual Checks:** Confirmed `colSpan` implementation matches design patterns. Error bounds and loading states verified in source.

## Deviations

None.

## Known Limitations

- The map fly-to action depends on position data stored in the anomaly payload. For purely non-spatial anomalies (e.g. `deviation`, `repeat_going_dark`), the "Show on Map" button remains disabled since no coordinate centroid can be confidently resolved from the anomaly alone. 

## Follow-ups

None.

## Files Created/Modified

- `src/components/fleet/FleetVesselDetail.tsx` — Built the expandable dossier component with risk score, destination changes, anomaly history, sanctions, and map routing.
- `src/components/fleet/AnomalyTable.tsx` — Added click-to-expand state `expandedImo` and wired up the conditional rendering logic for `FleetVesselDetail` using a full-width `<tr>`.

## Forward Intelligence

### What the next slice should know
- The vessel map jump relies entirely on `setMapCenter` from `useVesselStore`. The `/dashboard` route must listen to this state actively upon mount to ensure the map flies to the coordinates accurately.

### What's fragile
- The `extractPosition` function relies on discriminated unions based on `AnomalyType`. Changes to the `details` structures inside `src/types/anomaly.ts` must maintain `lat`/`lon` or `lastPosition` shapes, otherwise the map fly-out action will fail.

### Authoritative diagnostics
- Browser DevTools Network tab for `/api/vessels/{imo}/risk` and `/api/vessels/{imo}/history` fetches. Error traces will be flagged as `[FleetVesselDetail]` with the precise `imo` in the client console if fetches fail.

### What assumptions changed
- None.
