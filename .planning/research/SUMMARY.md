# Project Research Summary

**Project:** Tanker Tracker
**Domain:** Real-time maritime vessel tracking / geopolitical intelligence dashboard
**Researched:** 2026-03-11
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a specialized geopolitical intelligence dashboard, not a general ship-tracking tool. The research confirms a clear niche: no public platform combines live AIS data, OFAC/EU sanctions overlays, oil price context, and Middle East-focused geopolitical news in a single dashboard. The recommended approach is a TypeScript full-stack monolith (React + Node.js) built around a streaming AIS data source (aisstream.io WebSocket), PostgreSQL with TimescaleDB for time-series position history, and GPU-accelerated map rendering via MapLibre GL + deck.gl. This stack is well-documented, avoids per-request API billing, and supports both the live situational view and the historical analytics view without architectural gymnastics.

The most critical early commitment is the data pipeline: every meaningful feature downstream — sanctions overlays, anomaly detection, historical analytics, chokepoint monitoring — depends on AIS positions flowing into storage from day one. Vessel track history cannot be reconstructed after the fact. The second most important decision is using aisstream.io's WebSocket stream rather than REST polling; polling REST APIs for 200+ vessels creates unsustainable credit burn within days. Both of these architectural choices must be locked in before writing any feature code.

The primary risks are in data quality, not code complexity. AIS data is noisy by design: vessels teleport due to GPS jamming (documented at 1,100+ ships in the Gulf in 2025), MMSI numbers are reused and spoofed, and AIS gaps are normal in open ocean but get misread as "going dark" events. Sanctions matching that relies on vessel names instead of IMO numbers produces either zero useful results or a flood of false positives. These pitfalls are well-understood and preventable — but only if addressed in the ingestion layer from the start, not retrofitted later.

## Key Findings

### Recommended Stack

The stack is a TypeScript full-stack: React 19 + Vite 6 on the frontend, Node.js + Express on the backend, with PostgreSQL 16 + TimescaleDB for storage and Redis for the hot position cache. Map rendering uses MapLibre GL JS (open-source, zero billing risk) with deck.gl for GPU-accelerated vessel layers — the combination is mandatory at the expected vessel density of 400-800 tankers in the Middle East bounding box. AIS data comes from aisstream.io (free WebSocket stream), sanctions from OpenSanctions maritime CSV (free, daily download), oil prices from CrudePriceAPI/FRED (free tiers), and news from NewsAPI.org (free dev tier).

**Core technologies:**
- **React 19 + Vite 6**: SPA frontend — no SSR needed behind auth; concurrent rendering handles high-frequency WebSocket state updates
- **MapLibre GL JS 5.20 + react-map-gl 8.1**: WebGL basemap — zero billing risk vs. Mapbox; identical API surface
- **deck.gl 9.2**: GPU-accelerated vessel layers — ScatterplotLayer handles 500+ vessels at 60fps; Leaflet cannot
- **Node.js + Express**: Backend WebSocket server + cron scheduler — TypeScript full-stack reduces context-switching
- **PostgreSQL 16 + TimescaleDB 2.x**: Relational + time-series in one engine — supports vessel-to-sanctions JOINs AND fast range queries on position history
- **Redis**: Latest-position cache (10-min TTL per vessel) — hot path for SSE fan-out without full DB scans
- **aisstream.io**: Free WebSocket AIS stream filtered by bounding box — eliminates per-request credit costs entirely
- **OpenSanctions maritime CSV**: Free, daily download with IMO numbers — covers OFAC + EU + UN in one file
- **TanStack Query v5 + Zustand 4**: Server state vs. UI state separation — React Query for REST polling, Zustand for viewport/filter/selected-vessel state

### Expected Features

**Must have (v1 launch):**
- Auth / password protection — required before sharing; server-side enforcement on all API routes
- AIS data ingestion + storage for Middle East + major route bounding boxes — everything downstream depends on this; must start from day one
- Interactive map with live tanker positions — the core visual
- Vessel identity panel on click (name, flag, speed, destination, IMO) — table stakes for any tracking tool
- Vessel track history (last 24-48 hrs from local DB) — "where did it come from?" context
- Sanctions flag overlay (OFAC + EU via OpenSanctions IMO match) — primary intelligence differentiator
- Oil price panel (WTI/Brent current + 30-day chart) — supply disruption context
- Geopolitical news feed (Middle East + oil keyword filtered) — "why is this happening?"
- Chokepoint monitoring widgets (Hormuz, Bab el-Mandeb, Suez vessel counts) — quick situational awareness

**Should have (v1.x after validation):**
- AIS gap / going-dark detection — requires calibrated coverage-zone filtering to avoid false positives
- Route anomaly / loitering detection — requires stored position history; build after ingestor is stable
- Historical analytics view (charts, trend lines, price correlation) — requires data accumulation time
- Custom vessel watchlist + alerts — user-driven feature based on active use

**Defer (v2+):**
- Ship-to-ship transfer detection — requires dense spatial history and tuned proximity thresholds
- Beneficial ownership graph — requires paid ownership data source (Equasis)
- Satellite imagery integration — enterprise cost; out of scope for personal project

### Architecture Approach

The architecture is a backend-ingestion-first design: a long-running Node.js worker holds the aisstream.io WebSocket connection, normalizes incoming position messages, writes to TimescaleDB (historical record) and Redis (hot cache), and the browser receives updates via Server-Sent Events from an SSE endpoint that polls Redis. The browser never touches aisstream.io directly — the API key stays server-side. Three independent enrichment workers (prices, sanctions, news) run on separate cron schedules and write to their own tables. The SSE fan-out pattern means the browser only needs one persistent connection; the rest of the data fetches are standard REST via TanStack Query with stale-while-revalidate.

**Major components:**
1. **AIS Ingestor (worker process)** — persistent WebSocket to aisstream.io; normalizes and validates positions; writes to Redis + TimescaleDB
2. **SSE Endpoint** — reads latest positions from Redis; pushes JSON array to all connected browsers every 5 seconds
3. **Enrichment Workers** — independent cron jobs for oil prices (5 min), sanctions list (daily), news headlines (15 min)
4. **Anomaly Checker** — post-ingest rule engine; detects time gaps and loitering in coverage zones only; writes to anomaly_events table
5. **Map View (React + MapLibre + deck.gl)** — GPU-rendered vessel positions; Zustand for viewport/filter state; SSE for live updates
6. **Analytics View (React + Recharts)** — TanStack Query fetches from TimescaleDB time_bucket aggregation; price correlation charts
7. **PostgreSQL + TimescaleDB** — vessel_positions hypertable (partitioned by time); sanctions_matches; anomaly_events; price_snapshots

**Build order dictated by dependencies:** DB schema → AIS ingestor → Redis cache → SSE + basic map → Auth → Enrichment jobs → Anomaly detector → Detail panel → Analytics view.

### Critical Pitfalls

1. **Treating all AIS gaps as "going dark"** — Flag only gaps in known terrestrial-coverage zones (Hormuz, Red Sea); open ocean gaps are normal satellite AIS behavior. Use confidence scoring ("suspected"), not binary alerts.

2. **Polling REST APIs for vessel positions** — API credit exhaustion within days at 200+ vessels with 5-min polling. Use aisstream.io WebSocket stream for positions; reserve REST calls for one-time metadata lookups only.

3. **MMSI as the primary vessel identity key** — MMSI numbers are reused, spoofed, and cloned. Use IMO number as the primary key; validate positions by checking implied speed-over-ground (>30 knots for a laden tanker = GPS jamming artifact; discard the point).

4. **Leaflet for live vessel rendering** — Leaflet's canvas renderer freezes at 200+ markers with live updates. deck.gl WebGL layers handle 500+ vessels at 60fps in a single GPU draw call.

5. **Sanctions matching on vessel name strings** — Name variations and abbreviations produce zero matches or flood of false positives. Primary match on IMO number (stable, unique); treat fuzzy name matches as low-confidence discovery candidates only.

## Implications for Roadmap

Based on combined research, the dependency graph and pitfall prevention requirements suggest a 5-phase structure:

### Phase 1: Foundation — Data Pipeline + Auth

**Rationale:** Every downstream feature depends on AIS positions flowing into storage. Track history is irrecoverable if storage starts late. Auth must exist before anything is shareable. These two concerns are tightly coupled at launch.

**Delivers:** Positions accumulating in TimescaleDB; basic map showing vessel dots; password-protected access.

**Addresses:** AIS data ingestion + storage, auth/password protection, vessel track history (starts accumulating), interactive map with live positions.

**Avoids:** API credit burn (use aisstream.io WebSocket from the start); MMSI identity confusion (normalize and validate on ingest); missing position history (start storage on day one); exposed API keys (server-side only from day one).

**Research flag:** Standard patterns — aisstream.io WebSocket integration is well-documented; skip phase research.

### Phase 2: Intelligence Layers — Sanctions + Enrichment

**Rationale:** With positions flowing, sanctions overlay is the highest-value differentiator and relatively self-contained. Oil prices and news feeds are simple REST integrations that complete the "situational awareness" picture. All three are independent of each other and don't require historical data accumulation.

**Delivers:** Sanctions flags on the map (IMO-matched against OpenSanctions CSV); oil price panel (WTI/Brent); news feed (Middle East + oil keywords); chokepoint vessel counts (Hormuz, Bab el-Mandeb, Suez geofences).

**Addresses:** Sanctions flag overlay, oil price panel, news feed, chokepoint monitoring widgets, vessel identity panel on click.

**Avoids:** Sanctions false positives (IMO-primary matching, confidence tiers); stale OFAC list (daily scheduled refresh job); news API rate limits (cache with stale-while-revalidate).

**Research flag:** Standard patterns — skip phase research.

### Phase 3: Anomaly Detection + Alert System

**Rationale:** Anomaly detection requires sufficient position history (at least a few weeks of data) to distinguish normal patterns from suspicious gaps. This phase can only be built meaningfully after the ingestor has been running for a while. Rule-based heuristics are the right starting point — ML is overkill for v1.

**Delivers:** Going-dark detection (calibrated to coverage zones only); loitering/route anomaly flags; anomaly panel in the UI; custom vessel watchlist with alerts.

**Addresses:** AIS gap detection, route anomaly detection, custom watchlist + alerts.

**Avoids:** False positive flood from open-ocean gap alerts (restrict to terrestrial coverage zones); GPS jamming artifacts surfaced as anomalies (speed-over-ground sanity check in ingestion layer must already exist).

**Research flag:** Needs research during planning — coverage zone definitions for the Middle East, threshold calibration for gap detection, and geofence boundaries for chokepoint detection are domain-specific and require validation.

### Phase 4: Historical Analytics View

**Rationale:** The analytics view requires weeks or months of accumulated position data to be meaningful. It cannot be built at launch. By Phase 4, the DB will have enough history to show trends. TimescaleDB continuous aggregates and time_bucket queries are the performance mechanism.

**Delivers:** Historical tanker traffic charts per route/chokepoint; oil price vs. vessel traffic correlation; trend lines over user-selectable time ranges.

**Addresses:** Historical analytics view (charts, trend lines, price correlation).

**Avoids:** Analytics queries blocking write path (use TimescaleDB continuous aggregates; pre-aggregate hourly vessel counts by route segment).

**Research flag:** Standard patterns — TimescaleDB aggregation is well-documented; skip phase research.

### Phase 5: Advanced Intelligence (v2+)

**Rationale:** Ship-to-ship transfer detection, beneficial ownership graphs, and satellite imagery are high-complexity features requiring paid data sources or significant data accumulation. Defer until the core product is validated and actively used.

**Delivers:** STS transfer detection (spatial proximity queries); ownership chain visualization (Equasis integration); potential satellite imagery layer.

**Addresses:** v2+ features deferred from MVP.

**Research flag:** Needs research during planning — Equasis API access, STS proximity threshold calibration, and satellite imagery providers all require investigation before committing.

### Phase Ordering Rationale

- **Position storage must start on day one** — track history and analytics are irrecoverable if delayed; this is the single hardest constraint from FEATURES.md dependency analysis
- **Sanctions before anomaly detection** — sanctions context improves anomaly signal quality (gap in a sanctions-sensitive zone is more significant than gap elsewhere)
- **Anomaly detection after data accumulation** — calibrating gap thresholds requires observing normal transmission patterns first; building this in Phase 1 would produce unusable false-positive rates
- **Analytics last** — requires data that only exists after the pipeline has been running; also the lowest-urgency feature for the stated "watch Iran conflict" use case

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Anomaly Detection):** Coverage zone definitions for the Middle East require validated geographic boundaries; gap detection thresholds vary by sea area and AIS source type (terrestrial vs. satellite); chokepoint geofence coordinates need precision
- **Phase 5 (Advanced Intelligence):** Equasis API access requirements, STS detection algorithm parameters, and any satellite imagery provider options all need investigation before scoping

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** aisstream.io WebSocket API is well-documented with code examples; TimescaleDB hypertable setup is standard
- **Phase 2 (Intelligence Layers):** OpenSanctions CSV format is documented; CrudePriceAPI and NewsAPI REST integrations are trivial
- **Phase 4 (Analytics):** Recharts + TimescaleDB time_bucket pattern is well-established

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies verified against official docs and npm; version compatibility matrix confirmed; MapLibre/deck.gl/react-map-gl integration pattern well-documented |
| Features | MEDIUM-HIGH | Competitive analysis against MarineTraffic/Kpler is directional; MVP feature set is clear; v1.x prioritization based on research-informed judgment |
| Architecture | HIGH | aisstream.io WebSocket patterns confirmed against official docs; SSE + Redis fan-out is an established pattern; build order follows clear dependency graph |
| Pitfalls | HIGH | AIS data quality issues (GPS jamming, MMSI reuse, gap ambiguity) are well-documented across multiple independent maritime intelligence sources; sanctions matching pitfalls confirmed against OFAC methodology |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **AIS coverage zone map for the Middle East:** The specific sea areas with reliable terrestrial AIS coverage (needed for anomaly detection calibration) are not precisely documented publicly. Plan to validate empirically after a few days of ingestor data, or consult aisstream.io support.
- **CrudePriceAPI free tier stability:** The 100 req/month free tier is functional but the terms can change. Plan a fallback to FRED (free, no auth, daily updates) if CrudePriceAPI rate limits become a problem.
- **aisstream.io uptime SLA:** No published SLA for the free tier. The ingestor must implement robust reconnect logic with exponential backoff. Design for the stream being unavailable for hours at a time.
- **OpenSanctions vessel CSV update cadence:** The maritime-specific export is documented but the exact refresh frequency is not confirmed. Build the daily download job but verify the actual update pattern during Phase 2.
- **AISHub viability:** AISHub requires sharing your own AIS feed (RTL-SDR receiver setup). If this is impractical, VesselFinder credit-based API is the paid fallback. Resolve before Phase 1 planning.

## Sources

### Primary (HIGH confidence)
- [aisstream.io WebSocket API Documentation](https://aisstream.io/documentation) — subscription format, bounding boxes, message types, API key security
- [deck.gl npm / What's New](https://deck.gl/docs/whats-new) — v9.2.11 current, MapLibre integration via @deck.gl/mapbox
- [react-map-gl npm](https://www.npmjs.com/package/react-map-gl) — v8.1.0, MapLibre endpoint at react-map-gl/maplibre
- [maplibre-gl npm](https://www.npmjs.com/package/maplibre-gl) — v5.20.0 current
- [OpenSanctions maritime export](https://www.opensanctions.org/articles/2025-05-27-maritime-download/) — vessel/IMO CSV, free non-commercial
- [TimescaleDB documentation (Supabase)](https://supabase.com/docs/guides/database/extensions/timescaledb) — hypertable setup, continuous aggregates
- [OFAC Sanctions List Service](https://ofac.treasury.gov/sanctions-list-service) — SDN XML machine-readable download
- [TanStack Query v5 docs](https://tanstack.com/query/v5/docs/react/overview) — v5 stable, WebSocket integration
- [Vite 6 announcement](https://vite.dev/blog/announcing-vite6) — Node 18/20/22 support confirmed

### Secondary (MEDIUM confidence)
- [VesselFinder API](https://www.vesselfinder.com/vessel-positions-api) — 1 credit/terrestrial position pricing
- [CrudePriceAPI](https://www.crudepriceapi.com/) — 100 req/month free, WTI + Brent
- [NewsAPI pricing](https://newsapi.org/pricing) — developer tier 100 req/day free
- [Windward: GPS Jamming 1,100+ ships](https://windward.ai/blog/gps-jamming-disrupts-1100-ships-in-the-middle-east-gulf/) — Middle East GPS spoofing scope
- [Kpler: AIS spoofing and sanctions evasion](https://www.kpler.com/blog/ais-spoofing-fast-track-to-sanctions) — shadow fleet evasion patterns
- [AIS Anomaly Detection survey — MDPI](https://www.mdpi.com/2077-1312/10/1/112) — gap detection methodology
- [Streaming ETL for AIS — Confluent](https://www.confluent.io/blog/streaming-etl-and-analytics-for-real-time-location-tracking/) — streaming vs. polling architectural patterns

### Tertiary (LOW confidence)
- [AISHub API docs](https://www.aishub.net/api) — free tier conditions not fully published; exact rate limits unconfirmed
- [FRED WTI series](https://fred.stlouisfed.org/series/DCOILWTICO/) — daily historical data, confirmed free but cadence may change
- Various WebSearch synthesis on Zustand vs. Redux, Recharts vs. Nivo, FastAPI vs. Node.js — directional only

---
*Research completed: 2026-03-11*
*Ready for roadmap: yes*
