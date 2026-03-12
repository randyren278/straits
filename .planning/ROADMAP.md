# Roadmap: Tanker Tracker

## Overview

The project builds in four phases ordered by dependency: first the data pipeline and interactive map (nothing else is possible without positions flowing into storage), then the intelligence enrichment layers that make the map meaningful (sanctions, prices, news, chokepoints), then anomaly detection and vessel watchlisting (which require accumulated position history to calibrate), and finally the historical analytics view (which requires weeks of stored data to be useful). Each phase delivers a coherent, shareable capability that the next phase builds on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - AIS data pipeline, interactive map, and password-protected access
- [ ] **Phase 2: Intelligence Layers** - Sanctions flags, oil prices, news feed, vessel search, and chokepoint widgets
- [ ] **Phase 3: Anomaly Detection** - Going-dark detection, route anomaly flags, and vessel watchlist with alerts
- [ ] **Phase 4: Historical Analytics** - Charts, trends, and oil price correlation over accumulated position history

## Phase Details

### Phase 1: Foundation
**Goal**: Users can access a password-protected, live tanker tracking map showing vessel positions across the Middle East and major export routes, with positions accumulating in storage from the first run
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, AUTH-01, MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-08
**Success Criteria** (what must be TRUE):
  1. User must enter a password to access the dashboard; unauthenticated requests to any API route are rejected
  2. User can see live tanker positions rendered on an interactive WebGL map covering the Middle East and major export routes, updated within minutes of the AIS stream
  3. User can click any vessel to see its identity panel: name, flag, speed, heading, destination, and IMO number
  4. User can filter to show only tankers and can toggle vessel track history as a polyline on the map
  5. Dashboard is usable on a mobile device; a data freshness indicator shows the time of the last AIS update
**Plans**: TBD

### Phase 2: Intelligence Layers
**Goal**: The live map is enriched with sanctions flags, oil price context, geopolitical news, vessel search, and chokepoint vessel counts — completing the full situational awareness picture
**Depends on**: Phase 1
**Requirements**: INTL-01, INTL-02, INTL-03, MAP-06, MAP-07
**Success Criteria** (what must be TRUE):
  1. User can see sanctions flags on vessels matched against OFAC and EU sanctioned entities via IMO number
  2. User can view a panel showing current WTI and Brent crude prices with a 30-day chart
  3. User can read a live news feed of geopolitical headlines filtered for Middle East and oil keywords
  4. User can search for a vessel by name or IMO number and have it highlighted on the map
  5. User can see chokepoint monitoring widgets showing current vessel counts for Hormuz, Bab el-Mandeb, and Suez
**Plans**: TBD

### Phase 3: Anomaly Detection
**Goal**: The system detects and surfaces suspicious vessel behavior — AIS gaps in coverage zones, loitering, and route deviations — and users can create a watchlist to receive alerts on specific vessels
**Depends on**: Phase 2
**Requirements**: ANOM-01, ANOM-02, HIST-02
**Success Criteria** (what must be TRUE):
  1. User can see vessels flagged for going dark (AIS gap in a terrestrial coverage zone) with a confidence indicator distinguishing suspected from confirmed
  2. User can see vessels flagged for route anomalies including loitering and unusual deviations from expected paths
  3. User can add vessels to a personal watchlist and receive an alert when a watched vessel triggers an anomaly or enters a monitored chokepoint
**Plans**: TBD

### Phase 4: Historical Analytics
**Goal**: Users can explore accumulated tanker traffic trends, route-level patterns, and correlations with oil price movements over selectable time ranges
**Depends on**: Phase 3
**Requirements**: HIST-01
**Success Criteria** (what must be TRUE):
  1. User can view historical tanker traffic charts by route or chokepoint over a selectable time range
  2. User can see oil price overlaid against vessel traffic volume to identify correlation patterns
  3. Charts render from data accumulated since Phase 1 without blocking the live data write path
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. Intelligence Layers | 0/TBD | Not started | - |
| 3. Anomaly Detection | 0/TBD | Not started | - |
| 4. Historical Analytics | 0/TBD | Not started | - |

---
*Roadmap created: 2026-03-11*
