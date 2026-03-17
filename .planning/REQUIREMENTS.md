# Requirements: Tanker Tracker

**Defined:** 2026-03-11
**Updated:** 2026-03-17 (v1.2 requirements added)
**Core Value:** Real-time visibility into Middle Eastern oil tanker movements with enough context (prices, sanctions, anomalies, news) to understand what's happening and why it matters.

## v1.0 Requirements (Complete)

All 20 requirements shipped and validated.

### Data Pipeline
- [x] **DATA-01**: System ingests AIS vessel positions via WebSocket stream for Middle East + major export routes
- [x] **DATA-02**: System stores all vessel positions in TimescaleDB from first run
- [x] **DATA-03**: System uses IMO number as primary vessel identity key
- [x] **DATA-04**: System filters GPS jamming artifacts and impossible speed jumps from position data

### Map & Visualization
- [x] **MAP-01**: User can view interactive map showing live tanker positions with WebGL rendering
- [x] **MAP-02**: User can click a vessel to see identity panel (name, flag, speed, heading, destination, IMO)
- [x] **MAP-03**: User can filter vessels by type (tankers only vs all)
- [x] **MAP-04**: User can view vessel track history as polyline on map
- [x] **MAP-05**: User can see data freshness indicator showing last update time
- [x] **MAP-06**: User can search vessels by name or IMO number
- [x] **MAP-07**: User can view chokepoint monitoring widgets for Hormuz, Bab el-Mandeb, and Suez
- [x] **MAP-08**: User can use the dashboard on mobile devices via responsive layout

### Authentication
- [x] **AUTH-01**: User must enter password to access the dashboard

### Intelligence Layers
- [x] **INTL-01**: User can see sanctions flags on vessels linked to OFAC or EU sanctioned entities
- [x] **INTL-02**: User can view oil price panel showing WTI/Brent current prices and 30-day chart
- [x] **INTL-03**: User can view geopolitical news feed filtered for Middle East and oil keywords

### Anomaly Detection
- [x] **ANOM-01**: System detects and flags vessels that disable AIS transponders (going dark)
- [x] **ANOM-02**: System detects route anomalies including loitering and unusual deviations

### Historical Analytics
- [x] **HIST-01**: User can view historical analytics with charts, trends, and correlations over time
- [x] **HIST-02**: User can create vessel watchlist and receive alerts on watched vessels

## v1.1 Requirements

### UI Redesign

- [x] **UI-01**: Dashboard background is true black with amber (#f59e0b) as the primary accent color — no navy or purple
- [x] **UI-02**: All data values (prices, coordinates, IMO numbers, speed, headings) render in JetBrains Mono or similar monospace font
- [x] **UI-03**: Dashboard uses a grid layout with fixed panel regions and hard 1px borders — no floating overlays on top of map
- [x] **UI-04**: Data panels use no rounded corners and tight information density matching terminal aesthetics
- [x] **UI-05**: Header uses amber accent for active navigation state, not blue

### Data Wiring

- [x] **WIRE-01**: AIS ingester can be started with a single npm script command and logs startup status (connected / failed) to console
- [x] **WIRE-02**: Oil price panel displays real WTI and Brent data fetched from Alpha Vantage with FRED as fallback
- [x] **WIRE-03**: News panel displays real geopolitical headlines fetched from NewsAPI
- [x] **WIRE-04**: Sanctions matching runs on ingested vessels and flags appear on sanctioned ships in the map
- [x] **WIRE-05**: Dashboard shows a system status bar indicating live/degraded/offline state for each data source (AIS, prices, news)
- [x] **WIRE-06**: Anomaly detection cron jobs run on schedule and produce real alerts for watched vessels

### Documentation

- [x] **DOCS-01**: README covers prerequisites, step-by-step local setup (env vars, Docker, schema, ingester)
- [x] **DOCS-02**: README documents every required environment variable with description and where to get it
- [x] **DOCS-03**: README includes production deployment section (hosting options, env config, ingester deployment)
- [x] **DOCS-04**: .gitignore excludes .env files, build artifacts, TimescaleDB data volumes, and local logs

## v1.2 Requirements

### Anomaly Detection (All Ships)

- [x] **ANOM-05**: Anomaly detection (going dark, loitering, speed) runs on all ship types, not just tankers
- [ ] **ANOM-06**: User can filter the anomaly/alerts panel by ship type

### Analytics (All Ships)

- [ ] **ANLX-05**: Historical traffic chart shows vessel counts for all ship types, not just tankers
- [ ] **ANLX-06**: User can filter traffic chart by ship type (all / tankers / cargo / other)

### Chokepoint Intelligence

- [ ] **CHKP-01**: Each chokepoint widget shows a live list of vessels currently inside the zone (name, flag, ship type, anomaly status)
- [ ] **CHKP-02**: User can click a vessel in the chokepoint list to navigate to it on the map

## v2 Requirements

### Advanced Intelligence

- **ADV-01**: System detects ship-to-ship transfers via proximity analysis
- **ADV-02**: User can view vessel ownership graph showing beneficial ownership chains
- **ADV-03**: System identifies dark fleet vessels via flag-hopping and IMO reuse indicators

## Out of Scope

| Feature | Reason |
|---------|--------|
| Satellite imagery / ML ship detection | Enterprise cost, massive complexity — AIS is sufficient |
| Cargo volume / oil quantity estimates | AIS doesn't carry cargo data; inference requires proprietary methods |
| Predictive ETA / route forecasting | Requires route modeling and ML — significant work beyond scope |
| Global coverage (all 300K+ vessels) | Storage, API cost, and rendering collapse at global scale |
| Full user management (accounts, roles) | 3-5x auth complexity for ~5 friends; shared password sufficient |
| Trading automation / signals | Regulatory risk; project is for awareness, not algo trading |
| Mobile native app | Responsive web is sufficient; no app store overhead |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01–04 | Phase 1 | Complete |
| MAP-01–08 | Phase 1–2 | Complete |
| AUTH-01 | Phase 1 | Complete |
| INTL-01–03 | Phase 2 | Complete |
| ANOM-01–02 | Phase 3 | Complete |
| HIST-01–02 | Phase 3–4 | Complete |
| UI-01 | Phase 5 | Complete |
| UI-02 | Phase 5 | Complete |
| UI-03 | Phase 5 | Complete |
| UI-04 | Phase 5 | Complete |
| UI-05 | Phase 5 | Complete |
| WIRE-01 | Phase 6 | Complete |
| WIRE-02 | Phase 6 | Complete |
| WIRE-03 | Phase 6 | Complete |
| WIRE-04 | Phase 6 | Complete |
| WIRE-05 | Phase 6 | Complete |
| WIRE-06 | Phase 6 | Complete |
| DOCS-01 | Phase 7 | Complete |
| DOCS-02 | Phase 7 | Complete |
| DOCS-03 | Phase 7 | Complete |
| DOCS-04 | Phase 7 | Complete |

| ANOM-05 | Phase 8 | Complete |
| ANOM-06 | Phase 8 | Pending |
| ANLX-05 | Phase 9 | Pending |
| ANLX-06 | Phase 9 | Pending |
| CHKP-01 | Phase 10 | Pending |
| CHKP-02 | Phase 10 | Pending |

**Coverage:**
- v1.2 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-17 after v1.2 requirements defined*
