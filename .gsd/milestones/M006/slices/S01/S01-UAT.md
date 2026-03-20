---
id: S01
parent: M006
milestone: M006
provides:
  - UAT script for Fleet Overview Page and Grouped Anomaly Tables
completed_at: 2026-03-20
---

# S01: Fleet Overview Page & Grouped Anomaly Tables — UAT

**Milestone:** M006
**Written:** 2026-03-20

## UAT Type

- UAT mode: mixed (live-runtime + human-experience)
- Why this mode is sufficient: This slice introduces new UI components and data fetching. Validating the SQL join works via API call and ensuring the frontend groups data gracefully handles both the integration and human-experience factors of the terminal aesthetic.

## Preconditions

- Next.js development server is running (`npm run dev`).
- PostgreSQL DB is running and populated with vessel anomaly data and risk scores.
- User is logged into the application.

## Smoke Test

Navigate to `/fleet` and verify the page loads, the title says "FLEET OVERVIEW", and at least one anomaly table is rendered without a white screen crash.

## Test Cases

### 1. Default All-Vessels Filter

1. Load the `/dashboard` page.
2. Check the map or the vessel list panel.
3. **Expected:** All vessel types are visible by default, not restricted strictly to tankers.

### 2. Fleet Tab Navigation

1. Look at the application Header navigation.
2. Click the "Fleet" tab.
3. **Expected:** The URL changes to `/fleet` and the tab visually indicates an active state.

### 3. API Payload Verification

1. In a terminal, run `curl -s http://localhost:3000/api/anomalies | grep vesselName`.
2. **Expected:** The JSON output includes `vesselName`, `flag`, and `riskScore` for the anomalies.

### 4. Grouped Anomaly Tables UI

1. On the `/fleet` page, observe the main content area.
2. **Expected:** You see one or more collapsible sections (e.g., "Route Deviation", "Going Dark") formatted with terminal aesthetics (bg-black, amber accents, font-mono).
3. Click the header of a section.
4. **Expected:** The section collapses and the chevron icon changes direction. Clicking again expands it.

### 5. Table Data Verification

1. Expand an anomaly group table.
2. **Expected:** The table displays columns for Vessel Name, IMO, Flag, Risk Score (color-coded red/amber/green), Confidence, and Detected timestamp.
3. **Expected:** The vessel name is present (or "—" if null) and risk score is appropriately colored based on value (>=70 red, >=40 amber, else green).

## Edge Cases

### Empty Data State

1. Truncate or clear the active anomalies in the database, OR artificially force `/api/anomalies` to return an empty array.
2. Load `/fleet`.
3. **Expected:** The page displays a terminal-styled "NO ACTIVE ANOMALIES DETECTED" message.

### Server Error State

1. Shut down the database or force `/api/anomalies` to throw a 500 status.
2. Load `/fleet`.
3. **Expected:** The page catches the error and displays an explicit red-accented error block (e.g., "ERROR: HTTP 500: Failed to fetch anomalies"). It does not show a blank screen.

## Failure Signals

- React runtime errors or white screens on `/fleet`.
- API endpoint returning 500 or failing to return `vesselName`/`flag`/`riskScore`.
- Grouping logic incorrectly bucketizing anomalies.
- Tables failing to collapse or expand.

## Not Proven By This UAT

- Expanding a row to view deep vessel intelligence (S02).
- The "Show on Map" interaction routing and state persistence (S02).

## Notes for Tester

- The tables are interactive and row clicks currently update local component state (which will be used by `FleetVesselDetail` in S02). Don't expect navigating away from the page when clicking a row yet.
