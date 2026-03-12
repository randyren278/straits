# Phase 1: Foundation - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the core AIS data pipeline, interactive tanker map, and password-protected access. This phase delivers: WebSocket AIS ingestion, TimescaleDB storage, WebGL map with vessel positions, click-to-inspect vessel details, tanker filtering, track history polylines, data freshness indicator, responsive layout, and simple password auth. Users can access a live, updating tanker tracking map from first run.

</domain>

<decisions>
## Implementation Decisions

### Tech Stack
- **Frontend:** Next.js 14+ with App Router — SSR for initial load, client components for real-time updates
- **Map:** Mapbox GL JS (WebGL) — proven for maritime, handles millions of points, free tier sufficient for personal use
- **Backend:** Next.js API routes + WebSocket handler — single deployment, no separate server
- **Database:** TimescaleDB (PostgreSQL extension) — time-series optimized, hypertables for position data, automatic compression
- **Hosting:** Vercel (frontend) + Railway/Supabase (TimescaleDB) — low-cost, managed

### AIS Data Source
- **Primary:** AISStream.io WebSocket API — free tier allows 1 connection, covers Middle East
- **Fallback:** AISHub if AISStream limits hit — both use NMEA sentence format
- **Region filter:** Bounding box for Middle East + Suez + Bab el-Mandeb + major export route waypoints
- **Vessel filter:** Ship type codes 80-89 (tankers) primarily, option to show all

### Data Architecture
- **Position table:** `vessel_positions` hypertable — mmsi, imo, lat, lon, speed, heading, timestamp, raw_message
- **Vessel metadata:** `vessels` table — imo (PK), mmsi, name, flag, ship_type, destination, last_seen
- **Upsert pattern:** On position received, update vessel metadata + insert position row
- **Retention:** Keep all data (storage is cheap); compress after 7 days via TimescaleDB policies

### GPS Data Quality
- Filter positions with speed > 50 knots (impossible for tankers)
- Filter positions that would require > 100 knot travel from last known position
- Flag but don't discard positions in known GPS jamming zones (Persian Gulf, Red Sea) — mark as low_confidence

### Map Interaction
- **Default view:** Middle East centered, zoom level showing Strait of Hormuz to Suez
- **Vessel markers:** Colored by type (tanker = amber, other = gray), sized by vessel length
- **Click behavior:** Side panel slides in with vessel details, doesn't obscure map
- **Track history:** Toggle per-vessel, shows last 24h of positions as polyline with time gradient
- **Tanker filter:** Toggle in header — "Tankers only" vs "All vessels"

### UI Layout (Bloomberg-style density)
- **Dark theme:** Dark gray background (#1a1a2e), high contrast text
- **Header:** App title, data freshness indicator (green/yellow/red based on last update age), tanker filter toggle
- **Main area:** Full-bleed map with floating panels
- **Vessel panel:** Right side, 320px wide, shows selected vessel details
- **Data freshness:** "Last update: 2 min ago" with color coding — green <2min, yellow 2-5min, red >5min

### Authentication
- **Method:** Single shared password — stored as bcrypt hash in environment variable
- **Session:** HTTP-only cookie, 7-day expiry
- **UX:** Simple password field on load, no username needed — "Enter password to access"
- **Protection:** All API routes check session; WebSocket requires valid session cookie

### Mobile Responsiveness
- Map fills viewport on mobile
- Vessel panel becomes bottom sheet (slides up from bottom)
- Touch gestures for map navigation
- Header collapses to hamburger menu on small screens

### Claude's Discretion
- Exact color palette beyond dark theme base
- Loading states and skeleton screens
- Error toast styling
- Map control placement (zoom, compass)
- Exact panel animation timing

</decisions>

<specifics>
## Specific Ideas

- "Bloomberg-terminal-meets-command-center" — high information density, not minimalist
- Data freshness is critical — users need to know if data is stale
- Track history should feel like watching a ship's journey unfold
- The Strait of Hormuz is the most important area — should be prominent in default view

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project

### Established Patterns
- None — establishing patterns in this phase

### Integration Points
- This phase establishes the foundation that all subsequent phases build on
- Vessel metadata table will be extended in Phase 2 (sanctions flags)
- Position history enables Phase 3 (anomaly detection) and Phase 4 (analytics)

</code_context>

<deferred>
## Deferred Ideas

- Sanctions flags on vessels — Phase 2
- Oil price overlay — Phase 2
- News feed integration — Phase 2
- Vessel search — Phase 2
- Chokepoint monitoring widgets — Phase 2
- AIS gap detection — Phase 3
- Route anomaly detection — Phase 3
- Historical analytics charts — Phase 4

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-11*
