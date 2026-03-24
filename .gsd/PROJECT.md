# Tanker Tracker

## What This Is

A geopolitical intelligence dashboard tracking all vessels across the Middle East in near real-time. Bloomberg-terminal aesthetic (true black + amber, JetBrains Mono, sharp corners). AIS data + oil prices + sanctions + news + anomaly detection.

## Core Value

Real-time vessel awareness with intelligence layers — sanctions, anomaly detection, risk scoring — presented in a dense, information-rich interface.

## Current State

Shipped through M008 (Unified Vessel Staleness Policy). Working features:
- Live AIS ingestion via aisstream.io WebSocket (standalone ingester process)
- MapLibre GL + deck.gl map with vessel positions, chokepoint widgets, track history
- Fleet overview with anomaly tables, anomaly matrix, sanctioned vessels panel
- Analytics page with traffic/oil-price correlation charts, time range + ship type filters
- Anomaly detection: going dark, loitering, STS transfer, route deviation, repeat going dark
- Evasion intelligence: route deviation, behavioral patterns, risk scoring
- Sanctions enrichment from OpenSanctions
- News panel, watchlist, alert system with notification bell
- Unified vessel staleness policy: 7-day display threshold across map/fleet/anomalies, 24-hour chokepoint window

## Architecture / Key Patterns

- **Stack:** Next.js 16 (Turbopack), React 19, TypeScript 5, Tailwind CSS v4, MapLibre GL JS + deck.gl, PostgreSQL + TimescaleDB, Zustand, Recharts
- **AIS ingester** runs as a separate process (`npm run ingester`) — not inside Next.js
- **IMO number** is the primary vessel identity key (not MMSI)
- **Anomaly detection** via cron jobs in the ingester process
- **Status** derived from DB freshness timestamps (no API pings)
- Pending target pattern for cross-route vessel selection (Zustand store)
- SQL JOINs for API endpoint enrichment (not N+1 client fetches)
- Shared staleness constants module (`src/lib/constants/staleness.ts`) — single source of truth for display query time windows

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [x] M001: v1.0 MVP — AIS pipeline, map, intelligence layers, anomaly detection, analytics
- [x] M002: v1.1 Polish — Bloomberg UI, data wiring, documentation
- [x] M003: v1.2 All-Vessels — Expanded to all ship types, chokepoint live lists
- [x] M004: v1.3 Evasion Intelligence — Route deviation, behavioral patterns, risk scoring
- [x] M005: Sanctions & Risk Intelligence
- [x] M006: Fleet Overview
- [x] M007: Fleet Status Matrix & Sanctions Priority
- [x] M008: Unified Vessel Staleness Policy — Consistent 7-day staleness across all views
