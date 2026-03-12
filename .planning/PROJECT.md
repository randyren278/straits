# Tanker Tracker

## What This Is

A personal geopolitical intelligence dashboard that tracks oil tankers across the Middle East and major shipping routes in near real-time. It combines live vessel positions from AIS data with oil price overlays, sanctions tracking, route anomaly detection, and news integration — displayed in a data-dense, Bloomberg-terminal-meets-command-center interface. Built for a small group of friends interested in watching how oil flows respond to geopolitical events (particularly the Iran conflict).

## Core Value

Real-time visibility into Middle Eastern oil tanker movements with enough context (prices, sanctions, anomalies, news) to understand what's happening and why it matters.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Near real-time oil tanker position tracking via AIS data
- [ ] Interactive map showing vessel positions across Middle East + major export routes
- [ ] Data-dense dashboard with multiple information panels
- [ ] Oil price overlay correlated with tanker movements
- [ ] Sanctions tracking — flag vessels linked to sanctioned entities (Iran, Russia)
- [ ] Route anomaly detection — ships going dark, unusual routes, loitering
- [ ] News integration — relevant geopolitical headlines alongside map data
- [ ] Live situational view (map + panels)
- [ ] Historical analytics view (charts, trends, correlations over time)
- [ ] Simple auth for sharing with a small group of friends

### Out of Scope

- Satellite imagery / ML ship detection — complexity too high for v1, AIS data is sufficient
- Mobile native app — web-first, responsive if needed
- Public-facing tool with scaling infrastructure — small group only
- Trading automation — this is for awareness, not algo trading
- Full global coverage — Middle East + major routes only, not every tanker worldwide

## Context

- The ongoing Iran conflict is driving interest in oil flow disruption visibility
- AIS (Automatic Identification System) is the primary data source — ships broadcast position, heading, speed, and identity. Free and paid APIs exist (MarineTraffic, AISHub, VesselFinder, etc.)
- Key waterways: Strait of Hormuz (~20% of global oil passes through), Bab el-Mandeb (Red Sea entrance), Suez Canal
- Major export routes from ME go to: East Asia (largest), Europe, India, US
- Sanctions evasion is a known phenomenon — ships disable AIS transponders ("going dark"), use ship-to-ship transfers, flag under different countries
- Oil price data is freely available (crude benchmarks: WTI, Brent)
- OFAC and EU sanctions lists are publicly accessible

## Constraints

- **Data source**: AIS APIs — need to evaluate free tier limits vs paid options
- **Budget**: Personal project — prefer free/low-cost data sources and hosting
- **Auth**: Simple password protection sufficient — no need for full user management
- **Update frequency**: Near real-time (every few minutes), not tick-by-tick

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| AIS-first, no satellite ML | Achievable now, real data, satellite adds massive complexity | — Pending |
| Web app over desktop | Easier to share with friends, no install needed | — Pending |
| Data-dense UI over minimal | User wants Bloomberg-style information density | — Pending |
| Middle East + routes, not global | Focused scope matches geopolitical interest | — Pending |

---
*Last updated: 2026-03-11 after initialization*
