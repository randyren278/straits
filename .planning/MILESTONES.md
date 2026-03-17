# Milestones

## v1.2 All-Vessels Intelligence (Shipped: 2026-03-17)

**Phases:** 8–10 | **Plans:** 6 | **Tasks:** 11

**Delivered:** Expanded anomaly detection, historical analytics, and chokepoint widgets from tankers-only to all AIS ship types, with live vessel lists inside each chokepoint zone.

**Key accomplishments:**
- Removed `ship_type BETWEEN 80 AND 89` filter from going-dark, loitering, and speed anomaly detectors — all vessel types now flagged
- Added ALL/TANKER/CARGO/OTHER filter buttons to the NotificationBell alerts panel with 30s polling
- Extended traffic DB queries with optional `ShipTypeFilter` param; `/api/analytics/correlation?shipType=` wired end-to-end
- Added ship type filter control group to the analytics page — switching type auto-re-fetches the traffic chart
- New `GET /api/chokepoints/[id]/vessels` endpoint — returns vessels inside bounding box with name/flag/ship_type/anomaly status
- ChokepointWidget expanded with live scrollable vessel list; clicking a vessel flies the map and opens its identity panel

---

## v1.1 Polish & Ship (Shipped: 2026-03-13)

**Phases:** 5–7 | **Plans:** 9

**Delivered:** Bloomberg terminal UI, all data sources wired end-to-end, system status bar, and full README/deployment documentation.

**Key accomplishments:**
- True black + amber Bloomberg terminal aesthetic with JetBrains Mono and CSS Grid grid layout
- AIS ingester launchable with single command; all crons (prices 6h, news 30m, sanctions daily) running
- System status bar showing live/degraded/offline per data source from DB freshness timestamps
- README covers 6-step local setup, all 8 env vars documented with sources, production deployment guide
- `.gitignore` excludes all secrets, build artifacts, and TimescaleDB data volumes

---

## v1.0 MVP (Shipped: 2026-03-12)

**Phases:** 1–4 | **Plans:** 16

**Delivered:** Full working geopolitical intelligence dashboard — AIS pipeline, WebGL map, intelligence layers, anomaly detection, and historical analytics.

**Key accomplishments:**
- AIS WebSocket ingester with GPS filtering, IMO-keyed identity, TimescaleDB storage
- Interactive WebGL map (MapLibre + deck.gl) with vessel panel, track history, search, mobile layout
- Intelligence layers: OFAC/EU sanctions matching, Alpha Vantage oil prices, NewsAPI headlines, chokepoint widgets
- Anomaly detection: going-dark (suspected/confirmed), loitering, speed anomaly, vessel watchlist + alerts
- Historical analytics: traffic charts by route/chokepoint with dual Y-axis oil price overlay
