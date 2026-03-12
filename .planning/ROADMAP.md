# Roadmap: Tanker Tracker

## Overview

The project builds in four phases ordered by dependency: first the data pipeline and interactive map (nothing else is possible without positions flowing into storage), then the intelligence enrichment layers that make the map meaningful (sanctions, prices, news, chokepoints), then anomaly detection and vessel watchlisting (which require accumulated position history to calibrate), and finally the historical analytics view (which requires weeks of stored data to be useful). Each phase delivers a coherent, shareable capability that the next phase builds on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - AIS data pipeline, interactive map, and password-protected access
- [x] **Phase 2: Intelligence Layers** - Sanctions flags, oil prices, news feed, vessel search, and chokepoint widgets (completed 2026-03-12)
- [x] **Phase 3: Anomaly Detection** - Going-dark detection, route anomaly flags, and vessel watchlist with alerts (completed 2026-03-12)
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
**Plans:** 5/5 plans complete

Plans:
- [x] 01-01-PLAN.md — Project setup, dependencies, TypeScript types, test scaffolds
- [x] 01-02-PLAN.md — TimescaleDB schema, database connection pool, CRUD functions
- [x] 01-03-PLAN.md — Password auth with bcrypt, JWT sessions, route protection
- [x] 01-04-PLAN.md — AIS message parser, GPS filter, standalone WebSocket ingester
- [x] 01-05-PLAN.md — Mapbox GL map, vessel panel, filters, freshness indicator, mobile layout

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
**Plans:** 4/4 plans complete

Plans:
- [x] 02-01-PLAN.md — Wave 0: Install dependencies, extend schema, create test scaffolds
- [x] 02-02-PLAN.md — Sanctions layer: OpenSanctions integration, IMO matching, vessel badges
- [x] 02-03-PLAN.md — Oil prices + News: Alpha Vantage/FRED fetchers, NewsAPI headlines, panels
- [x] 02-04-PLAN.md — Search + Chokepoints: Vessel search autocomplete, chokepoint widgets

### Phase 3: Anomaly Detection
**Goal**: The system detects and surfaces suspicious vessel behavior — AIS gaps in coverage zones, loitering, and route deviations — and users can create a watchlist to receive alerts on specific vessels
**Depends on**: Phase 2
**Requirements**: ANOM-01, ANOM-02, HIST-02
**Success Criteria** (what must be TRUE):
  1. User can see vessels flagged for going dark (AIS gap in a terrestrial coverage zone) with a confidence indicator distinguishing suspected from confirmed
  2. User can see vessels flagged for route anomalies including loitering and unusual deviations from expected paths
  3. User can add vessels to a personal watchlist and receive an alert when a watched vessel triggers an anomaly or enters a monitored chokepoint
**Plans:** 4/4 plans complete

Plans:
- [x] 03-01-PLAN.md — Schema extension, type definitions, geo utilities (haversine, coverage zones, anchorages)
- [x] 03-02-PLAN.md — Detection logic: going-dark, loitering, speed anomaly, cron jobs
- [x] 03-03-PLAN.md — Watchlist and alerts: CRUD, APIs, Zustand state
- [x] 03-04-PLAN.md — UI integration: anomaly badges, vessel panel, notification bell, watchlist sidebar

### Phase 4: Historical Analytics
**Goal**: Users can explore accumulated tanker traffic trends, route-level patterns, and correlations with oil price movements over selectable time ranges
**Depends on**: Phase 3
**Requirements**: HIST-01
**Success Criteria** (what must be TRUE):
  1. User can view historical tanker traffic charts by route or chokepoint over a selectable time range
  2. User can see oil price overlaid against vessel traffic volume to identify correlation patterns
  3. Charts render from data accumulated since Phase 1 without blocking the live data write path
**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md — Types, route classification, analytics DB queries (TimescaleDB time_bucket)
- [ ] 04-02-PLAN.md — Zustand store, traffic API, correlation API endpoints
- [ ] 04-03-PLAN.md — TrafficChart, selectors, analytics page, header navigation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete    | 2026-03-12 |
| 2. Intelligence Layers | 4/4 | Complete    | 2026-03-12 |
| 3. Anomaly Detection | 4/4 | Complete    | 2026-03-12 |
| 4. Historical Analytics | 1/3 | In Progress | - |

---
*Roadmap created: 2026-03-11*
*Phase 1 planned: 2026-03-11*
*Phase 2 planned: 2026-03-11*
*Phase 3 planned: 2026-03-11*
*Phase 4 planned: 2026-03-12*
