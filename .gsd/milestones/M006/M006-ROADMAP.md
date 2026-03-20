# M006: Fleet Overview

**Vision:** A dedicated fleet-wide intelligence dashboard that aggregates active anomalies by category, rendering inline vessel dossiers with deep history and risk scores to accelerate operator triage and map navigation.

## Success Criteria

- The `/fleet` overview route renders a grouped table of all active anomalies across the fleet.
- Expanding any anomaly row fetches and displays an inline intelligence dossier containing risk scores and sanctions history.
- Clicking the "Show on Map" action successfully navigates the user to the main map centered on the selected vessel.

## Key Risks / Unknowns

- Data density — The `/api/anomalies` endpoint might return too many vessels, causing client-side rendering or memory strain.
- Map state hydration — Navigating from the fleet page to the dashboard map must reliably center the deck.gl viewport on the exact coordinates and vessel without losing state.

## Proof Strategy

- Data density → retire in S01 by proving the grouped anomaly tables can gracefully render the active dataset and handle empty states.
- Map state hydration → retire in S02 by proving the inline "Show on Map" interaction successfully loads the `/dashboard` route with the correct vessel focused and the store updated.

## Verification Classes

- Contract verification: Next.js API endpoints for anomalies, risk, and history return expected JSON shapes.
- Integration verification: Fleet page correctly groups anomalies; inline detail correctly fetches and displays vessel-specific data.
- Operational verification: None required.
- UAT / human verification: Visual inspection of the Bloomberg-terminal styling (bg-black, amber accents, font-mono), functional testing of the row expansion, and map navigation click-through.

## Milestone Definition of Done

This milestone is complete only when all are true:

- The `/fleet` page correctly categorizes all active anomalies into collapsible tables.
- The `FleetVesselDetail` component correctly fetches and renders risk scores, anomaly history, and sanctions info inline.
- The "Show on Map" button successfully redirects the user to the `/dashboard` interface with the correct vessel context applied.
- All integration and UI scenarios pass without runtime type errors.

## Requirement Coverage

- Covers: Legacy mode (REQUIREMENTS.md is missing; no requirement coverage tracked)
- Partially covers: None
- Leaves for later: None
- Orphan risks: None

## Slices

- [x] **S01: Fleet Overview Page & Grouped Anomaly Tables** `risk:medium` `depends:[]`
  > After this: Users can visit `/fleet` to view all active anomalies grouped by category in collapsible data tables.

- [x] **S02: Inline Vessel Detail & Map Navigation** `risk:low` `depends:[S01]`
  > After this: Users can expand any anomaly row to see a detailed risk dossier and click "Show on Map" to jump to that vessel's map position.

- [ ] **S03: End-to-End Fleet Integration & Verification** `risk:low` `depends:[S02]`
  > After this: The entire fleet workflow is proven to operate seamlessly from global overview down to specific vessel map tracking in a real environment.

## Boundary Map

### S01 → S02
Produces:
- `/fleet` route rendering the `AnomalyTable` component.
- Grouped `AnomalyType` data structures passed to tables.

Consumes:
- `GET /api/anomalies` payload: `{ anomalies: Anomaly[] }`

### S02 → S03
Produces:
- `FleetVesselDetail` component that fetches isolated `/api/vessels/[imo]/history` and `/api/vessels/[imo]/risk`.
- `handleShowOnMap` function mapping anomaly details to coordinate state in `useVesselStore`.

Consumes:
- Nested state within `AnomalyTable` representing currently expanded rows.
- The `Anomaly` object model constructed in S01.

### S03 (Final Assembly)
Produces:
- E2E testing/verification artifacts (if added) or passing visual verification of the combined S01 and S02 features working together.

Consumes:
- All `/fleet` page routing functionality.
- Zustand `useVesselStore` state updates.
