---
id: S01
parent: M006
milestone: M006
provides:
  - Default all-vessels filter
  - /api/anomalies endpoint returning vesselName, flag, and riskScore
  - /fleet page with grouped anomaly tables
  - AnomalyTable component supporting expandable rows
requires: []
affects:
  - S02
key_files:
  - src/stores/vessel.ts
  - src/app/api/anomalies/route.ts
  - src/app/(protected)/fleet/page.tsx
  - src/components/fleet/AnomalyTable.tsx
key_decisions:
  - Grouping anomalies by type client-side in the /fleet page
  - Joining vessel_risk_scores in /api/anomalies query for immediate risk display
patterns_established:
  - Terminal aesthetic for tables (bg-black, amber accents, font-mono, uppercase tracking-widest labels, no border-radius)
  - Explicit error state block on /fleet page
observability_surfaces:
  - Console error logging in /api/anomalies SQL failure
  - User-visible error string on /fleet fetch failure
drill_down_paths: []
duration: 1h 30m
verification_result: passed
completed_at: 2026-03-20
---

# S01: Fleet Overview Page & Grouped Anomaly Tables

**Shipped `/fleet` dashboard tab with grouped anomaly tables and enhanced `/api/anomalies` with vessel metadata.**

## What Happened

We updated the default global view to show all vessels (`tankersOnly: false` in `src/stores/vessel.ts`). To support the new fleet overview, we enhanced `GET /api/anomalies` to join against the `vessels` and `vessel_risk_scores` tables, enriching the returned JSON payload with `vesselName`, `flag`, and `riskScore`.

We created the `/fleet` page which fetches the anomaly payload on mount, handles loading and error states cleanly with a terminal aesthetic, and groups anomalies client-side by `anomalyType` (sorted by frequency). Each group renders via a new `AnomalyTable` component. `AnomalyTable` implements a collapsible list showing the vessel name, IMO, flag, risk score (color-coded by severity), confidence badge, and detection timestamp, leaving the architecture ready for inline expansion in S02. We also wired the "Fleet" tab into the main `Header` navigation.

## Verification

- Built project via `npm run build` with zero TypeScript errors.
- Ran test suite via `npx vitest run`; all 379 tests passed.
- Verified `tankersOnly` defaults to `false` in `src/stores/vessel.ts`.
- Verified `vesselName` appears in `src/app/api/anomalies/route.ts` query.
- Verified `/fleet` route exists and handles error states correctly without crashing.
- Verified `AnomalyTable.tsx` exists and exposes necessary row data.
- Verified `Header.tsx` includes the `/fleet` tab.

## Deviations

None.

## Known Limitations

- `AnomalyTable` rows are built for expansion, but the deep intelligence payload is not fetched or handled at this stage (deferred to S02).

## Follow-ups

- S02 will fetch intelligence and risk profiles on row expansion and handle the "Show on Map" interaction.

## Files Created/Modified

- `src/stores/vessel.ts` — changed default `tankersOnly` filter to `false`
- `src/app/api/anomalies/route.ts` — added vessel metadata and risk scores to payload
- `src/types/anomaly.ts` — updated type to include vessel metadata
- `src/components/ui/Header.tsx` — added Fleet tab to nav
- `src/app/(protected)/fleet/page.tsx` — created Fleet overview page with client-side anomaly grouping
- `src/components/fleet/AnomalyTable.tsx` — created terminal-styled collapsible anomaly table component

## Forward Intelligence

### What the next slice should know
- `AnomalyTable` already tracks the expanded state per IMO via `expandedImo` state variable. S02 only needs to ensure `FleetVesselDetail` efficiently hooks into this state to fetch specific intel without redundant queries.

### What's fragile
- Client-side grouping could bottleneck if the anomaly dataset grows extremely large (>10k). This is acceptable for now but might need server-side aggregation later.

### Authoritative diagnostics
- `/fleet` page renders explicit error messages in a red-accented container on fetch failure.
- `GET /api/anomalies` response payload schema should be inspected first if tables render empty unexpectedly.

### What assumptions changed
- None.
