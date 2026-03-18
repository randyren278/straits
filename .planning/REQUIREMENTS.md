# Requirements: Tanker Tracker

**Defined:** 2026-03-17
**Core Value:** Real-time visibility into Middle Eastern oil tanker movements with enough context (prices, sanctions, anomalies, news) to understand what's happening and why it matters.

## v1.3 Requirements

### Route Deviation

- [x] **DEVI-01**: System detects when a vessel's recent heading contradicts its declared AIS destination and flags it as a route deviation anomaly
- [x] **DEVI-02**: Route deviation anomalies flow through the existing anomaly pipeline (notification bell, map badge, vessel panel)

### Behavioral Patterns

- [x] **PATT-01**: System identifies vessels that have gone dark 3+ times in the past 30 days and marks them as repeat offenders
- [x] **PATT-02**: System detects when a vessel changes its declared AIS destination while underway and logs each change with timestamps
- [x] **PATT-03**: System detects when two vessels are within 0.5nm of each other for 30+ minutes and flags as a potential ship-to-ship transfer

### Risk Scoring

- [ ] **RISK-01**: Each vessel has a computed dark fleet risk score (0–100) factoring going-dark frequency, flag state risk, active sanctions, loitering history, and STS events
- [ ] **RISK-02**: Risk score is recomputed automatically when new anomaly events are detected for a vessel

### Panel Intelligence

- [ ] **PANL-01**: Vessel panel shows full anomaly history for the vessel (all past events with type, timestamp, and details)
- [ ] **PANL-02**: Vessel panel shows dark fleet risk score with a breakdown of contributing factors
- [ ] **PANL-03**: Vessel panel shows destination change log (previous → current with timestamp)
- [ ] **PANL-04**: STS transfer events in the notification bell show both vessel names involved

## v2 Requirements

*(None yet — deferred items will be tracked here as scope evolves)*

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full route deviation via hardcoded shipping lanes | Declared destination is sufficient signal; lane-based deviation adds complexity for marginal gain |
| Per-vessel detail page / new route | User prefers expanding existing panel over new page |
| Email / push notifications | Deferred to future milestone |
| Geopolitical events timeline | Deferred to future milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEVI-01 | Phase 11 | Complete |
| DEVI-02 | Phase 11 | Complete |
| PATT-01 | Phase 12 | Complete |
| PATT-02 | Phase 12 | Complete |
| PATT-03 | Phase 12 | Complete |
| RISK-01 | Phase 13 | Pending |
| RISK-02 | Phase 13 | Pending |
| PANL-01 | Phase 14 | Pending |
| PANL-02 | Phase 14 | Pending |
| PANL-03 | Phase 14 | Pending |
| PANL-04 | Phase 14 | Pending |

**Coverage:**
- v1.3 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after roadmap creation*
