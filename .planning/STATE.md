---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: planning
stopped_at: Completed 07-03-PLAN.md
last_updated: "2026-03-13T17:58:19.315Z"
last_activity: 2026-03-13 — Phase 6 (Data Wiring) complete — 3/3 plans
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 25
  completed_plans: 25
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** Real-time visibility into Middle Eastern oil tanker movements with enough context (prices, sanctions, anomalies, news) to understand what's happening and why it matters.
**Current focus:** v1.1 Polish & Ship — Phase 7: Documentation (ready to plan)

## Current Position

Phase: Phase 7 — Documentation (ready to plan)
Plan: —
Status: Ready to plan
Last activity: 2026-03-14 - Completed quick task 7: expand AIS coverage bounding boxes to full regional routes

Progress: [████████████████████] 22/22 plans (100%)

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
| Phase 06-data-wiring P02 | 2 | 2 tasks | 4 files |
| Phase 06-data-wiring P01 | 2 | 2 tasks | 5 files |
| Phase 06-data-wiring P03 | 1 | 1 tasks | 0 files |
| Phase 07-documentation P01 | 1 | 2 tasks | 2 files |
| Phase 07-documentation P02 | 2 | 1 tasks | 1 files |
| Phase 07-documentation P03 | 1 | 2 tasks | 0 files |

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
- [Phase 06-data-wiring]: Status derived from DB freshness timestamps — no external API pings (avoids rate limit cost)
- [Phase 06-data-wiring]: classify() exported from route.ts to allow direct unit testing without HTTP overhead (06-02)
- [Phase 06-data-wiring]: StatusBar: 60s setInterval with useEffect cleanup, dot colors amber/yellow/red/gray (06-02)
- [Phase 06-01]: Eager startup fetch in startRefreshJobs() prevents cold-start empty UI panels
- [Phase 06-01]: Relative imports only in ingester (../../lib/...) — @/ alias won't resolve outside Next.js
- [Phase 06-01]: Prices cron 6h, news 30m, sanctions daily — API rate limits respected
- [Phase 06-data-wiring]: Phase 6 verification: all WIRE requirements confirmed via human checkpoint auto-approval (--auto mode)
- [Phase 07-01]: .gitignore uses *.tsbuildinfo glob to catch all TypeScript build info files
- [Phase 07-documentation]: README documents local setup in 6 steps with Docker-first order — ensures schema applied before app starts
- [Phase 07-documentation]: All 8 env vars documented in table with description, source URL, and how-to-obtain
- [Phase 07-documentation]: NEXT_PUBLIC_ prefix explained with blank-map consequence to prevent the most common misconfiguration
- [Phase 07-documentation]: Phase 7 documentation verified complete via automated checks + auto-approved human checkpoint
- [Phase 07-documentation]: All 4 DOCS requirements (DOCS-01 through DOCS-04) confirmed satisfied

### Pending Todos

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | tell me what api keys i need to set up to get this thing working | 2026-03-13 | 24d2edc | [1-tell-me-what-api-keys-i-need-to-set-up-t](./quick/1-tell-me-what-api-keys-i-need-to-set-up-t/) |
| 2 | remove auth so the page just loads no password | 2026-03-13 | 9a51013 | [2-remove-auth-so-the-page-just-loads-no-pa](./quick/2-remove-auth-so-the-page-just-loads-no-pa/) |
| 3 | fix aisstream.io api integration for correct wire format | 2026-03-14 | 7bfc70a | [3-fix-aisstream-io-api-integration-for-mar](./quick/3-fix-aisstream-io-api-integration-for-mar/) |
| 4 | persist last known oil price instead of showing nothing on API failure | 2026-03-14 | 0675c75 | [4-persist-last-known-oil-price-instead-of-](./quick/4-persist-last-known-oil-price-instead-of-/) |
| 5 | fix aisstream bounding boxes for strait coverage (Hormuz, Bab-el-Mandeb, Suez) | 2026-03-14 | 3fdbbaa | [5-fix-aisstream-bounding-boxes-for-strait-](./quick/5-fix-aisstream-bounding-boxes-for-strait-/) |
| 6 | fix vessel display: query position-first so IMO-less ships appear on map | 2026-03-14 | f3c63c6 | [6-fix-vessel-display-query-position-first-](./quick/6-fix-vessel-display-query-position-first-/) |
| 7 | expand AIS coverage bounding boxes to include full Persian Gulf, Gulf of Oman, full Red Sea, Arabian Sea transit routes, and Gulf of Aden — revert sanctions.ts 24h window | 2026-03-14 | 1896072 | [7-expand-ais-coverage-bounding-boxes-to-in](./quick/7-expand-ais-coverage-bounding-boxes-to-in/) |
| 7 | expand AIS coverage bounding boxes to full regional routes (Persian Gulf, Arabian Sea, Red Sea) | 2026-03-14 | 9b98183 | [7-expand-ais-coverage-bounding-boxes-to-in](./quick/7-expand-ais-coverage-bounding-boxes-to-in/) |
| 8 | update documentation to reflect expanded AIS coverage (6 bounding boxes) | 2026-03-14 | ee8ba4d | [8-update-documentation-to-reflect-expanded](./quick/8-update-documentation-to-reflect-expanded/) |

### Blockers/Concerns

None — Phase 6 wiring complete. Phase 7 is documentation only (no API dependencies).

## Session Continuity

Last session: 2026-03-14T05:57:00Z
Stopped at: Completed quick task 8: update documentation to reflect expanded AIS coverage
Resume file: None
