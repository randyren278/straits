# Architecture Research

**Domain:** Real-time maritime vessel tracking geopolitical intelligence dashboard
**Researched:** 2026-03-11
**Confidence:** HIGH (architecture patterns well-established; specifics to aisstream.io verified against docs)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          BROWSER / CLIENT                            │
│                                                                      │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│  │   Map View       │  │  Analytics View    │  │  Auth Gate       │  │
│  │  MapLibre GL     │  │  Charts/Trends     │  │  (password)      │  │
│  │  + Deck.gl       │  │                    │  │                  │  │
│  └────────┬─────────┘  └─────────┬─────────┘  └────────┬─────────┘  │
│           │                      │                      │            │
│  ┌────────┴──────────────────────┴──────────────────────┴─────────┐  │
│  │              React State / Zustand / SWR / EventSource         │  │
│  └────────────────────────────────┬─────────────────────────────  ┘  │
└───────────────────────────────────┼──────────────────────────────────┘
                                    │ HTTP + SSE
┌───────────────────────────────────┼──────────────────────────────────┐
│                          NEXT.JS SERVER                              │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  API Routes      │  │  SSE Endpoint    │  │  Auth Middleware  │   │
│  │  /api/vessels    │  │  /api/stream     │  │  (simple token)  │   │
│  │  /api/prices     │  │                  │  │                  │   │
│  │  /api/sanctions  │  │                  │  │                  │   │
│  │  /api/news       │  └─────────┬────────┘  └──────────────────┘   │
│  └────────┬─────────┘            │                                   │
│           │                      │                                   │
│  ┌────────┴──────────────────────┴────────────────────────────────┐  │
│  │                    Background Workers (Node cron / BullMQ)     │  │
│  │                                                                │  │
│  │  ┌───────────────┐  ┌────────────────┐  ┌──────────────────┐  │  │
│  │  │ AIS Ingestor  │  │ Enrichment Job │  │  Anomaly Checker │  │  │
│  │  │ (WebSocket    │  │ (prices,       │  │  (gap detection, │  │  │
│  │  │  consumer)    │  │  sanctions,    │  │   loitering,     │  │  │
│  │  │               │  │  news)         │  │   dark events)   │  │  │
│  │  └──────┬────────┘  └───────┬────────┘  └────────┬─────────┘  │  │
│  └─────────┼───────────────────┼────────────────────┼────────────┘  │
└────────────┼───────────────────┼────────────────────┼───────────────┘
             │                   │                     │
┌────────────┼───────────────────┼────────────────────┼───────────────┐
│            │      DATA LAYER   │                     │               │
│  ┌─────────┴────────┐  ┌───────┴───────┐  ┌─────────┴────────────┐  │
│  │  PostgreSQL      │  │  Redis Cache  │  │  Derived State Table │  │
│  │  + TimescaleDB   │  │  (latest pos) │  │  (anomaly flags,     │  │
│  │  (position       │  │               │  │   sanctions matches) │  │
│  │   history)       │  │               │  │                      │  │
│  └──────────────────┘  └───────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
             │
┌────────────┴─────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                             │
│                                                                      │
│  aisstream.io (WebSocket)    OFAC / OpenSanctions API (REST)         │
│  WTI/Brent price feed        News RSS / GDELT / Mediastack           │
│  MapTiler / Stadia tiles     (optional) MarineTraffic REST fallback  │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Map View | Render vessel positions, route overlays, waterway callouts | React + MapLibre GL JS + Deck.gl ScatterplotLayer |
| Analytics View | Historical charts, price vs. traffic correlations, trend lines | Recharts or Nivo; queries against TimescaleDB |
| Auth Gate | Block unauthenticated access for the friend group | Next.js middleware + shared password / JWT cookie |
| SSE Endpoint | Push vessel position updates to browser in near real-time | Next.js Route Handler using ReadableStream |
| API Routes | Serve enriched vessel details, prices, sanctions, news | Next.js Route Handlers; thin wrappers over DB queries |
| AIS Ingestor | Connect to aisstream.io WebSocket, decode messages, write to DB | Long-running Node process; reconnects on failure |
| Enrichment Job | Periodically fetch oil prices, sanctions list updates, headlines | Node-cron or BullMQ scheduled jobs; 5-60 min cadence |
| Anomaly Checker | Detect AIS gaps, loitering, unusual course deviations | Runs after each ingest batch; heuristic rule engine initially |
| PostgreSQL + TimescaleDB | Persist position history with time-partitioned hypertable | Supabase-hosted Postgres with TimescaleDB extension |
| Redis Cache | Hold latest known position per vessel for O(1) map refresh | Upstash Redis (serverless-friendly) or local Redis |
| Derived State Table | Persist anomaly flags, sanctions matches, enriched metadata | Normal Postgres table; updated by background workers |

## Recommended Project Structure

```
tanker-tracker/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   └── login/page.tsx      # Password gate
│   ├── map/page.tsx            # Live situational view
│   ├── analytics/page.tsx      # Historical analytics view
│   └── api/
│       ├── stream/route.ts     # SSE endpoint — pushes vessel updates
│       ├── vessels/route.ts    # REST: vessel list + detail
│       ├── prices/route.ts     # REST: oil price snapshots
│       ├── sanctions/route.ts  # REST: sanctions match lookup
│       └── news/route.ts       # REST: latest headlines
├── workers/                    # Background processes (run outside Next.js)
│   ├── ais-ingestor.ts         # Long-running WebSocket consumer
│   ├── enrichment.ts           # Price / sanctions / news refresh
│   └── anomaly-detector.ts     # Gap + loitering detection
├── lib/
│   ├── db/
│   │   ├── client.ts           # Postgres connection pool
│   │   ├── vessels.ts          # Position read/write queries
│   │   └── schema.ts           # Table definitions / migrations
│   ├── cache/
│   │   └── redis.ts            # Latest-position cache helpers
│   ├── ais/
│   │   ├── connect.ts          # aisstream.io WebSocket logic
│   │   ├── decode.ts           # AIS message normalization
│   │   └── bounding-boxes.ts   # Middle East + route region definitions
│   ├── enrichment/
│   │   ├── prices.ts           # WTI / Brent fetch (EIA / Yahoo Finance)
│   │   ├── sanctions.ts        # OFAC / OpenSanctions lookup
│   │   └── news.ts             # RSS / GDELT ingest
│   └── anomaly/
│       └── detector.ts         # Heuristic rule engine
├── components/
│   ├── map/
│   │   ├── VesselMap.tsx       # MapLibre GL wrapper
│   │   ├── VesselLayer.tsx     # Deck.gl ScatterplotLayer for ships
│   │   ├── RouteLayer.tsx      # Trade route overlays
│   │   └── WaterwayLabels.tsx  # Hormuz, Bab el-Mandeb callouts
│   ├── panels/
│   │   ├── VesselPanel.tsx     # Selected vessel detail
│   │   ├── PricePanel.tsx      # Oil price ticker
│   │   ├── NewsPanel.tsx       # Headline feed
│   │   └── AnomalyPanel.tsx    # Active anomaly alerts
│   └── analytics/
│       ├── TrafficChart.tsx    # Vessels-through-strait over time
│       └── PriceCorrelation.tsx
├── store/
│   └── useMapStore.ts          # Zustand: selected vessel, filter state
└── scripts/
    └── seed-sanctions.ts       # One-time OFAC bulk load
```

### Structure Rationale

- **workers/:** Separated from `app/` because AIS ingestor is a long-running WebSocket process — it cannot live inside a serverless Next.js route handler. Running workers as a separate Node process (or Dockerfile sidecar) is the standard pattern (confirmed by aisstream.io docs, which explicitly recommend consuming on the backend).
- **lib/ais/:** Isolates all AIS-protocol concerns. Bounding boxes for the Middle East + route regions are defined here once and reused by the ingestor.
- **lib/enrichment/:** Each external data source is a separate module. Cadences differ (prices every 5 min, sanctions daily, news every 15 min), so they run as independent scheduled jobs.
- **store/:** Client-only state (selected vessel, UI filters). Server state (positions) flows through SSE + SWR, not a global Redux-style store.

## Architectural Patterns

### Pattern 1: Backend WebSocket → SSE Fan-Out

**What:** AIS ingestor holds the single aisstream.io WebSocket connection on the server. It writes positions to Redis. The SSE endpoint reads from Redis and streams position updates to all connected browsers. Browsers never touch aisstream.io directly.

**When to use:** Always. aisstream.io documentation explicitly requires API keys to be kept server-side. Serverless platforms (Vercel) cannot maintain a persistent WebSocket on the edge — the ingestor must run as a separate Node process.

**Trade-offs:** Adds a Redis layer, but Redis is minimal cost. Avoids exposing the API key. SSE (server-to-browser) is one-directional, which is all we need — the map is display-only, not interactive in a way that requires bidirectional comms.

**Example:**
```typescript
// workers/ais-ingestor.ts (simplified)
const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
ws.on('open', () => {
  ws.send(JSON.stringify({
    APIKey: process.env.AISSTREAM_API_KEY,
    BoundingBoxes: MIDDLE_EAST_BOXES,   // defined in lib/ais/bounding-boxes.ts
    FilterMessageTypes: ['PositionReport'],
  }));
});
ws.on('message', async (raw) => {
  const msg = decode(raw);              // normalize to internal VesselPosition type
  await redis.set(`vessel:${msg.mmsi}`, JSON.stringify(msg), { EX: 600 });
  await db.insertPosition(msg);         // write to TimescaleDB hypertable
});

// app/api/stream/route.ts (SSE endpoint)
export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const interval = setInterval(async () => {
        const positions = await redis.keys('vessel:*').then(/* fetch all */);
        controller.enqueue(`data: ${JSON.stringify(positions)}\n\n`);
      }, 5000);   // 5-second refresh is sufficient for "near real-time"
      return () => clearInterval(interval);
    }
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
```

### Pattern 2: Hypertable for Position History

**What:** PostgreSQL with the TimescaleDB extension. The `vessel_positions` table is a hypertable partitioned by timestamp. Each row is one AIS position report. The latest position is also mirrored to Redis for fast reads.

**When to use:** Whenever you need both real-time latest-position queries AND historical trend queries (the analytics view). Normal Postgres tables degrade for time-series writes; TimescaleDB adds automated chunk partitioning and compression with no application-level change.

**Trade-offs:** TimescaleDB is a Postgres extension — available in Supabase, self-hosted, or Timescale Cloud. Supabase free tier enables it. Adds complexity vs. a plain Postgres table, but worth it once history queries start (e.g., "how many tankers passed through Hormuz last week?").

**Example:**
```sql
-- schema.sql
CREATE TABLE vessel_positions (
  time        TIMESTAMPTZ NOT NULL,
  mmsi        TEXT NOT NULL,
  ship_name   TEXT,
  lat         DOUBLE PRECISION NOT NULL,
  lon         DOUBLE PRECISION NOT NULL,
  speed       REAL,
  heading     SMALLINT,
  nav_status  SMALLINT,
  flag        TEXT
);

SELECT create_hypertable('vessel_positions', 'time');
CREATE INDEX ON vessel_positions (mmsi, time DESC);
```

### Pattern 3: Rule-Based Anomaly Detection (start simple)

**What:** After each ingest batch, a lightweight rule engine checks for heuristic anomalies: AIS gap > N minutes in a known-coverage area, speed = 0 for > M minutes outside port, sudden course reversal near a dark-shipping hotspot. Flags are written to an `anomaly_events` table and surfaced on the map.

**When to use:** As the initial implementation. Academic literature uses deep learning (GRU, DBSCAN) for anomaly detection, but that is overkill for v1. Simple time-gap rules catch 80% of the "going dark" events that matter geopolitically. More sophisticated ML can be layered in later as a differentiating feature.

**Trade-offs:** Produces false positives in poor-coverage ocean regions (satellite AIS has gaps unrelated to intent). Mitigate by only flagging gaps in known terrestrial-coverage zones (Strait of Hormuz, Red Sea).

## Data Flow

### AIS Ingestion Flow

```
aisstream.io WebSocket
    ↓ (JSON position messages, ~300/sec globally; filtered to ME boxes)
AIS Ingestor (workers/ais-ingestor.ts)
    ↓ normalize + validate
    ├── Redis SET vessel:{mmsi} (latest position, 10-min TTL)
    └── TimescaleDB INSERT vessel_positions
         ↓
    Anomaly Checker (post-insert, or on schedule)
         ↓ if anomaly detected
    anomaly_events table
```

### Browser Map Refresh Flow

```
Browser EventSource connects to /api/stream
    ↓ (SSE, every 5 seconds)
SSE Route Handler
    ↓ reads all vessel:{mmsi} keys from Redis
    → pushes JSON array of positions
Browser
    ↓ Zustand store update
    → Deck.gl ScatterplotLayer re-renders vessel dots
```

### Enrichment Flow

```
Node-cron schedule (per source cadence):
  Oil prices   → every 5 min  → EIA or Yahoo Finance API → price_snapshots table
  Sanctions    → daily         → OFAC SDN XML / OpenSanctions API → sanctions_matches table
  News         → every 15 min → RSS / GDELT / Mediastack → news_items table

Browser fetches /api/prices, /api/news on initial load + SWR revalidation interval
```

### Anomaly Alert Flow

```
Anomaly Checker
    ↓ gap detection: SELECT last position time WHERE mmsi = X
    ↓ if time_since_last > threshold AND in coverage zone
    → INSERT anomaly_events (mmsi, type, detected_at, lat, lon)

SSE stream includes active anomalies → AnomalyPanel + map marker highlight
```

### Key Data Flows

1. **Position update path:** aisstream.io → ingestor → Redis + TimescaleDB → SSE → browser map. Redis is the hot path; TimescaleDB is the historical record.
2. **Vessel detail path:** User clicks a vessel dot → browser fetches /api/vessels/{mmsi} → query joins vessel_positions + anomaly_events + sanctions_matches → returns enriched detail panel.
3. **Analytics path:** User switches to analytics view → SWR fetches /api/vessels/history?range=7d → TimescaleDB time_bucket aggregation query → rendered in Recharts.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-10 concurrent users | Monolith is fine. SSE endpoint, ingestor, and Next.js on same VPS (Railway, Render, Fly.io). Single Postgres instance. |
| 10-100 concurrent users | Cache warming: pre-compute vessel snapshot in Redis. Add read replica if analytics queries slow down writes. Still single ingestor. |
| 100+ concurrent users | Not the target. If needed: separate ingestor service, Kafka between ingestor and DB, pub/sub for SSE fan-out. Out of scope for v1. |

### Scaling Priorities

1. **First bottleneck:** SSE polling Redis in a loop for every connected client. Fix: use Redis pub/sub — ingestor publishes on position update, SSE subscribers receive immediately. Avoids polling Redis on a timer.
2. **Second bottleneck:** Analytics queries on vessel_positions blocking write path. Fix: TimescaleDB continuous aggregates (materialized views refreshed incrementally). Already supported by TimescaleDB.

## Anti-Patterns

### Anti-Pattern 1: Consuming aisstream.io Directly from the Browser

**What people do:** Connect the browser's `WebSocket` to `wss://stream.aisstream.io/v0/stream` to skip the backend.

**Why it's wrong:** Exposes the API key in client-side JavaScript (trivially extracted). Also, aisstream.io explicitly documents that the key should be kept server-side. Additionally, 300 messages/sec global feed would overwhelm client-side filtering.

**Do this instead:** Consume on the backend ingestor; push filtered, normalized updates to browsers via SSE.

### Anti-Pattern 2: Storing Raw AIS NMEA Messages

**What people do:** Store the raw NMEA or binary AIS payload and decode on read.

**Why it's wrong:** Decoding on every read is expensive. Schema-less storage makes queries painful. Binary AIS has 27 message types; most are irrelevant.

**Do this instead:** Decode and normalize to a typed `VesselPosition` schema on ingestion. Only store the fields needed (mmsi, time, lat, lon, speed, heading, nav_status, ship_name, flag).

### Anti-Pattern 3: Polling the AIS API from Next.js API Routes

**What people do:** Each API request to `/api/vessels` triggers a fresh call to an external AIS REST API (MarineTraffic, etc.).

**Why it's wrong:** External REST APIs have strict rate limits and per-call costs. Response latency is high (200ms+ per call). Not cacheable for near-real-time updates.

**Do this instead:** The ingestor runs continuously; API routes serve from the local database/cache. External calls happen only at ingestion time, not at read time.

### Anti-Pattern 4: Running the AIS Ingestor as a Next.js API Route

**What people do:** Start the WebSocket connection inside a Next.js route handler (e.g., in a `GET` handler with `setInterval`).

**Why it's wrong:** Serverless and edge runtimes terminate after response. Even on long-running Node servers, a route handler is not the right lifecycle boundary for a persistent connection. Restarts during deployment kill the connection silently.

**Do this instead:** Run the ingestor as a separate process with its own restart policy (e.g., a separate Dockerfile service, or a `pm2`-managed process on a VPS). It should reconnect automatically on failure.

### Anti-Pattern 5: Sanctions Matching on Every Map Render

**What people do:** For every vessel position update, query the OFAC API to check if the vessel is sanctioned.

**Why it's wrong:** OFAC API (or scraping the SDN XML) is rate-limited and slow. Real-time sanctioning checks on every render would hammer the external API.

**Do this instead:** Run sanctions matching as a nightly batch job. Load the OFAC SDN XML (refreshed daily by OFAC) locally, match against the vessel list by MMSI/IMO, and persist results to the `sanctions_matches` table. Sanctions status is inherently slow-changing — daily refresh is sufficient.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| aisstream.io | Persistent WebSocket (server-side ingestor) | Free; no guaranteed uptime SLA; send subscription within 3 sec of connect; reconnect logic required |
| OFAC SDN List | Daily HTTP GET of XML file from ofac.treasury.gov | Free; no API key required; parse and load locally |
| OpenSanctions API | REST (optional upgrade over OFAC XML) | Free tier; better fuzzy matching; covers EU sanctions too |
| EIA API (oil prices) | REST, polling every 5 min | Free with API key; Brent + WTI spot prices |
| Mediastack / NewsAPI | REST, polling every 15 min | Free tiers available; keyword filter for "tanker", "Hormuz", "Iran" |
| MapTiler / Stadia Maps | Tile server (HTTP) | Required for MapLibre GL JS basemap; both have free tiers |
| MarineTraffic REST API | REST fallback (optional) | Paid; use only if aisstream.io coverage is insufficient for specific routes |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| AIS Ingestor → Database | Direct pg client write | High-frequency writes; use connection pool; batch inserts if needed |
| AIS Ingestor → Redis | redis SET with TTL | Hot path for latest position; TTL prevents stale ghost vessels |
| Next.js API Routes → Database | pg query via lib/db/client | Read-only from API routes perspective |
| Next.js API Routes → Redis | redis GET/SCAN | For vessel list endpoint; avoid full table scan on hot path |
| SSE Endpoint → Redis | Polling or pub/sub | Start with polling (simpler); upgrade to pub/sub when needed |
| Workers → Workers | None (independent) | Enrichment, anomaly checker, ingestor are decoupled; share DB only |

## Build Order Implications

Dependencies dictate this sequencing:

1. **Database schema + TimescaleDB hypertable** — everything else reads/writes from here. Set up first.
2. **AIS Ingestor** — populates the database; without real data, nothing else can be tested end-to-end.
3. **Redis caching layer** — needed before SSE endpoint can serve fast position snapshots.
4. **SSE endpoint + basic map view** — first visible result: vessel dots appearing on a map.
5. **Auth middleware** — gate access before sharing with friends.
6. **Enrichment jobs** (prices, sanctions, news) — each is independent; build in any order after DB is live.
7. **Anomaly detector** — requires sufficient position history to detect gaps; add after ingestor is stable.
8. **Vessel detail panel + enriched data display** — combines all enrichment layers into the UI.
9. **Analytics view** — requires historical data accumulation; build last.

## Sources

- [aisstream.io WebSocket API Documentation](https://aisstream.io/documentation) — subscription format, bounding boxes, message types, rate limits, API key security recommendation
- [Streaming ETL and Analytics with Maritime AIS Data — Confluent](https://www.confluent.io/blog/streaming-etl-and-analytics-for-real-time-location-tracking/) — streaming vs. polling patterns for AIS ingestion
- [Real-Time Vessel Tracking with Java and MQTT — Vaadin](https://vaadin.com/blog/java-web-app-vessel-tracking-ais-mqtt) — backend-consumes-WebSocket, pushes to clients pattern
- [VesselAI Architecture — Frontiers in Big Data](https://www.frontiersin.org/journals/big-data/articles/10.3389/fdata.2023.1220348/full) — ingestion, enrichment, and harmonization pipeline design
- [TimescaleDB Hypertable Documentation](https://supabase.com/docs/guides/database/extensions/timescaledb) — time-series schema patterns for position data
- [Maritime Data Processing in Relational Databases — HAL](https://hal.science/hal-03137050/document) — AIS schema design in relational stores
- [Anomaly Detection in Maritime AIS Tracks — MDPI](https://www.mdpi.com/2077-1312/10/1/112) — survey of gap detection and anomaly detection methods
- [OFAC Sanctions List Service](https://ofac.treasury.gov/sanctions-list-service) — SDN XML download, daily refresh cadence
- [OpenSanctions API](https://api.opensanctions.org/) — vessel screening with fuzzy matching
- [deck.gl with MapLibre integration](https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre) — interleaved rendering mode for vessel overlays
- [Streaming in Next.js 15: WebSockets vs SSE — HackerNoon](https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events) — SSE for server-to-browser push; Vercel serverless WebSocket limitation

---
*Architecture research for: real-time maritime vessel tracking geopolitical intelligence dashboard*
*Researched: 2026-03-11*
