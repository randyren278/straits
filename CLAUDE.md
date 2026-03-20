# Tanker Tracker — Project Context

## What This Is
A geopolitical intelligence dashboard tracking all vessels across the Middle East in near real-time. Bloomberg-terminal aesthetic. AIS data + oil prices + sanctions + news + anomaly detection.

## Stack
- Next.js 16 (Turbopack), React 19, TypeScript 5, Tailwind CSS v4
- MapLibre GL JS + deck.gl for WebGL map rendering
- PostgreSQL + TimescaleDB for time-series position data
- Zustand for state, Recharts for analytics charts
- Standalone AIS ingester service (aisstream.io WebSocket)

## Key Architecture
- AIS ingester runs as separate process (`npm run ingester`) — not inside Next.js
- IMO number is the primary vessel identity key (not MMSI)
- Anomaly detection via cron jobs in the ingester process
- Status derived from DB freshness timestamps (no API pings)
- Bloomberg aesthetic: true black + amber, JetBrains Mono, sharp corners

## Running Locally
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

## GSD Migration
- `.planning/` contains the original planning artifacts (preserved for history)
- `.gsd/` contains the migrated GSD structure
- Milestones: M001 (v1.0), M002 (v1.1), M003 (v1.2), M004 (v1.3)
