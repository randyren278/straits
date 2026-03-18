# Roadmap: Tanker Tracker

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-03-12)
- ✅ **v1.1 Polish & Ship** — Phases 5–7 (shipped 2026-03-13)
- ✅ **v1.2 All-Vessels Intelligence** — Phases 8–10 (shipped 2026-03-17)
- 🚧 **v1.3 Evasion Intelligence** — Phases 11–14 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–4) — SHIPPED 2026-03-12</summary>

- [x] **Phase 1: Foundation** — AIS data pipeline, interactive map, password-protected access (5/5 plans)
- [x] **Phase 2: Intelligence Layers** — Sanctions, oil prices, news, search, chokepoint widgets (4/4 plans)
- [x] **Phase 3: Anomaly Detection** — Going-dark, loitering, speed, watchlist, alerts (4/4 plans)
- [x] **Phase 4: Historical Analytics** — Traffic charts, oil price correlation (3/3 plans)

</details>

<details>
<summary>✅ v1.1 Polish & Ship (Phases 5–7) — SHIPPED 2026-03-13</summary>

- [x] **Phase 5: UI Redesign** — Bloomberg terminal aesthetic (3/3 plans)
- [x] **Phase 6: Data Wiring** — All data sources live end-to-end, system status bar (3/3 plans)
- [x] **Phase 7: Documentation** — README, env vars, deployment guide, .gitignore (3/3 plans)

</details>

<details>
<summary>✅ v1.2 All-Vessels Intelligence (Phases 8–10) — SHIPPED 2026-03-17</summary>

- [x] **Phase 8: All-Ships Anomalies** — Lift tanker-only filters; ship type filter in alerts panel (2/2 plans)
- [x] **Phase 9: All-Ships Analytics** — All-vessel traffic charts; ship type filter on analytics page (2/2 plans)
- [x] **Phase 10: Chokepoint Live Ships** — Live vessel list per chokepoint with map navigation (2/2 plans)

</details>

### 🚧 v1.3 Evasion Intelligence (In Progress)

**Milestone Goal:** Surface evasion behavior through route deviation detection, behavioral pattern tracking, and per-vessel risk scoring.

- [x] **Phase 11: Route Deviation Detection** — Detect when vessel heading contradicts declared AIS destination; surface through existing anomaly pipeline (completed 2026-03-18)
- [ ] **Phase 12: Behavioral Pattern Detection** — Flag repeat going-dark offenders, log destination changes, detect ship-to-ship transfers
- [ ] **Phase 13: Dark Fleet Risk Score** — Compute 0–100 composite risk score per vessel; auto-update on new anomaly events
- [ ] **Phase 14: Panel Intelligence** — Full anomaly history, risk score breakdown, destination change log, and STS vessel names in vessel panel

## Phase Details

### Phase 11: Route Deviation Detection
**Goal**: Users can see when a vessel's heading contradicts its declared destination — surfaced the same way as any other anomaly
**Depends on**: Phase 10 (existing anomaly pipeline in place)
**Requirements**: DEVI-01, DEVI-02
**Success Criteria** (what must be TRUE):
  1. When a vessel's heading diverges significantly from its declared AIS destination, a route deviation anomaly record is created
  2. Route deviation anomalies appear in the notification bell alongside other anomaly types
  3. Vessels with route deviation anomalies show a badge on the map
  4. Clicking a route deviation alert in the notification bell identifies the vessel and the conflict (heading vs. destination)
**Plans**: 1 plan
Plans:
- [ ] 11-01-PLAN.md — Implement detectDeviation() with Nominatim geocoding and register in cron

### Phase 12: Behavioral Pattern Detection
**Goal**: Users can identify vessels exhibiting repeat evasion patterns — repeat going-dark, mid-voyage destination changes, and close-proximity rendezvous
**Depends on**: Phase 11
**Requirements**: PATT-01, PATT-02, PATT-03
**Success Criteria** (what must be TRUE):
  1. Vessels that have gone dark 3 or more times in the past 30 days are marked as repeat offenders (visible in vessel panel or map badge)
  2. When a vessel changes its AIS destination while underway, the change is logged with a before/after value and timestamp
  3. When two vessels are within 0.5nm of each other for 30+ minutes, a ship-to-ship transfer alert is generated
  4. STS alerts include identifying information for both vessels involved
**Plans**: 2 plans
Plans:
- [ ] 12-01-PLAN.md — Extend anomaly types, add destination changes table, hook ingester for destination tracking
- [ ] 12-02-PLAN.md — Implement repeat going-dark and STS transfer detectors, register in cron

### Phase 13: Dark Fleet Risk Score
**Goal**: Every vessel has a computed 0–100 risk score that reflects its evasion history — and the score stays current as new events occur
**Depends on**: Phase 12
**Requirements**: RISK-01, RISK-02
**Success Criteria** (what must be TRUE):
  1. Every vessel has a risk score between 0 and 100 stored in the database with a breakdown of contributing factors (going-dark frequency, flag state, sanctions status, loitering, STS events)
  2. The risk score for a vessel updates automatically when a new anomaly event is recorded for that vessel
  3. A vessel with no anomaly history shows a low (near-zero) risk score
**Plans**: TBD

### Phase 14: Panel Intelligence
**Goal**: The vessel panel becomes a full intelligence dossier — showing complete anomaly history, risk score with factor breakdown, destination change log, and STS alert context
**Depends on**: Phase 13
**Requirements**: PANL-01, PANL-02, PANL-03, PANL-04
**Success Criteria** (what must be TRUE):
  1. Opening a vessel panel shows all past anomaly events for that vessel (type, timestamp, details) in reverse-chronological order
  2. The vessel panel displays the dark fleet risk score (0–100) with a visible breakdown of which factors contributed and by how much
  3. The vessel panel shows a log of destination changes with previous value, new value, and timestamp for each change
  4. STS transfer notifications in the notification bell name both vessels involved in the proximity event
**Plans**: TBD

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Foundation | v1.0 | 5/5 | Complete | 2026-03-12 |
| 2. Intelligence Layers | v1.0 | 4/4 | Complete | 2026-03-12 |
| 3. Anomaly Detection | v1.0 | 4/4 | Complete | 2026-03-12 |
| 4. Historical Analytics | v1.0 | 3/3 | Complete | 2026-03-12 |
| 5. UI Redesign | v1.1 | 3/3 | Complete | 2026-03-13 |
| 6. Data Wiring | v1.1 | 3/3 | Complete | 2026-03-13 |
| 7. Documentation | v1.1 | 3/3 | Complete | 2026-03-13 |
| 8. All-Ships Anomalies | v1.2 | 2/2 | Complete | 2026-03-17 |
| 9. All-Ships Analytics | v1.2 | 2/2 | Complete | 2026-03-17 |
| 10. Chokepoint Live Ships | v1.2 | 2/2 | Complete | 2026-03-17 |
| 11. Route Deviation Detection | 1/1 | Complete    | 2026-03-18 | - |
| 12. Behavioral Pattern Detection | v1.3 | 0/2 | Not started | - |
| 13. Dark Fleet Risk Score | v1.3 | 0/? | Not started | - |
| 14. Panel Intelligence | v1.3 | 0/? | Not started | - |
