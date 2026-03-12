# Stack Research

**Domain:** Real-time maritime vessel tracking / geopolitical intelligence dashboard
**Researched:** 2026-03-11
**Confidence:** MEDIUM-HIGH (core stack HIGH, data API tiers MEDIUM, news integration LOW)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.x | UI framework | SPA behind auth — no SSR needed, no SEO value. React's concurrent rendering is built for high-frequency state updates from WebSocket position streams. |
| TypeScript | 5.x | Type safety | AIS data has complex nested schemas (vessel, voyage, master datasets). TypeScript prevents silent type mismatches when enriching vessel objects with sanctions/price data. |
| Vite | 6.x | Build tool / dev server | 20-30x faster than webpack for TSX transpilation, native ESM HMR. React + TS project with `npm create vite@latest -- --template react-ts`. |
| MapLibre GL JS | 5.20 | WebGL map renderer | Open-source fork of Mapbox GL JS v1. No API key cost, no usage billing. Identical API surface to Mapbox v1 — all deck.gl documentation applies. For a personal project, Mapbox billing risk is unacceptable. |
| react-map-gl | 8.1 | React bindings for MapLibre | Official vis.gl wrapper. v8 ships a dedicated `/maplibre` endpoint (`react-map-gl/maplibre`) — clean separation from Mapbox, no mapLib prop gymnastics. |
| deck.gl | 9.2 | GPU-accelerated vessel layers | WebGL2 layer system built for large point datasets. ScatterplotLayer for position dots, IconLayer for tanker icons with heading rotation, PathLayer for route history. CollisionFilterExtension handles crowded Hormuz/Suez rendering on GPU. |
| Node.js + Express | 20 LTS / 4.x | Backend API + WebSocket server | TypeScript full-stack keeps cognitive overhead low. Express is battle-tested for WebSocket fan-out via `ws` library. Polling AIS APIs every few minutes and fanning to connected clients is trivially simple. |
| PostgreSQL | 16.x | Primary data store | Vessel metadata, sanctions matches, historical routes, oil price snapshots. Relational model fits the join pattern: vessel → sanctions → route history. |
| TimescaleDB | 2.x | Time-series extension on Postgres | Hypertables partition vessel position history by time interval — 10-100x faster range queries vs vanilla Postgres on timestamp columns. Required for historical analytics view (trends, correlations). Supabase ships this as a built-in extension. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TanStack Query (React Query) | v5 | Server state + cache | REST polling for oil prices, sanctions lookups, news. Handles stale-while-revalidate, deduplication, background refetch intervals. Pair with WebSocket for vessel positions. |
| Zustand | 4.x | Client UI state | Selected vessel, map viewport, active filters, panel layout. Lightweight (1.2kb) vs Redux boilerplate. Use for UI-only state that doesn't need server sync. |
| Recharts | 2.x | Time-series charts | Historical analytics view — oil price trend lines, vessel count by route, anomaly frequency. Simpler API than Nivo, larger community, built on D3 SVG (sufficient at this data scale). |
| `ws` | 8.x | WebSocket server (Node) | Push vessel position updates to browser every N minutes without repeated HTTP polling from client. Minimal, no abstraction overhead. |
| Prisma | 5.x | ORM / migrations | Type-safe database client generated from schema. Handles Postgres + TimescaleDB. Migration system critical for iterating on vessel/sanctions schema. |
| `node-cron` or `@nestjs/schedule` | latest | Polling scheduler | Cron job to pull AIS API every 2-5 minutes, oil prices every 5 minutes, sanctions list daily. Simple `node-cron` sufficient — no need for a full job queue at this scale. |
| Zod | 3.x | Runtime schema validation | Validate AIS API responses before storing. AIS data from third-party APIs is unreliable — malformed coordinates, null fields, unexpected vessel types. Zod catches this at the boundary. |
| `helmet` + `express-basic-auth` | latest | Auth + security headers | Password-protection for small friend group. `express-basic-auth` with a single shared password is sufficient. `helmet` sets sane HTTP headers. No user management needed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite | Dev server + build | `npm create vite@latest -- --template react-ts`. HMR is critical for iterating on map layers without losing viewport state. |
| Vitest | Unit testing | Comes with Vite ecosystem. Test Zod schemas, sanctions matching logic, anomaly detection rules. |
| ESLint + Prettier | Linting + formatting | Standard React/TypeScript config. Catches unused imports that bloat the bundle (deck.gl is large). |
| Docker Compose | Local dev environment | Run Postgres + TimescaleDB locally without polluting system. Single `docker-compose.yml` with Postgres image + timescaledb/timescaledb-ha. |

---

## Data Source APIs

### AIS Vessel Positions

| Source | Cost | Data Quality | Recommendation |
|--------|------|-------------|----------------|
| **AISHub** | Free (requires AIS receiver share) | Community terrestrial, gaps in open ocean | Start here. Requires sharing your own AIS feed — viable if you can run a cheap RTL-SDR or software receiver. Middle East coverage is dense terrestrially. |
| **VesselFinder API** | Credit-based (1 credit/terrestrial position, 10/satellite) | Good terrestrial, satellite available | Use if AISHub coverage is insufficient for Hormuz/Bab el-Mandeb. Buy a credit bundle ($20-50 bootstraps the project). |
| **MarineTraffic API** | Paid (tiered, expensive) | Best in class, 550,000+ vessels | Avoid for personal project. Pricing designed for enterprise. |
| **Datalastic** | Freemium | Solid, developer-friendly | Fallback if VesselFinder pricing is too high. |

**Decision:** Start with AISHub (free), have VesselFinder as paid fallback. Build the data ingestion layer behind an interface so the source can be swapped without touching the rest of the stack.

### Oil Prices

| Source | Cost | Update Frequency | Recommendation |
|--------|------|-----------------|----------------|
| **CrudePriceAPI** | Free (100 req/month forever) | Every 5 minutes | Use this. 100 requests/month is enough polling at 1 request/hour for 24/7 operation. WTI + Brent both available. |
| **FRED (St. Louis Fed)** | Free, no key | Daily | Use for historical price data seeding. REST API, no auth needed. |
| **OilPriceAPI** | Freemium (7-day trial) | 5-minute updates | Backup if CrudePriceAPI goes down. |

### Sanctions Data

| Source | Cost | Coverage | Recommendation |
|--------|------|---------|----------------|
| **OpenSanctions** | Free (non-commercial) | OFAC + EU + UN + 30+ jurisdictions, dedicated vessel/IMO export | Use this. Ships a maritime-specific CSV with IMO numbers of sanctioned vessels. Download daily and store locally — no per-query API cost. Covers Iran and Russia shadow fleet comprehensively. |
| **OFAC SDN list (direct)** | Free | US only | Use as secondary source. OFAC publishes XML/CSV directly at treasury.gov. Parse and merge with OpenSanctions. |

### Geopolitical News

| Source | Cost | Coverage | Recommendation |
|--------|------|---------|----------------|
| **NewsAPI.org** | Free (dev tier, 100 req/day) | 80,000+ sources, keyword filtering | Use for development. Prod tier requires paid plan but cost is low (~$449/year). Query: `"tanker OR shipping OR Strait of Hormuz OR Red Sea OR Iran oil"`. |
| **GNews** | Free (100 req/day) | 60,000+ sources | Fallback. Less coverage but free tier is more permissive. |
| **Hellenic Shipping News RSS** | Free RSS | Maritime-specific | Supplement NewsAPI with curated maritime RSS feeds. Parse server-side. No key needed. |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| MapLibre GL JS | Mapbox GL JS v3 | If you need advanced 3D terrain, atmosphere rendering, or Mapbox-exclusive features. Mapbox billing is unpredictable at even low traffic. For a personal project, MapLibre is strictly better. |
| MapLibre GL JS | Leaflet | Leaflet is fine for simple point maps but cannot handle 500+ vessel icons at 60fps. Deck.gl requires a WebGL base map context — Leaflet's canvas renderer is incompatible. |
| deck.gl | react-leaflet with markers | Only if vessel count is <50 and you never need GPU layer effects. AIS data for Middle East will routinely have 200-500 visible vessels. |
| React + Vite SPA | Next.js | Only if you need SEO, server-side rendering, or edge functions. This dashboard is always behind auth — SSR adds zero value and complicates WebSocket handling. |
| Recharts | Nivo | Nivo has better aesthetics but heavier bundle. For this project, chart customization is secondary to map performance. Recharts is simpler. |
| Recharts | Plotly.js / react-plotly.js | Plotly is excellent if you need advanced geospatial chart types (choropleth, polar). For line/bar/area in the analytics panel, it's overkill and slow to render. |
| Node.js + Express | FastAPI (Python) | If you were building ML anomaly detection or needed Python's data science ecosystem. For this project, keeping the stack in TypeScript reduces context-switching. The anomaly detection logic (AIS dark periods, loitering radius) is simple geometry, not ML. |
| PostgreSQL + TimescaleDB | InfluxDB | InfluxDB is purpose-built for time series but loses SQL compatibility for joins (vessel metadata, sanctions). TimescaleDB gives you time-series performance AND full SQL — critical when you want `SELECT vessel.name, positions.lat, positions.lon JOIN sanctions ON vessel.imo = sanctions.imo`. |
| Zustand | Redux Toolkit | Redux is appropriate for large team codebases with complex normalized server state. For a solo project with a focused domain model, Redux boilerplate doubles development time for no gain. |
| OpenSanctions | OFAC API (ofac-api.com) | If you need real-time fuzzy-match screening of counterparty names. For vessel tracking, IMO number lookups from a local copy of the OpenSanctions maritime export is faster and free. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Mapbox GL JS v2/v3** | Requires Mapbox account + API key with usage-based billing. A spike in visitors (friends sharing) could incur unexpected charges. License change in 2020 makes this a bad default for personal projects. | MapLibre GL JS 5.x — identical API, zero cost, OSS |
| **Google Maps API** | Per-map-load pricing, complex billing, not designed for dense data layers. No WebGL layer composition API. | MapLibre + deck.gl |
| **Socket.io** | Heavy abstraction over WebSockets with its own protocol. Adds 30kb+ to bundle and requires matching server library. For a simple position broadcast every few minutes, raw `ws` is 100x simpler. | `ws` npm package (bare WebSocket) |
| **Leaflet with react-leaflet** | Canvas renderer, not WebGL. Cannot render 500+ icons with smooth animation. No native layer composition for deck.gl integration. | MapLibre + react-map-gl + deck.gl |
| **MongoDB** | Document model fights the relational structure of vessel → position history → sanctions joins. Time-series queries without hypertable partitioning will be slow at scale. | PostgreSQL + TimescaleDB |
| **create-react-app** | Unmaintained since 2023. Webpack-based, 10x slower dev startup than Vite. No longer recommended by the React team. | Vite 6 |
| **MarineTraffic API (professional tiers)** | Pricing designed for enterprise fleet management ($500+/month for meaningful rate limits). Entirely out of scope for a personal project. | AISHub (free) + VesselFinder credits (cheap) |
| **Full auth system (Auth0, Clerk, NextAuth)** | Complete overkill for password-protecting a dashboard shared with 5 friends. Adds OAuth complexity, external service dependency, user management database tables. | `express-basic-auth` with a single shared password |

---

## Stack Patterns by Variant

**If AISHub free tier requires AIS sharing and you can't set up a receiver:**
- Start with VesselFinder credit-based API instead
- Budget $20-50 for initial development credits
- The data ingestion interface makes this a one-file swap

**If the historical analytics view becomes performance-critical:**
- Enable TimescaleDB continuous aggregates on the positions hypertable
- Pre-aggregate: hourly vessel counts by route segment, daily average speeds by vessel type
- This turns multi-million-row range queries into sub-second aggregation queries

**If sanctions matching needs fuzzy logic (company name matching, not just IMO):**
- Add OpenSanctions' yente API (self-hostable) for entity matching
- Keep IMO-based matching as the primary path (exact match, no fuzzy needed)
- Fuzzy name matching for vessel owner/operator chains is a Phase 2 concern

**If the dashboard goes beyond the friend group:**
- Replace `express-basic-auth` with a proper JWT auth layer
- Add Supabase Auth or similar — PostgreSQL stays, just add an auth layer
- Add rate limiting on the AIS polling endpoint (currently unneeded at <10 users)

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `react-map-gl@8.1` | `maplibre-gl>=4.x` | Import from `react-map-gl/maplibre` specifically. The base `react-map-gl` import defaults to Mapbox. |
| `deck.gl@9.2` | `react-map-gl@8.x` + `maplibre-gl@5.x` | Use `MapboxOverlay` from `@deck.gl/mapbox` with the `interleaved: true` option for drawing deck layers behind map labels. |
| `prisma@5.x` | `postgresql@14+` | TimescaleDB hypertables require raw SQL (`CREATE TABLE ... HYPERTABLE`) — use Prisma migrations for schema, then a migration file for `SELECT create_hypertable(...)`. |
| `@tanstack/react-query@5` | React 18+ / React 19 | v5 has breaking changes from v4 (no `useQuery` with 3 positional args). Use the object-form API throughout. |

---

## Installation

```bash
# Scaffold
npm create vite@latest tanker-tracker -- --template react-ts
cd tanker-tracker

# Core map + visualization
npm install maplibre-gl react-map-gl deck.gl @deck.gl/mapbox

# State + data fetching
npm install @tanstack/react-query zustand

# Charts
npm install recharts

# Zod validation
npm install zod

# Backend (in /server or a monorepo workspace)
npm install express ws node-cron zod
npm install @prisma/client

# Dev dependencies
npm install -D typescript @types/react @types/react-dom @types/express @types/ws
npm install -D prisma vitest eslint prettier
```

---

## Sources

- [deck.gl npm](https://www.npmjs.com/package/deck.gl) — v9.2.11 confirmed current (HIGH confidence)
- [deck.gl What's New](https://deck.gl/docs/whats-new) — v9.2 release October 2025, v9.1 January 2025 (HIGH confidence)
- [react-map-gl npm](https://www.npmjs.com/package/react-map-gl) — v8.1.0 confirmed, MapLibre v4+ support via `/maplibre` endpoint (HIGH confidence)
- [maplibre-gl npm](https://www.npmjs.com/package/maplibre-gl) — v5.20.0 confirmed current (HIGH confidence)
- [MapLibre org](https://maplibre.org/) — open-source fork status, license context (HIGH confidence)
- [AISHub API docs](https://www.aishub.net/api) — free tier requires AIS feed sharing (MEDIUM confidence — exact rate limits not published)
- [VesselFinder API](https://www.vesselfinder.com/vessel-positions-api) — 1 credit/terrestrial position pricing confirmed (HIGH confidence)
- [OpenSanctions maritime export](https://www.opensanctions.org/articles/2025-05-27-maritime-download/) — dedicated vessel/IMO CSV export confirmed (HIGH confidence)
- [OpenSanctions API](https://api.opensanctions.org/) — free for non-commercial use confirmed (HIGH confidence)
- [CrudePriceAPI](https://www.crudepriceapi.com/) — 100 req/month free forever, WTI + Brent, 5-min updates (MEDIUM confidence — free tier terms can change)
- [FRED WTI series](https://fred.stlouisfed.org/series/DCOILWTICO/) — free, no auth, daily historical data (HIGH confidence)
- [NewsAPI pricing](https://newsapi.org/pricing) — developer tier free, 100 req/day (HIGH confidence)
- [TanStack Query v5 docs](https://tanstack.com/query/v5/docs/react/overview) — v5 stable, WebSocket integration patterns confirmed (HIGH confidence)
- [TimescaleDB GitHub](https://github.com/timescale/timescaledb) — hypertable performance, Supabase extension support (HIGH confidence)
- [Vite 6 announcement](https://vite.dev/blog/announcing-vite6) — Vite 6 released, Node 18/20/22 support (HIGH confidence)
- Multiple WebSearch results on FastAPI vs Node.js, Zustand vs Redux, Recharts vs Nivo — synthesis used for recommendations (MEDIUM confidence)

---

*Stack research for: Real-time oil tanker tracking geopolitical intelligence dashboard*
*Researched: 2026-03-11*
