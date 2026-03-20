# S03: End-to-End Fleet Integration & Verification — UAT

**Milestone:** M006
**Written:** 2026-03-20

## UAT Type

- UAT mode: mixed
- Why this mode is sufficient: TypeScript compilation and unit tests verify structural correctness, but the cross-route navigation + map hydration + dossier panel behavior requires live runtime verification with a running database and dev server.

## Preconditions

1. TimescaleDB running: `docker compose up -d`
2. Next.js dev server running: `npm run dev`
3. AIS ingester running (or has been run recently): `npm run ingester:dev`
4. At least one vessel with an active anomaly exists in the database (needed for the fleet table to have expandable rows)
5. Browser open to `http://localhost:3000`

## Smoke Test

Navigate to `http://localhost:3000/fleet`. The page should load and display at least one anomaly category table. If the table is empty, verify the ingester has run and anomalies exist in the database.

## Test Cases

### 1. Fleet "Show on Map" navigates to dashboard and opens dossier

1. Navigate to `/fleet`
2. Locate an anomaly row with a vessel that has position data (going_dark, loitering, speed, or sts_transfer type)
3. Click the row to expand it — the inline dossier should appear with risk score, anomaly history, destination log, and sanctions info
4. Click the **"Show on Map"** button
5. **Expected:** Browser navigates to `/dashboard`. The map flies to the vessel's coordinates. The right-hand intelligence panel automatically shows the selected vessel's dossier (name, risk score, position data) — **no manual click required** on the map.

### 2. Dashboard search also hydrates vessel dossier

1. Navigate to `/dashboard`
2. Use the search bar in the header to search for a known vessel by name or IMO
3. Select a vessel from the search results
4. **Expected:** The map flies to the vessel's position AND the right-hand panel automatically displays the vessel's information. The behavior should be identical to the fleet "Show on Map" flow.

### 3. Console log sequence confirms cross-route lifecycle

1. Open browser DevTools Console
2. Navigate to `/fleet`, expand a row, click "Show on Map"
3. **Expected:** Console shows the following sequence in order:
   - `[VesselStore] targetVesselImo set: {imo}` (on click)
   - `[VesselMap] Hydrated target vessel: {imo}` (after dashboard loads vessels)
   - `[VesselStore] targetVesselImo cleared` (after hydration)

### 4. Risk score and dossier data loads correctly in inline detail

1. Navigate to `/fleet`
2. Click to expand an anomaly row for a vessel
3. **Expected:** The inline dossier displays:
   - Risk score (numeric value with color coding: green < 40, yellow 40-69, red ≥ 70)
   - Risk factor breakdown bars (Going Dark, Sanctions, Flag Risk, Loitering, STS Events)
   - Anomaly history list with badges and timestamps
   - Destination change log (if any exist)
   - Sanctions block (if the vessel is sanctioned, shown with red border and AlertTriangle icon)

### 5. "Show on Map" disabled for position-less anomaly types

1. Navigate to `/fleet`
2. Find a vessel with a `deviation` or `repeat_going_dark` anomaly type (if any exist)
3. Expand the row
4. **Expected:** The "Show on Map" button is grayed out (disabled state) with `cursor-not-allowed`. The title tooltip reads "Position data not available for this anomaly type".

## Edge Cases

### Empty fleet table

1. Ensure no active anomalies exist in the database (or clear them)
2. Navigate to `/fleet`
3. **Expected:** The page loads without errors. Tables display empty state messages. No JavaScript errors in the console.

### Target vessel not in map coverage

1. Open browser DevTools Console
2. Navigate to `/fleet`
3. Find a vessel with an anomaly, note its IMO
4. Click "Show on Map"
5. If the vessel's position data has expired from the `/api/vessels` response (e.g. vessel stopped transmitting)
6. **Expected:** Console shows `[VesselMap] Target vessel IMO {imo} not found in {count} loaded vessels` as a warning. The map still navigates to the coordinates, but the dossier panel does not auto-open. No crash or runtime error.

### Rapid sequential "Show on Map" clicks

1. Navigate to `/fleet`
2. Expand one row and click "Show on Map"
3. Immediately use browser back to return to `/fleet`
4. Expand a different row and click "Show on Map" again
5. **Expected:** The second navigation wins. The map should show the second vessel's position and dossier. No stale state from the first click persists.

## Failure Signals

- **Map doesn't fly:** `setMapCenter` isn't being called or mapCenter isn't consumed — check console for `[VesselStore] targetVesselImo set:` to confirm the store update fires
- **Map flies but dossier doesn't open:** `targetVesselImo` hydration failed — check console for the warning message or verify the vessel exists in the `/api/vessels` response
- **Console shows "targetVesselImo set" but never "cleared":** The vessel wasn't found in the map's vessel array — check `/api/vessels` response for the target IMO
- **TypeScript errors on load:** Run `npx tsc --noEmit` to identify type mismatches
- **"Show on Map" button not visible:** Check that `FleetVesselDetail` is rendering and the anomaly type has position data (going_dark, loitering, speed, sts_transfer)

## Not Proven By This UAT

- Performance under high vessel counts (1000+ simultaneous anomalies)
- Behavior when the Mapbox token is invalid or expired
- Authentication/authorization flow to the `/fleet` and `/dashboard` routes
- Mobile responsive layout of the fleet table and inline dossier

## Notes for Tester

- The `deviation` and `repeat_going_dark` anomaly types legitimately disable "Show on Map" — this is expected, not a bug
- The console log sequence (`set → hydrated → cleared`) is the primary diagnostic for verifying the cross-route bridge works correctly
- If the fleet table shows no anomalies, run the ingester for a few minutes to populate detection data
- The Zustand DevTools browser extension (if installed) can show real-time `targetVesselImo` state changes during testing
