---
estimated_steps: 5
estimated_files: 2
---

# T01: Build FleetVesselDetail component with dossier sections and Show on Map button

**Slice:** S02 — Inline Vessel Detail & Map Navigation
**Milestone:** M006

## Description

Create the `FleetVesselDetail` component that renders an inline intelligence dossier when a fleet table row is expanded. This component fetches risk score and history data from existing API endpoints, renders all dossier sections (risk score with factor bars, anomaly history, destination log, sanctions), and provides a "Show on Map" button that navigates to the dashboard and flies the map to the vessel.

The visual patterns should match VesselPanel's dossier sections (read-only reference at `src/components/panels/VesselPanel.tsx`) — same factor bar widths, color coding (red ≥70, amber ≥40, green <40), anomaly badge + timestamp rows, and destination previous→current format. However, this is a new standalone component, NOT extracted from VesselPanel.

**Relevant skills:** `react-best-practices`, `frontend-design`

## Steps

1. **Create `src/components/fleet/FleetVesselDetail.tsx`** with props interface:
   - `imo: string` — vessel IMO for API fetches
   - `anomalyDetails: GoingDarkDetails | LoiteringDetails | DeviationDetails | SpeedDetails | RepeatGoingDarkDetails | StsTransferDetails` — the anomaly's `details` object for position extraction
   - `anomalyType: AnomalyType` — to determine if "Show on Map" can extract a position

2. **Implement data fetching on mount** using `useEffect` with `Promise.all`:
   - `fetch('/api/vessels/${imo}/risk')` → sets `riskScore` state (`{ score, factors, computedAt }`) and `sanctionDetail` state
   - `fetch('/api/vessels/${imo}/history')` → sets `anomalyHistory` and `destChanges` state
   - Add `loading` boolean state (starts true, false after both resolve)
   - Add `error` string state for fetch failures
   - Log errors to `console.error('[FleetVesselDetail]', ...)` with IMO for correlation
   - Pattern reference: VesselPanel's `fetchDossier` function at lines ~70-95

3. **Render dossier sections** in a horizontal layout suitable for a table-spanning row:
   - **Risk Score section**: Score number with color coding + factor bars (Going Dark/40, Sanctions/25, Flag Risk/15, Loitering/10, STS Events/10) using `width: ${(value/max)*100}%` and color classes (red ≥70%, amber ≥40%, green <40%). Show "RISK SCORE UNAVAILABLE" on error. Import `RiskFactors` from `@/lib/db/risk-scores`.
   - **Anomaly History section**: Collapsible list showing `AnomalyBadge` + formatted timestamp per row. Import `AnomalyBadge` from `@/components/ui/AnomalyBadge`. Use `format` from `date-fns` for `MM/dd HH:mm` formatting.
   - **Destination Log section**: List of `previous → current + timestamp` entries.
   - **Sanctions section**: If `sanctionDetail` exists, render alert block with authority, datasets, aliases, and OpenSanctions link (same pattern as VesselPanel's sanctions block).
   - Loading state: pulsing "LOADING INTELLIGENCE..." text
   - Error state: red error message inline

4. **Implement "Show on Map" button** with position extraction:
   - Extract lat/lon from `anomalyDetails` based on `anomalyType`:
     - `going_dark` → `(details as GoingDarkDetails).lastPosition.lat/lon`
     - `loitering` → `(details as LoiteringDetails).centroid.lat/lon`
     - `speed` → `(details as SpeedDetails).lastPosition.lat/lon`
     - `sts_transfer` → `(details as StsTransferDetails).lat/lon`
     - `deviation` → no position available → button disabled
     - `repeat_going_dark` → no position available → button disabled
   - On click: call `useVesselStore.getState().setMapCenter({ lat, lon, zoom: 12 })` then `router.push('/dashboard')` (use `useRouter` from `next/navigation`)
   - When disabled: show tooltip "Position data not available for this anomaly type"
   - Style: amber border button matching Bloomberg aesthetic, `font-mono text-xs uppercase tracking-widest`

5. **Verify build compiles** — `npm run build` must succeed with zero TypeScript errors.

## Must-Haves

- [ ] Component fetches both `/api/vessels/{imo}/risk` and `/api/vessels/{imo}/history` on mount
- [ ] Risk score renders with factor bars using same visual pattern as VesselPanel
- [ ] Anomaly history renders with AnomalyBadge and timestamps
- [ ] Destination log renders with previous→current format
- [ ] Sanctions block renders when sanctionDetail is present
- [ ] Loading and error states handle fetch failures gracefully
- [ ] "Show on Map" button extracts position from anomaly details by type
- [ ] "Show on Map" calls setMapCenter + router.push('/dashboard')
- [ ] "Show on Map" disabled for deviation and repeat_going_dark types

## Verification

- `npm run build` — zero errors
- `test -f src/components/fleet/FleetVesselDetail.tsx` — file exists
- `grep -q 'setMapCenter' src/components/fleet/FleetVesselDetail.tsx` — map navigation wired
- `grep -q 'Show on Map' src/components/fleet/FleetVesselDetail.tsx` — button present
- `grep -q '/api/vessels/' src/components/fleet/FleetVesselDetail.tsx` — API fetches present
- `grep -q 'factors' src/components/fleet/FleetVesselDetail.tsx` — risk factor rendering present
- `grep -q 'AnomalyBadge' src/components/fleet/FleetVesselDetail.tsx` — anomaly history rendering present

## Inputs

- `src/components/panels/VesselPanel.tsx` — Read-only reference for visual patterns. Key sections to replicate: risk score bar rendering (lines ~225-260), anomaly history list (lines ~270-300), destination log (lines ~310-340), sanctions block (lines ~155-220). Do NOT import from or modify this file.
- `src/types/anomaly.ts` — Type definitions for AnomalyType, Confidence, and all detail interfaces (GoingDarkDetails, LoiteringDetails, etc.). The discriminated union on `details` enables type-safe position extraction.
- `src/lib/db/risk-scores.ts` — `RiskFactors` interface with factor caps: goingDark(40), flagRisk(15), sanctions(25), loitering(10), sts(10).
- `src/stores/vessel.ts` — `useVesselStore` with `setMapCenter(center: MapCenter | null)` where `MapCenter = { lat, lon, zoom }`. Also `setSelectedVessel` for optionally pre-selecting the vessel on the map.
- API response shapes:
  - `GET /api/vessels/{imo}/risk` → `{ score, factors: RiskFactors, computedAt, sanction: { authority, riskCategory, datasets, flag, aliases, opensanctionsUrl, vesselType, name } | null }`
  - `GET /api/vessels/{imo}/history` → `{ anomalies: Array<{ id, anomalyType, confidence, detectedAt, resolvedAt, details }>, destinationChanges: Array<{ id, previousDestination, newDestination, changedAt }> }`

## Expected Output

- `src/components/fleet/FleetVesselDetail.tsx` — New component (~150-180 lines) rendering the inline vessel intelligence dossier with all sections, data fetching, loading/error states, and "Show on Map" navigation button.

## Observability Impact

- **New signals:** `[FleetVesselDetail]` console.error logs emitted on API fetch failures, tagged with IMO number for correlation with server-side logs.
- **Inspection:** Two API fetches per row expand (`/api/vessels/{imo}/risk`, `/api/vessels/{imo}/history`) visible in Network tab. `mapCenter` Zustand state mutation visible in React DevTools on "Show on Map" click.
- **Failure states:** Loading indicator visible during fetch. Inline red error text on fetch failure. "RISK SCORE UNAVAILABLE" when risk endpoint returns non-200. Disabled map button with tooltip for position-less anomaly types (deviation, repeat_going_dark).
