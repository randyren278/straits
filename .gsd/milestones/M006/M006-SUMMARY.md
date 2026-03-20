---
id: M006
provides:
  - /fleet route with grouped anomaly tables displaying all active anomalies across the fleet
  - Inline FleetVesselDetail dossier component with risk scores, anomaly history, and sanctions info
  - "Show on Map" cross-route navigation from /fleet to /dashboard with automatic vessel selection and dossier hydration
  - targetVesselImo pending identifier pattern in Zustand store for cross-route entity resolution
  - /api/anomalies endpoint enriched with vesselName, flag, and riskScore from joined tables
  - Default all-vessels filter (tankersOnly: false) in vessel store
key_decisions:
  - Client-side grouping of anomalies by type on /fleet page (sorted by frequency)
  - Pending identifier pattern (targetVesselImo) for cross-route vessel hydration instead of passing full objects
  - Position extraction from typed anomaly details payloads rather than additional API fetch, with disabled buttons for non-spatial anomalies
  - Inline row expansion (colSpan=6) rather than modals for Bloomberg-terminal consistency
patterns_established:
  - "Pending identifier pattern: store a lightweight ID across route boundaries, resolve to full object on destination load, clear to prevent re-selection loops"
  - "Imperative Zustand store access via getState() in event handlers outside React render cycle"
  - "Terminal aesthetic for tables: bg-black, amber accents, font-mono, uppercase tracking-widest labels, no border-radius"
  - "Effect-based state bridge: watch pending identifier + data array, resolve match, clear pending state"
observability_surfaces:
  - "Console log: [VesselStore] targetVesselImo set/cleared"
  - "Console log: [VesselMap] Hydrated target vessel: {imo}"
  - "Console warn: [VesselMap] Target vessel IMO {imo} not found in {count} loaded vessels"
  - "Zustand DevTools: targetVesselImo visible in store state — null after hydration, string if pending/failed"
  - "Console error: [FleetVesselDetail] Risk/History fetch failed for IMO {imo}"
  - "/fleet page renders explicit error messages in red-accented container on fetch failure"
requirement_outcomes: []
duration: 2h 10m
verification_result: passed
completed_at: 2026-03-20
---

# M006: Fleet Overview

**Fleet-wide anomaly intelligence dashboard with grouped tables, inline vessel dossiers, and cross-route map navigation bridging fleet triage to spatial tracking.**

## What Happened

This milestone delivered a dedicated `/fleet` route that gives operators a fleet-wide view of all active anomalies, organized for rapid triage and deep-dive investigation.

**S01** laid the foundation by enhancing the `/api/anomalies` endpoint to join against `vessels` and `vessel_risk_scores` tables, enriching each anomaly with `vesselName`, `flag`, and `riskScore`. The `/fleet` page fetches this payload on mount, groups anomalies client-side by `anomalyType` (sorted by frequency), and renders each group via the `AnomalyTable` component. The default vessel filter was broadened to `tankersOnly: false` to show all vessel types. The page handles loading, empty, and error states with terminal-styled UI matching the Bloomberg aesthetic. A "Fleet" tab was added to the main header navigation.

**S02** added the intelligence layer. `FleetVesselDetail` expands inline beneath any clicked row (tracked via `expandedImo` state), fetching risk scores and anomaly history from `/api/vessels/{imo}/risk` and `/api/vessels/{imo}/history`. The dossier displays risk score with color-coded severity, factor breakdown bars, anomaly history timeline, destination changes, and sanctions data. A "Show on Map" button extracts coordinates from the anomaly's typed details payload and calls `setMapCenter` + `router.push('/dashboard')` to fly the map to that vessel. Non-spatial anomaly types (`deviation`, `repeat_going_dark`) correctly disable this button.

**S03** closed the integration gap. The fleet page only has partial vessel data (an IMO number), but the dashboard map needs a full `VesselWithSanctions` object to render the dossier panel. The solution was a pending identifier pattern: `FleetVesselDetail.handleShowOnMap` stores the target IMO via `setTargetVesselImo` in the Zustand store before navigation. On the dashboard side, a `useEffect` in `VesselMap` watches both `targetVesselImo` and the `vessels` array. When both are available, it resolves the full vessel object, calls `setSelectedVessel` to open the dossier panel, and clears the target to prevent re-selection loops. A `console.warn` fires if the vessel isn't found, providing diagnostic visibility. The same pattern was extended to `DashboardPage.handleSearchSelect` for consistent behavior.

## Cross-Slice Verification

| Success Criterion | Status | Evidence |
|---|---|---|
| `/fleet` route renders grouped table of all active anomalies | ✅ Pass | `src/app/(protected)/fleet/page.tsx` groups by `anomalyType`, renders via `AnomalyTable`. Header tab wired. |
| Expanding any anomaly row fetches inline intelligence dossier with risk scores and sanctions | ✅ Pass | `AnomalyTable` tracks `expandedImo`, renders `FleetVesselDetail` in `colSpan={6}` row. Component fetches `/api/vessels/{imo}/risk` and `/history`. |
| "Show on Map" navigates to main map centered on selected vessel | ✅ Pass | `handleShowOnMap` calls `setMapCenter` + `setTargetVesselImo` + `router.push('/dashboard')`. `VesselMap` useEffect resolves target → `setSelectedVessel` → clears target. |
| No runtime type errors | ✅ Pass | `npx tsc --noEmit` — zero errors. `npx vitest run` — 379 tests passed, 0 failures. |

**Definition of Done verification:**
- ✅ `/fleet` page categorizes all active anomalies into collapsible tables (grouped by type, sorted by frequency)
- ✅ `FleetVesselDetail` fetches and renders risk scores, anomaly history, and sanctions info inline
- ✅ "Show on Map" button redirects to `/dashboard` with correct vessel context via `targetVesselImo` pending state
- ✅ All integration and UI scenarios pass without runtime type errors (tsc clean, 379/379 tests pass)

## Requirement Changes

No formal requirements tracked (legacy mode — REQUIREMENTS.md does not exist). No requirement transitions to report.

## Forward Intelligence

### What the next milestone should know
- The `/fleet` page is fully operational and wired into the main navigation. The pending identifier pattern (`targetVesselImo`) is a reusable approach for any future cross-route entity selection — the pattern, store shape, and consumer effect are documented in KNOWLEDGE.md.
- The `/api/anomalies` endpoint now joins three tables (`vessel_anomalies`, `vessels`, `vessel_risk_scores`). Any schema changes to these tables must be reflected in the query.
- The default vessel filter is now `tankersOnly: false` — all vessel types are shown globally. This was changed in S01 to support fleet-wide views.

### What's fragile
- **Client-side grouping** — Grouping anomalies by type happens entirely on the client. If the anomaly dataset grows beyond ~10k entries, this will need server-side aggregation with pagination. Currently acceptable for typical fleet sizes.
- **Position extraction** — `extractPosition()` in `FleetVesselDetail` uses a switch on `AnomalyType` to locate coordinates. New anomaly types must add a case branch or "Show on Map" stays permanently disabled for them.
- **Target vessel hydration timing** — The `useEffect` in `VesselMap` fires immediately on mount. If `/api/vessels` is slow, a `console.warn` fires before data arrives. The effect re-runs when `vessels` updates so it self-heals, but the warning log creates noise during slow loads.

### Authoritative diagnostics
- Browser console `[VesselStore]` / `[VesselMap]` log sequence traces the full cross-route lifecycle (set → hydrated/not-found → cleared)
- Zustand DevTools: `targetVesselImo` should be `null` in steady state; a non-null string means hydration failed or is pending
- `/fleet` page renders explicit error messages in a red-accented container on API fetch failure
- Network tab: check `/api/vessels/{imo}/risk` and `/api/vessels/{imo}/history` responses if the dossier renders empty

### What assumptions changed
- No assumptions changed during execution. All three slices were implemented as planned without deviations.

## Files Created/Modified

- `src/stores/vessel.ts` — Added `targetVesselImo` pending state, `setTargetVesselImo` action, changed default `tankersOnly` to `false`
- `src/app/api/anomalies/route.ts` — Joined `vessels` and `vessel_risk_scores` tables, added `vesselName`, `flag`, `riskScore` to payload
- `src/types/anomaly.ts` — Updated type to include vessel metadata fields
- `src/components/ui/Header.tsx` — Added Fleet tab to navigation
- `src/app/(protected)/fleet/page.tsx` — Created Fleet overview page with client-side anomaly grouping, loading/error states
- `src/components/fleet/AnomalyTable.tsx` — Created terminal-styled collapsible anomaly table with row expansion state
- `src/components/fleet/FleetVesselDetail.tsx` — Created inline dossier component with risk scores, history, sanctions, and "Show on Map" action
- `src/components/map/VesselMap.tsx` — Added useEffect for `targetVesselImo` hydration with graceful failure warning
- `src/app/(protected)/dashboard/page.tsx` — Updated `handleSearchSelect` to emit `targetVesselImo` for consistent cross-route behavior
