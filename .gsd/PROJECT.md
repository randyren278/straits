# Project

## What This Is

A geopolitical intelligence dashboard tracking all vessels across the Middle East in near real-time. Bloomberg-terminal aesthetic (true black + amber, JetBrains Mono, sharp corners). AIS data from AISStream.io, oil prices, sanctions from OpenSanctions, news feeds, and anomaly detection — all rendered on a Mapbox GL map with supporting panels.

## Core Value

Real-time vessel tracking with anomaly detection and sanctions intelligence on a single map view. If scope must shrink, the map with live vessel positions and anomaly color-coding must survive.

## Current State

- **AIS pipeline**: Standalone ingester service consuming AISStream.io WebSocket, writing to TimescaleDB. 6 detection algorithms running on cron (going dark, loitering, speed, deviation, STS transfer, repeat going dark). Risk scoring.
- **Map**: Mapbox GL rendering ~400 vessels with anomaly/sanction color coding, proximity clustering sidebar, track trails, chokepoint overlays.
- **Fleet**: Anomaly tables grouped by type, sanctioned vessel highlighting, vessel detail with risk factors.
- **Analytics**: Chokepoint traffic correlation charts with oil price overlay.
- **Data enrichment**: OpenSanctions (10.7k entries), oil prices (Alpha Vantage + FRED), news (NewsAPI).
- **Error boundaries**: Reusable ErrorBoundary class component with Bloomberg-styled fallback. Wired into dashboard (map + panels isolated), fleet (tables), analytics (charts). Route-level loading.tsx and error.tsx for the (protected) route group.
- **Known issues**: No responsive layout or ARIA attributes yet (M010/S04).

## Architecture / Key Patterns

- Next.js 16 (Turbopack), React 19, TypeScript 5, Tailwind CSS v4
- MapLibre GL JS / Mapbox GL for WebGL map rendering
- PostgreSQL + TimescaleDB for time-series position data
- Zustand for state, Recharts for analytics charts
- Standalone AIS ingester service (aisstream.io WebSocket) — runs as separate process
- IMO number is primary vessel identity key (not MMSI)
- Display staleness constants in `src/lib/constants/staleness.ts` — single source of truth for display query time windows
- Bloomberg aesthetic: true black + amber, JetBrains Mono, sharp corners

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [x] M001: MVP — AIS pipeline, map, intelligence layers, anomaly detection, analytics
- [x] M002: Polish — Bloomberg UI, data wiring, documentation
- [x] M003: All-Vessels — Expanded to all ship types, chokepoint live lists
- [x] M004: Evasion Intelligence — Route deviation, behavioral patterns, risk scoring, panel intelligence
- [x] M006: Fleet Overview
- [x] M007: Fleet Status Matrix & Sanctions Priority
- [x] M009: 7-Day Staleness Sync & Map Rendering Fix
- [ ] M010: Quality & Consistency — Data parity, dead code removal, error boundaries, responsive layout, accessibility
