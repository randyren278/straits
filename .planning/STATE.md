# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** Real-time visibility into Middle Eastern oil tanker movements with enough context (prices, sanctions, anomalies, news) to understand what's happening and why it matters.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 4 (Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-11 — Roadmap created; 20 v1 requirements mapped across 4 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Stack: TypeScript full-stack — React 19 + Vite 6 frontend, Node.js + Express backend, PostgreSQL + TimescaleDB, Redis
- AIS source: aisstream.io WebSocket (not REST polling — avoids credit exhaustion)
- Map rendering: MapLibre GL JS + deck.gl (not Leaflet — required for 500+ vessels at 60fps)
- Identity key: IMO number as primary vessel key (not MMSI — MMSI is reused/spoofed)
- Sanctions matching: IMO-primary matching against OpenSanctions CSV (not name strings — false positives)
- Anomaly detection: restrict going-dark flags to terrestrial coverage zones only (open ocean gaps are normal)

### Pending Todos

None yet.

### Blockers/Concerns

- AISHub viability: requires sharing own AIS feed (RTL-SDR). If impractical, VesselFinder is paid fallback. Resolve before Phase 1 planning.
- Phase 3 needs research during planning: coverage zone definitions for Middle East, gap detection thresholds, chokepoint geofence coordinates.
- CrudePriceAPI free tier (100 req/month) — plan FRED fallback if rate limits hit during Phase 2.

## Session Continuity

Last session: 2026-03-11
Stopped at: Roadmap created; ready to plan Phase 1
Resume file: None
