# Requirements: Tanker Tracker

**Defined:** 2026-03-11
**Core Value:** Real-time visibility into Middle Eastern oil tanker movements with enough context (prices, sanctions, anomalies, news) to understand what's happening and why it matters.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Pipeline

- [ ] **DATA-01**: System ingests AIS vessel positions via WebSocket stream for Middle East + major export routes
- [x] **DATA-02**: System stores all vessel positions in TimescaleDB from first run
- [x] **DATA-03**: System uses IMO number as primary vessel identity key
- [ ] **DATA-04**: System filters GPS jamming artifacts and impossible speed jumps from position data

### Map & Visualization

- [ ] **MAP-01**: User can view interactive map showing live tanker positions with WebGL rendering
- [ ] **MAP-02**: User can click a vessel to see identity panel (name, flag, speed, heading, destination, IMO)
- [ ] **MAP-03**: User can filter vessels by type (tankers only vs all)
- [ ] **MAP-04**: User can view vessel track history as polyline on map
- [ ] **MAP-05**: User can see data freshness indicator showing last update time
- [ ] **MAP-06**: User can search vessels by name or IMO number
- [ ] **MAP-07**: User can view chokepoint monitoring widgets for Hormuz, Bab el-Mandeb, and Suez
- [ ] **MAP-08**: User can use the dashboard on mobile devices via responsive layout

### Authentication

- [ ] **AUTH-01**: User must enter password to access the dashboard

### Intelligence Layers

- [ ] **INTL-01**: User can see sanctions flags on vessels linked to OFAC or EU sanctioned entities
- [ ] **INTL-02**: User can view oil price panel showing WTI/Brent current prices and 30-day chart
- [ ] **INTL-03**: User can view geopolitical news feed filtered for Middle East and oil keywords

### Anomaly Detection

- [ ] **ANOM-01**: System detects and flags vessels that disable AIS transponders (going dark)
- [ ] **ANOM-02**: System detects route anomalies including loitering and unusual deviations

### Historical Analytics

- [ ] **HIST-01**: User can view historical analytics with charts, trends, and correlations over time
- [ ] **HIST-02**: User can create vessel watchlist and receive alerts on watched vessels

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Intelligence

- **ADV-01**: System detects ship-to-ship transfers via proximity analysis
- **ADV-02**: User can view vessel ownership graph showing beneficial ownership chains
- **ADV-03**: System identifies dark fleet vessels via flag-hopping and IMO reuse indicators

## Out of Scope

| Feature | Reason |
|---------|--------|
| Satellite imagery / ML ship detection | Enterprise cost, massive complexity — AIS is sufficient for v1 |
| Cargo volume / oil quantity estimates | AIS doesn't carry cargo data; inference requires proprietary methods |
| Predictive ETA / route forecasting | Requires route modeling and ML — significant work beyond scope |
| Global coverage (all 300K+ vessels) | Storage, API cost, and rendering collapse at global scale |
| Full user management (accounts, roles) | 3-5x auth complexity for ~5 friends; shared password is sufficient |
| Trading automation / signals | Regulatory risk; project is for awareness, not algo trading |
| Mobile native app | Responsive web is sufficient; no app store overhead |
| Bulk AIS data export | API costs scale with volume; personal project budget |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Pending |
| MAP-01 | Phase 1 | Pending |
| MAP-02 | Phase 1 | Pending |
| MAP-03 | Phase 1 | Pending |
| MAP-04 | Phase 1 | Pending |
| MAP-05 | Phase 1 | Pending |
| MAP-06 | Phase 2 | Pending |
| MAP-07 | Phase 2 | Pending |
| MAP-08 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| INTL-01 | Phase 2 | Pending |
| INTL-02 | Phase 2 | Pending |
| INTL-03 | Phase 2 | Pending |
| ANOM-01 | Phase 3 | Pending |
| ANOM-02 | Phase 3 | Pending |
| HIST-01 | Phase 4 | Pending |
| HIST-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-12 after 01-02-PLAN completion — DATA-02, DATA-03 complete*
