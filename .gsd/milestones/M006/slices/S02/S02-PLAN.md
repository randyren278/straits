# S02: Inline Vessel Detail & Map Navigation

**Goal:** Add click-to-expand vessel detail rows in the fleet tables and a "Show on Map" button that navigates to the dashboard and flies to the vessel.
**Demo:** Clicking a vessel row in any fleet table expands an inline detail panel showing risk score breakdown, anomaly history, destination change log, and sanctions info. A "Show on Map" button navigates to the live map and centers on that vessel.

## Must-Haves

- Clicking a vessel row expands an inline detail section below it
- Detail section shows: risk score with factor bars, anomaly history timeline, destination change log, sanctions alert (if sanctioned)
- Only one vessel detail can be expanded at a time (clicking another collapses the previous)
- "Show on Map" button navigates to `/dashboard` and flies the map to the vessel's coordinates
- Clicking the expanded row again collapses the detail

## Verification

- `npx tsc --noEmit` — zero type errors
- `npm run build` — build succeeds
- Browser: click vessel in fleet table → detail expands with real data from API
- Browser: click "Show on Map" → navigates to dashboard, map centers on vessel

## Tasks

- [x] **T01: Inline vessel detail component** `est:20m`
  - Why: Reuses VesselPanel intelligence dossier logic in an inline table-row context
  - Files: `src/app/(protected)/fleet/page.tsx`
  - Do: Add `expandedImo` state. On row click, set expanded IMO (toggle off if same). When expanded, render a detail section below the row that fetches `/api/vessels/[imo]/risk` and `/api/vessels/[imo]/history`. Display: risk score with factor breakdown bars, anomaly history list, destination change log, sanctions alert with authorities/aliases/flag/OpenSanctions link. Reuse the color scheme and layout patterns from VesselPanel but adapted for inline table context (full-width, no side panel chrome).
  - Verify: `npx tsc --noEmit` passes; `npm run build` passes
  - Done when: clicking a fleet row expands an inline detail view with real data

- [x] **T02: Show on Map navigation** `est:10m`
  - Why: Connects fleet view to live map — the key user flow
  - Files: `src/app/(protected)/fleet/page.tsx`, `src/stores/vessel.ts`
  - Do: Add a "Show on Map" button in the expanded detail view. On click: get the vessel's latest position from the anomaly details (lastPosition/centroid), call `setMapCenter({ lat, lon, zoom: 12 })` in Zustand, then `router.push('/dashboard')`. The dashboard map will pick up the new mapCenter from the store and fly to it. If the anomaly has no position data, disable the button with a tooltip "No position available".
  - Verify: `npx tsc --noEmit` passes; browser: click "Show on Map" → lands on dashboard with map centered on vessel
  - Done when: "Show on Map" navigates to dashboard and map flies to vessel position

## Observability / Diagnostics

- **Runtime signals:** `[FleetVesselDetail]` console.error logs with IMO for failed risk/history API fetches. Inline error states visible in the expanded row when API calls fail.
- **Inspection surfaces:** Browser DevTools Network tab shows `/api/vessels/{imo}/risk` and `/api/vessels/{imo}/history` requests on row expand. Zustand devtools show `mapCenter` state changes on "Show on Map" click. `data-imo` attributes on table rows for DOM inspection.
- **Failure visibility:** Loading state ("LOADING INTELLIGENCE...") indicates in-flight fetches. Error state renders red inline message. Disabled "Show on Map" button with title tooltip explains missing position data. All API errors logged with IMO correlation.
- **Redaction constraints:** No PII in logs — only IMO numbers and HTTP status codes.

## Files Likely Touched

- `src/app/(protected)/fleet/page.tsx`
- `src/stores/vessel.ts` (if setMapCenter needs adjustment)
