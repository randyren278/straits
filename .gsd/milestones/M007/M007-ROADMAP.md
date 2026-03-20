# M007: Fleet Status Matrix & Sanctions Priority

**Vision:** A high-density, terminal-style fleet overview that prioritizes sanctioned vessels and provides an instant cross-sectional heatmap of all fleet anomalies, reducing cognitive load by defaulting detailed lists to a collapsed state.

## Success Criteria

- The `/fleet` page renders a highly visible "Sanctioned Vessels" section at the very top, listing all ships with active sanctions.
- All existing anomaly tables start in a collapsed state by default.
- A new "Anomaly Matrix" heatmap renders at the top of the page, displaying the count of active anomalies intersected by Ship Type (Tanker, Cargo, Other) and Anomaly Type.
- The heatmap cells glow brighter amber depending on the density/count of anomalies within that intersection.

## Key Risks / Unknowns

- API Data Completeness — The `/api/anomalies` endpoint does not currently return the underlying `ship_type` integer needed to categorize vessels into Tanker, Cargo, or Other on the frontend.
- Visual Hierarchy — Balancing the layout between the new Heatmap, the Sanctioned Vessels list, and the grouped anomaly tables without cluttering the viewport.

## Proof Strategy

- API Data Completeness → retire in S02 by modifying the `SELECT` query in `/api/anomalies` to return `ship_type` (or a categorized string), proving the frontend can aggregate and render the matrix dynamically.
- Visual Hierarchy → retire in S01 by proving the new "Sanctioned Vessels" section sits cleanly above the collapsed tables.

## Verification Classes

- Contract verification: The `Anomaly` TypeScript interface and `/api/anomalies` SQL query are updated to include a `shipCategory` field.
- Integration verification: The `AnomalyMatrix` component accurately counts and distributes anomalies across the grid based on the API payload.
- Operational verification: None required.
- UAT / human verification: Visual inspection of the heatmap cell luminescence (amber scaling) and validation that the anomaly tables default to closed.

## Milestone Definition of Done

This milestone is complete only when all are true:

- The `AnomalyTable` component initializes in a collapsed state.
- A "Sanctioned Vessels" list is prominently displayed at the top of the `/fleet` page.
- The `AnomalyMatrix` component renders a grid of Ship Types (rows) vs. Anomaly Types (columns), with cell brightness mapped to the anomaly count.
- The backend API provides the necessary vessel category data to power the matrix.

## Requirement Coverage

- Covers: Legacy mode (REQUIREMENTS.md is missing; no requirement coverage tracked)
- Partially covers: None
- Leaves for later: None
- Orphan risks: None

## Slices

- [ ] **S01: Default-Collapsed Tables & Sanctions Priority List** `risk:low` `depends:[]`
  > After this: Users visiting `/fleet` see anomaly tables collapsed by default and a new, highly visible section at the top listing all sanctioned vessels.

- [ ] **S02: The Anomaly Matrix Visualizer** `risk:medium` `depends:[S01]`
  > After this: A dense, terminal-style heatmap grid renders at the top of the fleet page, providing an instant cross-section of anomalies by ship type.

## Boundary Map

### S01 → S02

Produces:
- Updates to `AnomalyTable` component state (`defaultExpanded={false}`).
- A new `SanctionedVessels` component fed by filtering the existing `anomalies` state for `isSanctioned === true`.

Consumes:
- `GET /api/anomalies` payload.

### S02 (Final Assembly)

Produces:
- Updated `GET /api/anomalies` endpoint and `Anomaly` type interface, adding `v.ship_type` mapped to `'tanker' | 'cargo' | 'other'`.
- `AnomalyMatrix` component aggregating the modified anomaly payload by `shipCategory` and `anomalyType`.

Consumes:
- The modified array of `Anomaly` objects fetched in `FleetPage`.
