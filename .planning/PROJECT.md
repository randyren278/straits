# Tanker Tracker

## What This Is

A personal geopolitical intelligence dashboard that tracks oil tankers across the Middle East and major shipping routes in near real-time. It combines live vessel positions from AIS data with oil price overlays, sanctions tracking, route anomaly detection, and news integration — displayed in a data-dense, Bloomberg-terminal-meets-command-center interface. Built for a small group of friends interested in watching how oil flows respond to geopolitical events (particularly the Iran conflict).

## Core Value

Real-time visibility into Middle Eastern oil tanker movements with enough context (prices, sanctions, anomalies, news) to understand what's happening and why it matters.

## Current Milestone: v1.1 — Polish & Ship

**Goal:** Make the app actually usable — replace the placeholder UI with a real Bloomberg-terminal aesthetic, wire all data sources end to end, and document setup for sharing with friends.

**Target features:**
- Bloomberg terminal UI (true black, amber accents, monospace data, grid layout)
- Full data pipeline wiring (AIS ingester, oil prices, news, sanctions, anomaly crons)
- System status visibility (live/dead indicators per data source)
- Comprehensive README + .gitignore + production deployment guide

## Requirements

### Validated

- ✓ AIS data pipeline (ingestion, storage, GPS filtering) — v1.0 Phase 1
- ✓ Interactive WebGL map (vessel positions, click details, track history, mobile) — v1.0 Phase 1
- ✓ Intelligence layers (sanctions, oil prices, news, search, chokepoints) — v1.0 Phase 2
- ✓ Anomaly detection (going dark, loitering, watchlist, alerts) — v1.0 Phase 3
- ✓ Historical analytics (traffic charts, oil price correlation) — v1.0 Phase 4
- ✓ Dashboard uses Bloomberg terminal aesthetic (true black, amber, monospace, grid layout) — v1.1 Phase 5

### Active

- [ ] AIS ingester launchable with single command, logs connection status
- [ ] All data sources (prices, news, sanctions, anomalies) verified working end-to-end
- [ ] System status indicator shows live/dead state per data source
- [ ] Comprehensive README covering installation, env setup, running locally, production deployment
- [ ] .gitignore properly excludes secrets, build artifacts, local data

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
| AIS-first, no satellite ML | Achievable now, real data, satellite adds massive complexity | Shipped in v1.0 |
| Web app over desktop | Easier to share with friends, no install needed | Shipped in v1.0 |
| Data-dense UI over minimal | User wants Bloomberg-style information density | Shipped in v1.1 Phase 5 |
| Middle East + routes, not global | Focused scope matches geopolitical interest | Maintained throughout |
| @theme radius reset via --radius-*: initial | Zeroes all rounded-* utilities globally in one line (Tailwind v4) | Phase 5 |
| CSS Grid grid-cols-[1fr_320px] for dashboard layout | Panels beside map (not floating overlays) | Phase 5 |
| JetBrains Mono via next/font/google | --font-mono CSS variable; all data values upgrade automatically | Phase 5 |

---
*Last updated: 2026-03-13 after Phase 5 (UI Redesign)*
