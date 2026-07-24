# Straits — Project Context

## What This Is
A geopolitical intelligence dashboard tracking all vessels across the Middle East in near real-time. Bloomberg-terminal aesthetic. AIS data + oil prices + sanctions + news + anomaly detection.

## Stack
- Next.js 16 (Turbopack), React 19, TypeScript 5, Tailwind CSS v4
- MapLibre GL JS + CARTO dark-matter basemap for WebGL map rendering (keyless — no map token required)
- PostgreSQL + TimescaleDB for time-series position data
- Zustand for state, Recharts for analytics charts
- Standalone AIS ingester service (aisstream.io WebSocket)

## Data Sources (all keyless except the AIS feed)
- Map tiles: MapLibre GL + CARTO dark-matter (no token)
- Oil prices: FRED (primary, WTI `DCOILWTICO` / Brent `DCOILBRENTEU`; key optional), Alpha Vantage (optional fallback)
- News: keyless Google News RSS (no NewsAPI key required)
- Sanctions: OpenSanctions (CC BY-NC 4.0)
- AIS positions: AISStream.io WebSocket (the one remaining keyed feed — no free equivalent)

## Auth Posture
- The `(protected)` route group is currently an **open, unauthenticated dashboard** (the layout is a pass-through; no login gate is wired). This is intentional for the small-group demo.
- To enable the shared-password gate: add a `middleware.ts` that verifies a JWT (jose) minted from `PASSWORD_HASH` (bcrypt) — the env vars `JWT_SECRET` and `PASSWORD_HASH` already exist for this.

## Key Architecture
- AIS ingester runs as separate process (`npm run ingester`) — not inside Next.js
- IMO number is the primary vessel identity key (not MMSI)
- Anomaly detection via cron jobs in the ingester process
- Status derived from DB freshness timestamps (no API pings)
- Bloomberg aesthetic: true black + amber, JetBrains Mono, sharp corners

## Running Locally
```bash
./run.sh                      # one command: DB + schema + seed + dev server → :3000/dashboard
```
Manual equivalent:
```bash
docker compose up -d          # TimescaleDB
npm run dev                   # Next.js frontend
npm run ingester:dev          # AIS data ingestion
```

## Project Structure
```
src/
├── app/           # Next.js App Router (pages + API routes)
├── components/    # React components (map, panels, analytics)
├── lib/           # Backend logic (db, ais, enrichment, anomaly)
├── services/      # Standalone services (ais-ingester)
├── stores/        # Zustand stores
└── types/         # TypeScript type definitions
```

## Shipped Milestones
- v1.0 MVP — AIS pipeline, map, intelligence layers, anomaly detection, analytics
- v1.1 Polish — Bloomberg UI, data wiring, documentation
- v1.2 All-Vessels — Expanded to all ship types, chokepoint live lists
- v1.3 Evasion Intelligence — Route deviation, behavioral patterns, risk scoring, panel intelligence
- v1.4 Council Build — Identity-first risk (sanctioned hulls scored on sight), personal alert inbox, Gulf of Aden chokepoint, nav-status precision + GPS-spoof/teleport detection, rendezvous ledger + Known Associates, per-vessel dossier export, SPC throughput band + fleet-level alerts, composite-diversion detector, chokepoint situation brief, STS CPA nowcast (alert-gated)

## GSD Migration
- `.planning/` contains the original planning artifacts (preserved for history)
- `.gsd/` contains the migrated GSD structure
- Milestones: M001 (v1.0), M002 (v1.1), M003 (v1.2), M004 (v1.3)
