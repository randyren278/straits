---
id: S02-UAT
parent: M006
milestone: M006
---

# S02: Inline Vessel Detail & Map Navigation — UAT

**Milestone:** M006
**Written:** 2026-03-20

## UAT Type

- UAT mode: live-runtime
- Why this mode is sufficient: The slice relies heavily on user interaction patterns (clicking rows to toggle expansion) and Next.js client-side navigation combined with Zustand store mutation. Live runtime testing is necessary to confirm UI rendering and route transitions work smoothly.

## Preconditions

1. Local dev server is running (`npm run dev`).
2. TimescaleDB database is seeded with active anomaly data, including vessels with risk scores and historical data.
3. User is authenticated and viewing `/fleet`.

## Smoke Test

Click on any vessel row in the "Going Dark" anomaly table. An inline intelligence dossier panel should immediately appear directly below the row, displaying "LOADING INTELLIGENCE...", then populate with risk scores and history. 

## Test Cases

### 1. Row Expansion and Exclusivity

1. On the `/fleet` page, click a vessel row in the first anomaly table.
2. Verify the inline dossier expands below the row.
3. Click a *different* vessel row in the same table.
4. **Expected:** The first dossier collapses, and the dossier for the newly clicked vessel expands. Only one dossier is visible at a time.

### 2. Dossier Data Population

1. Expand a vessel row known to have a risk score and previous destination changes.
2. Verify the Risk Score section renders with the correct score and colored factor bars (Going Dark, Sanctions, Flag Risk, etc.).
3. Verify the Anomaly History lists previous badges and timestamps.
4. Verify the Destination Log correctly shows `[previous] -> [current]`.
5. **Expected:** All UI components match the "Bloomberg terminal" aesthetic (black/amber backgrounds, mono fonts) and no data is left unpopulated except where genuinely missing.

### 3. "Show on Map" Navigation (Spatial Anomaly)

1. Expand a "Going Dark" or "Speed" anomaly row.
2. Locate the "Show on Map" button. It should be enabled (amber text/border).
3. Click "Show on Map".
4. **Expected:** The application instantly navigates to `/dashboard`. The deck.gl map should fly to the precise latitude/longitude associated with the selected anomaly.

## Edge Cases

### Missing Position Data (Disabled Map Navigation)

1. Expand a "Route Deviation" or "Repeat Going Dark" anomaly row.
2. **Expected:** The "Show on Map" button is disabled (gray text, cursor-not-allowed). Hovering over it displays a tooltip stating "Position data not available for this anomaly type".

### Intelligence Fetch Failure

1. In DevTools, use Network request blocking to block `/api/vessels/*/risk`.
2. Expand a vessel row.
3. **Expected:** The Risk Score section explicitly shows "RISK SCORE UNAVAILABLE". The component handles the failure gracefully without crashing the table. The console logs `[FleetVesselDetail] Risk fetch failed for IMO...`.

## Failure Signals

- **Errors:** Next.js redbox overlays triggered by `FleetVesselDetail` mounting.
- **Wrong UI behavior:** Clicking a row selects the wrong IMO, or multiple rows expand concurrently.
- **Navigation failures:** Clicking "Show on Map" changes the URL to `/dashboard` but the map centers at the default (0,0) instead of the vessel's coordinates.

## Not Proven By This UAT

- E2E validation of map hydration performance under heavy load.
- Verification of the server-side cron jobs generating the anomalies in the first place (tested in earlier milestones).

## Notes for Tester

If the database is empty, you'll need to run the data seed script or wait for the ais-ingester to generate mock anomalies before testing the `/fleet` route. Ensure your viewport is wide enough to verify the `colSpan=6` layout doesn't break table boundaries.
