# Roadmap: Tanker Tracker

## Overview

The project builds in four phases ordered by dependency: first the data pipeline and interactive map (nothing else is possible without positions flowing into storage), then the intelligence enrichment layers that make the map meaningful (sanctions, prices, news, chokepoints), then anomaly detection and vessel watchlisting (which require accumulated position history to calibrate), and finally the historical analytics view (which requires weeks of stored data to be useful). Each phase delivers a coherent, shareable capability that the next phase builds on.

v1.1 (Polish & Ship) continues from Phase 4, adding three phases that transform the working prototype into a shareable, production-ready tool: UI redesign to match the Bloomberg terminal aesthetic, full data pipeline wiring so every panel shows real live data, and documentation so the app can be handed to friends and deployed independently.

v1.2 (All-Vessels Intelligence) continues from Phase 7, adding three phases that expand scope from tankers-only to all AIS ship types across anomaly detection and analytics, and add live vessel enumeration inside each chokepoint zone.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - AIS data pipeline, interactive map, and password-protected access
- [x] **Phase 2: Intelligence Layers** - Sanctions flags, oil prices, news feed, vessel search, and chokepoint widgets (completed 2026-03-12)
- [x] **Phase 3: Anomaly Detection** - Going-dark detection, route anomaly flags, and vessel watchlist with alerts (completed 2026-03-12)
- [x] **Phase 4: Historical Analytics** - Charts, trends, and oil price correlation over accumulated position history (completed 2026-03-12)
- [x] **Phase 5: UI Redesign** - Bloomberg terminal aesthetic: true black, amber accents, monospace data, hard-bordered grid layout (completed 2026-03-13)
- [x] **Phase 6: Data Wiring** - All data sources live end-to-end: real AIS, oil prices, news, sanctions flags, anomaly crons, and system status bar (completed 2026-03-13)
- [x] **Phase 7: Documentation** - README covers full local setup and production deployment; .gitignore properly excludes secrets and build artifacts (completed 2026-03-13)
- [ ] **Phase 8: All-Ships Anomalies** - Lift tanker-only filters in anomaly detection backend and alert panel; ship type filter in alerts UI
- [ ] **Phase 9: All-Ships Analytics** - Lift tanker-only filters in traffic charts; add ship type filter UI to analytics page
- [ ] **Phase 10: Chokepoint Live Ships** - API and UI listing vessels currently inside each chokepoint zone with map navigation

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
**Plans:** 3/3 plans complete

Plans:
- [x] 04-01-PLAN.md — Types, route classification, analytics DB queries (TimescaleDB time_bucket)
- [x] 04-02-PLAN.md — Zustand store, traffic API, correlation API endpoints
- [x] 04-03-PLAN.md — TrafficChart, selectors, analytics page, header navigation

### Phase 5: UI Redesign
**Goal**: The dashboard looks and feels like a Bloomberg terminal — every panel has hard borders, true black backgrounds, amber accents, and monospace data rendering, with no rounded corners or floating overlays
**Depends on**: Phase 4
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. Dashboard background is true black (#000000) with amber (#f59e0b) as the only accent color — no navy, purple, or blue present anywhere
  2. All data values (prices, coordinates, IMO numbers, speed, headings) render in a monospace font (JetBrains Mono or equivalent)
  3. Dashboard uses a fixed grid layout with hard 1px borders; data panels sit alongside the map rather than floating over it as overlays
  4. Data panels have no rounded corners and present information at tight line spacing matching terminal density
  5. Active navigation state uses amber accent; no blue highlights appear in the header or nav
**Plans:** 3/3 plans complete

Plans:
- [x] 05-01-PLAN.md — Design tokens: globals.css @theme (radius reset, JetBrains Mono) + layout.tsx font registration
- [x] 05-02-PLAN.md — Dashboard CSS Grid restructure + panel terminal styling (Wave 2)
- [x] 05-03-PLAN.md — Color sweep: Header, analytics page, UI widgets, TrafficChart (Wave 2)

### Phase 6: Data Wiring
**Goal**: Every data source is connected and delivering real data end-to-end — AIS ingester runs with a single command, prices and news come from live APIs, sanctions flags appear on ingested vessels, anomaly crons fire on schedule, and a system status bar shows the health of each source
**Depends on**: Phase 5
**Requirements**: WIRE-01, WIRE-02, WIRE-03, WIRE-04, WIRE-05, WIRE-06
**Success Criteria** (what must be TRUE):
  1. Running a single npm script starts the AIS ingester, which logs "connected" or "failed" to console within seconds
  2. Oil price panel displays real WTI and Brent values fetched from Alpha Vantage (FRED as fallback) — not mock data
  3. News panel displays real geopolitical headlines from NewsAPI — not placeholder text
  4. Sanctioned vessels ingested via AIS show a sanctions flag on the map matched by IMO number
  5. System status bar shows live/degraded/offline state per source (AIS, prices, news) reflecting actual API connectivity
  6. Anomaly detection crons execute on schedule and produce real alerts visible in the notification bell for watched vessels
**Plans:** 3/3 plans complete

Plans:
- [x] 06-01-PLAN.md — Refresh jobs (prices/news/sanctions) + ingester npm scripts (Wave 1)
- [x] 06-02-PLAN.md — /api/status endpoint + StatusBar component (Wave 1)
- [x] 06-03-PLAN.md — Human verification checkpoint: end-to-end wiring confirmed (Wave 2)

### Phase 7: Documentation
**Goal**: A person who has never seen the codebase can clone the repo, follow the README, and have the app running locally — and know how to deploy it to production without asking for help
**Depends on**: Phase 6
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04
**Success Criteria** (what must be TRUE):
  1. README contains step-by-step local setup instructions covering prerequisites, environment variables, Docker startup, schema migration, and running the ingester
  2. Every required environment variable is listed in the README with a description and instructions for where to obtain it
  3. README includes a production deployment section covering hosting options, environment configuration, and ingester deployment
  4. .gitignore excludes .env files, build artifacts, TimescaleDB data volumes, and local logs — no secrets or large files would be committed on a fresh clone
**Plans:** 3/3 plans complete

Plans:
- [x] 07-01-PLAN.md — Fix .gitignore (complete exclusion rules) + update .env.example (all 8 vars)
- [x] 07-02-PLAN.md — Write README.md (local setup + env var table + production deployment)
- [x] 07-03-PLAN.md — Human verification checkpoint: README walkthrough + .gitignore checks (Wave 2)

### Phase 8: All-Ships Anomalies
**Goal**: Anomaly detection runs on every vessel type in the AIS stream, not just tankers, and users can filter the alerts panel by ship type to focus on the vessel classes they care about
**Depends on**: Phase 7
**Requirements**: ANOM-05, ANOM-06
**Success Criteria** (what must be TRUE):
  1. Going-dark and loitering detections appear for cargo ships, bulk carriers, and other vessel types — not only vessels with tanker ship type codes
  2. The anomaly/alerts panel shows a ship type filter; selecting a type limits the visible alerts to that class of vessel
  3. Filtering by ship type does not change detection logic — it only affects panel display
  4. Existing tanker anomaly alerts remain visible and correctly filtered when "tanker" is selected
**Plans:** 2 plans

Plans:
- [ ] 08-01-PLAN.md — Remove tanker-only ship_type filter from all three detection jobs
- [ ] 08-02-PLAN.md — Ship type filter in /api/anomalies + NotificationBell panel

### Phase 9: All-Ships Analytics
**Goal**: Historical traffic charts show all vessel types with a breakdown by ship type, and users can filter the chart to compare tanker volume against cargo, bulk, or all-vessel totals
**Depends on**: Phase 8
**Requirements**: ANLX-05, ANLX-06
**Success Criteria** (what must be TRUE):
  1. The traffic chart on the analytics page counts all vessel types, not only tankers — total volume is visibly higher than the tanker-only baseline
  2. A ship type filter (all / tankers / cargo / other) appears on the analytics page and re-queries the chart when changed
  3. Selecting "tankers" produces a chart identical to the pre-v1.2 baseline (regression check)
  4. The dual Y-axis oil price overlay continues to render correctly regardless of which ship type filter is active
**Plans:** 2 plans

Plans:
- [ ] 08-01-PLAN.md — Remove tanker-only ship_type filter from all three detection jobs
- [ ] 08-02-PLAN.md — Ship type filter in /api/anomalies + NotificationBell panel

### Phase 10: Chokepoint Live Ships
**Goal**: Each chokepoint widget shows the actual vessels currently inside the zone — name, flag, ship type, and anomaly status — and clicking any vessel navigates the map to its position
**Depends on**: Phase 9
**Requirements**: CHKP-01, CHKP-02
**Success Criteria** (what must be TRUE):
  1. Each chokepoint widget (Hormuz, Bab el-Mandeb, Suez) displays a live list of vessel names currently inside its bounding box, refreshed on the same cadence as vessel positions
  2. Each entry in the list shows the vessel's flag, ship type, and an anomaly indicator if the vessel has an active anomaly
  3. Clicking a vessel in the chokepoint list flies the map to that vessel's position and opens its identity panel
  4. The list is empty (with a "no vessels" state) when no vessels are currently inside the zone — it does not show stale data
**Plans:** 2 plans

Plans:
- [ ] 08-01-PLAN.md — Remove tanker-only ship_type filter from all three detection jobs
- [ ] 08-02-PLAN.md — Ship type filter in /api/anomalies + NotificationBell panel

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete    | 2026-03-12 |
| 2. Intelligence Layers | 4/4 | Complete    | 2026-03-12 |
| 3. Anomaly Detection | 4/4 | Complete    | 2026-03-12 |
| 4. Historical Analytics | 3/3 | Complete    | 2026-03-12 |
| 5. UI Redesign | 3/3 | Complete    | 2026-03-13 |
| 6. Data Wiring | 3/3 | Complete    | 2026-03-13 |
| 7. Documentation | 3/3 | Complete    | 2026-03-13 |
| 8. All-Ships Anomalies | 0/? | Not started | - |
| 9. All-Ships Analytics | 0/? | Not started | - |
| 10. Chokepoint Live Ships | 0/? | Not started | - |

---
*Roadmap created: 2026-03-11*
*Phase 1 planned: 2026-03-11*
*Phase 2 planned: 2026-03-11*
*Phase 3 planned: 2026-03-11*
*Phase 4 planned: 2026-03-12*
*v1.1 phases 5–7 added: 2026-03-13*
*Phase 7 planned: 2026-03-13*
*v1.2 phases 8–10 added: 2026-03-17*
