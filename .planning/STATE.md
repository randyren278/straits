---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: planning
stopped_at: Completed 05-03-PLAN.md
last_updated: "2026-03-13T06:27:20.582Z"
last_activity: 2026-03-13 — v1.1 roadmap created (phases 5–7 added)
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 19
  completed_plans: 19
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** Real-time visibility into Middle Eastern oil tanker movements with enough context (prices, sanctions, anomalies, news) to understand what's happening and why it matters.
**Current focus:** v1.1 Polish & Ship — Phase 5: UI Redesign (not yet started)

## Current Position

Phase: Phase 5 — UI Redesign (not started)
Plan: —
Status: Roadmap defined, awaiting phase planning
Last activity: 2026-03-13 — v1.1 roadmap created (phases 5–7 added)

Progress: [░░░░░░░░░░] 0% (v1.1 milestone)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 16
- Average duration: 7 min
- Total execution time: ~110 min

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 5 | 41 min | 8 min |
| 02-intelligence-layers | 4 | 21 min | 5 min |
| 03-anomaly-detection | 4 | 23 min | 6 min |
| 04-historical-analytics | 3 | ~25 min | ~8 min |

**Recent Trend:**
- Last 5 plans: 6, 4, 5, 3, 15 min
- Trend: stable

*Updated after each plan completion*
| Phase 05-ui-redesign P01 | 2 | 2 tasks | 2 files |
| Phase 05-ui-redesign P02 | 3 | 2 tasks | 5 files |
| Phase 05-ui-redesign P03 | 4 | 2 tasks | 11 files |

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
- Database: 1-day hypertable chunks, 7-day compression policy (01-02)
- CRUD: COALESCE in upsert preserves existing values when null (01-02)
- Build: Turbopack (Next.js 16 default) over webpack (01-01)
- Types: Discriminated unions for AIS messages enabling type narrowing (01-01)
- Auth: async bcrypt.compare used (not sync) to avoid blocking event loop (01-03)
- Auth: jose library for JWT (ESM-native, Edge-compatible) (01-03)
- Auth: 7-day session expiry with HTTP-only cookie (01-03)
- Auth: proxy.ts pattern for Next.js 16 route protection (01-03)
- AIS: Standalone ingester service on Railway/Render (Vercel can't maintain WebSocket) (01-04)
- AIS: 50 knot speed threshold for GPS filtering (tankers max ~20 knots) (01-04)
- AIS: Flag GPS jamming zones as low_confidence, don't discard (01-04)
- Map: Mapbox dark-v11 style for Bloomberg-terminal aesthetic (01-05)
- Map: 30-second polling interval for vessel position updates (01-05)
- Map: Zustand for global state (selectedVessel, tankersOnly, showTrack) (01-05)
- Map: Responsive bottom sheet panel on mobile (max-md breakpoint) (01-05)
- Dependencies: node-cron 4.x has built-in types, no @types package needed (02-01)
- Geo: Chokepoint bounds use inclusive checks (edge points are inside) (02-01)
- Testing: it.todo() stubs for Nyquist compliance test scaffolds (02-01)
- IMO normalization: Remove "IMO" prefix and pad to 7 digits for cross-system matching (02-02)
- Sanctions priority: Red markers for sanctioned vessels override tanker amber color (02-02)
- Oil prices: Alpha Vantage primary with FRED fallback for redundancy (02-03)
- News: Keyword-based relevance scoring for headline filtering (02-03)
- UI refresh: 60s for prices, 300s for news (02-03)
- Search: 300ms debounce for autocomplete, 2-char minimum query length (02-04)
- Chokepoints: 1-hour freshness window for vessel counting (02-04)
- Map navigation: Zustand mapCenter state for decoupled flyTo triggering (02-04)
- Session ID: uuid v4 for localStorage-based watchlist user identification (03-01)
- Anomaly storage: JSONB details column for flexible type-specific anomaly data (03-01)
- Coverage zones: Simple bounding boxes (not PostGIS) for rectangular AIS coverage regions (03-01)
- Anchorages: Generous bounds to prevent false loitering alerts at known waiting areas (03-01)
- Going-dark confidence: suspected (2-4h gap) vs confirmed (>4h gap) in coverage zones (03-02)
- Loitering radius: 5nm = 9.26km threshold using Haversine distance (03-02)
- Speed anomaly: <3 knots outside anchorage indicates drifting/disabled tanker (03-02)
- Alert deduplication: 1-hour window prevents spam for same anomaly (03-02)
- Cron schedules: 15min for going-dark, 30min for route anomalies (03-02)
- Watchlist API: X-User-Id header for session-based user identification (03-03)
- Alerts API: LEFT JOIN with vessels for API responses to include vessel names (03-03)
- Zustand store: Optimistic updates for responsive UI (03-03)
- Anomaly color priority: going_dark_confirmed > going_dark_suspected > loitering > sanctioned > tanker (03-04)
- Badge icons: Radio for going_dark, Navigation for loitering, Gauge for speed (03-04)
- Alert refresh: 30-second polling interval in NotificationBell (03-04)
- WatchlistPanel: Absolute left-4 top-20 positioning for non-interfering sidebar (03-04)
- [Phase 04]: Default chokepoints: all three (hormuz, babel_mandeb, suez) for immediate visibility
- [Phase 04]: Correlation API: date-keyed Map for O(1) traffic-price merge
- [Phase 04-01]: RouteRegion keyword matching is case-insensitive substring match (04-01)
- [Phase 04-01]: time_bucket('1 day') for consistent daily grouping across TimescaleDB (04-01)
- [Phase 04-01]: Tanker filter uses ship_type BETWEEN 80 AND 89 (04-01)
- [Phase 04-03]: TrafficChart uses ResponsiveContainer for full-width rendering (04-03)
- [Phase 04-03]: Dual Y-axis: left for vessel counts, right for oil price USD (04-03)
- [Phase 04-03]: ChokepointSelector requires at least one selection (prevents empty state) (04-03)
- [Phase 04-03]: Header hides chokepoint widgets on analytics page (04-03)
- [Phase 04-03]: Extracted chokepoints constants to separate file for client-side safety (04-03)
- [Phase 05-01]: No color token overrides in @theme — Tailwind v4 defaults for amber-500 and black are correct as-is (05-01)
- [Phase 05-01]: --radius-*: initial zeroes all rounded-* utilities globally, enforcing sharp terminal aesthetic (05-01)
- [Phase 05-02]: CSS Grid grid-cols-[1fr_320px] replaces absolute overlay pattern for panel layout
- [Phase 05-02]: Terminal panel headers use px-3 py-1.5 border-b border-amber-500/20 with amber-500 font-mono uppercase label pattern
- [Phase 05-03]: Two amber active patterns: border-amber-500/bg-amber-500/10 for nav/filter toggles; bg-amber-500/text-black for TimeRange and ChokepointSelector buttons
- [Phase 05-03]: AnomalyBadge deviation+speed variants changed from purple/blue to amber-600/amber-500 for palette consistency

### Pending Todos

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | tell me what api keys i need to set up to get this thing working | 2026-03-13 | 24d2edc | [1-tell-me-what-api-keys-i-need-to-set-up-t](./quick/1-tell-me-what-api-keys-i-need-to-set-up-t/) |
| 2 | remove auth so the page just loads no password | 2026-03-13 | 9a51013 | [2-remove-auth-so-the-page-just-loads-no-pa](./quick/2-remove-auth-so-the-page-just-loads-no-pa/) |

### Blockers/Concerns

- AISHub viability: requires sharing own AIS feed (RTL-SDR). If impractical, VesselFinder is paid fallback. Resolve before Phase 1 planning.
- Phase 3 needs research during planning: coverage zone definitions for Middle East, gap detection thresholds, chokepoint geofence coordinates.
- CrudePriceAPI free tier (100 req/month) — plan FRED fallback if rate limits hit during Phase 2.

## Session Continuity

Last session: 2026-03-13T06:27:20.579Z
Stopped at: Completed 05-03-PLAN.md
Resume file: None
