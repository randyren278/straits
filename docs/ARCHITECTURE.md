# Straits Architecture

Straits is a geopolitical intelligence dashboard that tracks vessels across the
Middle East in near real-time. It pulls live AIS ship positions, enriches them
with oil prices, sanctions data, and news, runs a set of anomaly detectors that
flag evasive behavior, and presents everything through a Bloomberg-terminal
style map and analytics UI. The stack is Next.js 16 (App Router, Turbopack),
React 19, TypeScript, Tailwind v4, MapLibre GL with a keyless CARTO basemap, and
PostgreSQL (TimescaleDB locally, plain Postgres on Supabase in production).

This document describes the system as it is. For the deployment and live-data
mechanics specifically, see also `docs/HARVESTER.md`.

---

## System at a glance

The data pipeline runs left to right: AIS positions come in over a WebSocket,
land in Postgres, get scanned by detectors, and are served to the UI through API
routes.

```
                         ┌────────────────────────────────────────────┐
   AISStream.io  ──ws──▶ │  Ingest                                      │
   (PositionReport,      │  parse → filter (speed>50kt drop,            │
    ShipStaticData)      │  jamming-zone lowConfidence) → dedupe/MMSI   │
                         └───────────────┬──────────────────────────────┘
                                         │ bulk upsert (IMO-keyed)
                                         ▼
   FRED / AlphaVantage ─┐      ┌───────────────────────┐
   Google News RSS      ├─────▶│  PostgreSQL            │
   OpenSanctions CSV    ┘      │  vessels, positions,   │
   (refresh jobs)             │  sanctions, anomalies, │
                              │  prices, news, alerts, │
                              │  risk_scores, ...      │
                              └───────┬──────────┬──────┘
                                      │          │
                        detectors read│          │API routes read
                                      ▼          ▼
                        ┌───────────────────┐  ┌──────────────────────┐
                        │ Detection engine  │  │ Next.js API routes    │
                        │ going-dark, STS,  │  │ /api/vessels, /status │
                        │ loitering, ... →  │  │ /anomalies, /brief,   │
                        │ risk score →      │  │ /analytics, /export   │
                        │ alerts            │  └──────────┬───────────┘
                        └───────────────────┘             │
                                                          ▼
                                              ┌───────────────────────┐
                                              │ Frontend (MapLibre +   │
                                              │ Zustand + Recharts)    │
                                              │ map, panels, fleet,    │
                                              │ analytics, alerts inbox│
                                              └───────────────────────┘
```

### Two runtimes

The ingest side runs as a standalone Node process, never inside Next.js, because
serverless functions can't hold a persistent WebSocket open. There are two entry
points that share the same detector and refresh code:

- **`src/services/ais-ingester/index.ts`** is the always-on daemon. It keeps the
  WebSocket open, streams positions in as they arrive, and fires detectors and
  refresh jobs on cron schedules (going-dark every 15 min, the route detectors
  every 30 min). This is the right shape for a server.
- **`src/services/ais-ingester/harvest-once.ts`** is a bounded single-shot
  harvest. It connects, collects one ~90s window, dedupes to the latest position
  per vessel, bulk-upserts, runs the detectors once, refreshes enrichment behind
  freshness gates, prunes old rows, writes a `status.json`, and exits.

In production, the web app runs on **Vercel** against **Supabase** Postgres, and
live AIS is fed by the **harvester on a Mac** via a `launchd` LaunchAgent every
10 minutes. The always-on daemon is the design for a dedicated server; the
harvester is what actually feeds the deployed database, since Vercel can't run
the daemon. Local development uses Docker TimescaleDB and can run the daemon
directly. Full harvester ops are in `docs/HARVESTER.md`.

### Where to start reading

If you're new to the code, read in this order:

1. `src/types/vessel.ts` and `src/types/ais.ts` for the domain model and the AIS
   wire format.
2. `src/services/ais-ingester/harvest-once.ts` for the whole ingest-to-detect
   loop in one file.
3. `src/lib/db/index.ts` and one query module (`src/lib/db/vessels.ts`) for the
   DB access pattern.
4. `src/lib/detection/going-dark.ts` for the simplest detector, then
   `risk-score.ts` for how detections compose into a score.
5. `src/app/api/vessels/route.ts` and `src/components/map/VesselMap.tsx` for the
   read path into the UI.

---

## Data & DB layer

**Purpose.** A typed, connection-pooled Postgres access layer. Query functions
are grouped by domain (vessels, positions, sanctions, anomalies, alerts,
watchlist, prices, news, search, analytics, risk-scores). Every query uses
parameterized placeholders. IMO is the vessel identity key across the board.

**Key files.**

| Path | Role |
|---|---|
| `src/lib/db/index.ts` | `pg.Pool` singleton (max 20, 30s idle, 2s connect timeout) and a typed `query<T>()` wrapper |
| `src/lib/db/schema.sql` | TimescaleDB schema: `vessel_positions` hypertable (1-day chunks, MMSI-segmented compression) plus all other tables |
| `scripts/schema-portable.sql` | Vanilla Postgres schema for Supabase: identical except `vessel_positions` is a plain table with a `time` btree index |
| `src/lib/db/vessels.ts` | `upsertVessel` (ON CONFLICT imo), `getVessel`, `getAllVessels(tankersOnly?)` |
| `src/lib/db/positions.ts` | `insertPosition`, `getPositionHistory(mmsi, hours)`, `getLatestPositions()` (DISTINCT ON mmsi, 7-day staleness) |
| `src/lib/db/sanctions.ts` | `batchUpsertSanctions` (transactional, stale cleanup), `getVesselsWithSanctions` |
| `src/lib/db/anomalies.ts` | `upsertAnomaly`, `getActiveAnomalies`, `resolveAnomaly` |
| `src/lib/db/alerts.ts` | vessel + system alerts, `generateAlertsForNewAnomalies` |
| `src/lib/db/analytics.ts` | `getTrafficByChokepoint`, `getTrafficByRoute`, `getPriceHistoryForOverlay` (all `date_trunc` daily) |
| `src/lib/db/risk-scores.ts` | `upsertRiskScore`, `getRiskScore` (zero-default for unscored vessels) |
| `src/lib/constants/staleness.ts` | `VESSEL_STALENESS_INTERVAL` and `CHOKEPOINT_STALENESS_INTERVAL`, both `'7 days'` |

**Data flow.** The ingester writes positions and vessels. Detection jobs read
position history, detect anomalies, and upsert them. Alert generation reads new
anomalies and writes alerts for watching users. The dashboard reads through
`getVesselsWithSanctions`, which LEFT JOINs positions to vessels to sanctions to
anomalies. External loaders write prices, news, and sanctions on their own
schedules.

**Notable decisions.**

- **IMO as identity.** All vessel-keyed foreign keys use IMO, not MMSI, because
  MMSI can be spoofed or reassigned mid-voyage. Positions carry MMSI at ingest
  and resolve to IMO by joining `positions.mmsi` to `vessels.mmsi`.
- **Dual-engine portability.** `schema.sql` and `schema-portable.sql` are
  identical except for the hypertable and compression policy. Runtime queries use
  `date_trunc('day', ...)` rather than TimescaleDB's `time_bucket(...)`, so the
  same query works on both engines.
- **Active-anomaly tracking via partial unique index.** `idx_anomalies_active`
  is `UNIQUE(imo, anomaly_type) WHERE resolved_at IS NULL`. A vessel can have many
  resolved anomalies of a type but only one active, and `upsertAnomaly` uses
  `ON CONFLICT ... WHERE resolved_at IS NULL` to update the active row.
- **Bulk sanctions upsert.** `batchUpsertSanctions` runs individual INSERTs
  inside one transaction (about 16,900 entries in under 10s) rather than `unnest`,
  because node-pg can't serialize arrays-of-arrays for the `text[]` columns. After
  upserting it deletes any IMO not in the current fetch.

**How other subsystems consume it.** Every API route and both ingester entry
points import query functions from here. The pool is a shared singleton.

**Gotchas.**

- Deploy `schema-portable.sql` to Supabase, not `schema.sql`. `time_bucket` would
  fail on plain Postgres; `date_trunc` is what the queries actually use.
- The 7-day staleness filter applies to display queries only. Background
  detection jobs query all active anomalies regardless of position age.
- `getRiskScore` returns a zero score for any IMO not in `vessel_risk_scores`.
  Low-scoring vessels are typically never written, so callers can't assume a real
  `computedAt` for a zero score.
- The pool constructs at module load. If `DATABASE_URL` is unset, it errors at
  startup rather than lazily.

---

## Detection & anomaly engine

**Purpose.** Identify suspicious vessel behavior from position streams, then roll
the signals into a composite dark-fleet risk score (0 to 100) per vessel with
identity-first sanctions weighting. Detectors run as cron jobs in the ingester on
a 15 to 30 minute cadence.

**Key files.**

| Path | Role |
|---|---|
| `src/lib/detection/going-dark.ts` | AIS gap >2h (suspected) / >4h (confirmed) inside a coverage zone |
| `src/lib/detection/loitering.ts` | Staying within ~9.26km (5nm) for >6h outside a known anchorage |
| `src/lib/detection/deviation.ts` | Speed <3kt outside anchorage, or heading >45° off the bearing to declared destination for 2h+ |
| `src/lib/detection/teleport.ts` | Implied speed >50kt between consecutive reports (spoofed position) |
| `src/lib/detection/sts-transfer.ts` | Two vessels within ~0.926km (0.5nm) for ≥30 min, archived to `vessel_rendezvous` |
| `src/lib/detection/cpa-predict.ts` | Forward dead-reckoning closest-point-of-approach predictor, alert-gated OFF pending validation |
| `src/lib/detection/repeat-going-dark.ts` | ≥3 going-dark events in a 30-day window |
| `src/lib/detection/destination-flip.ts` | Destination change followed by evasion within 24h; junk-destination heuristic |
| `src/lib/detection/spc-index.ts` | Statistical process control over chokepoint throughput; z-score vs 14-day baseline |
| `src/lib/detection/coverage-zones.ts` | 5 Middle East terrestrial coverage zones where AIS gaps are suspicious |
| `src/lib/detection/risk-score.ts` | Weighted composite score from the signals above |
| `src/lib/anomaly/format-details.ts` | Renders JSONB anomaly details to short display strings |
| `src/services/ais-ingester/detection-jobs.ts` | Cron registration and the per-run detector pipeline |

**Data flow.** On each cron tick, detectors query `vessel_positions` and
`vessels`, and on a match call `upsertAnomaly` into `vessel_anomalies`. After all
detectors finish, `computeRiskScores` aggregates anomalies and sanctions into a
`RiskFactors` breakdown and upserts `vessel_risk_scores`. Then
`generateAlertsForNewAnomalies` reads the fresh anomalies and writes alerts.

**Notable decisions.**

- **Identity-first risk.** A sanctioned vessel scores 25 points on identity alone,
  before any behavior. A clean sanctioned hull is still high-risk.
- **Two-tier confidence.** Going-dark uses `MIN_GAP_MINUTES=120` for suspected and
  `CONFIRMED_GAP_MINUTES=240` for confirmed. Composite diversion upgrades to
  confirmed when a junk destination and an evasion signal co-occur.
- **Coverage-zone carve-out.** AIS gaps are normal in open ocean and suspicious in
  terrestrial-receiver zones, so going-dark only fires inside the 5 defined zones.
- **Loitering nav-status suppression.** A fresh (≤15 min) "at anchor" or "moored"
  status suppresses loitering; stale status is ignored so vessels that moved after
  declaring anchor still get caught.
- **Risk factors are capped.** Going-dark is 8 points per event capped at 40,
  flag-risk 15, sanctions 25, loitering and STS 10 each (binary), rendezvous 5.
  Caps keep any single factor from dominating the 0 to 100 range.
- **Pure kinematics, no ML.** The CPA predictor uses great-circle velocity and an
  analytic closest-approach solve. It's fast and interpretable, and its live alerts
  are gated off (`STS_PREDICTION_ALERT_ENABLED=false`) until there's enough
  rendezvous ground truth to validate precision.

**Gotchas.**

- The geocoding cache (for deviation's destination bearing) is in-memory per
  process. A restart or a second worker loses it and re-hits Nominatim. There's no
  TTL, so a corrected spelling won't be retried until restart.
- Coverage zones and chokepoints are hardcoded, not in a table. Boundary changes
  need a deploy.
- Risk scores are materialized. If detection runs but `computeRiskScores` fails,
  scores go stale with no automatic recompute.
- The junk-destination heuristic flags any destination with no lowercase letters,
  so a rare legitimate all-caps port code would be mis-flagged.

---

## External data sources & enrichment

**Purpose.** Populate the dashboard with oil prices, news, and sanctions. Refresh
jobs run inside the ingester process on cron schedules, with fallback chains and
freshness gating.

**Key files.**

| Path | Role |
|---|---|
| `src/lib/external/fred.ts` | FRED fetcher for WTI (`DCOILWTICO`) and Brent (`DCOILBRENTEU`), primary price source, runs without a key but uses `FRED_API_KEY` if set |
| `src/lib/external/alphavantage.ts` | Keyed Alpha Vantage fallback, sequential fetch to respect the free 5 req/min tier |
| `src/lib/external/rss-news.ts` | Keyless Google News RSS across two 7-day search feeds, deduped by URL, never throws |
| `src/lib/external/newsapi.ts` | Keyed NewsAPI fetcher, defined but not used by the production refresh path |
| `src/lib/external/opensanctions.ts` | Keyless OpenSanctions `maritime.csv` parser, IMO normalization, authority derivation |
| `src/lib/prices/fetcher.ts` | Price orchestration: FRED then Alpha Vantage then DB fallback |
| `src/lib/news/fetcher.ts` | Wraps the RSS fetcher, returns empty on error |
| `src/services/ais-ingester/refresh-jobs.ts` | Cron orchestration: prices every 6h, news every 30m, sanctions daily at 2 AM |

**Data flow.** On startup, `startRefreshJobs` runs eager fetches and then
registers the crons. Prices try FRED, fall back to Alpha Vantage, then fall back
to the last DB values. News pulls two Google News RSS feeds, scores each headline
by keyword relevance, dedupes by URL, and upserts. Sanctions fetch the maritime
CSV, normalize IMOs, and batch-upsert with a stale cleanup.

**Notable decisions.**

- **FRED as primary, no key required.** Fed data is authoritative and rarely
  fails, unlike commercial APIs, and works with or without an API key.
- **Google News RSS for production news.** No key, no rate limit, and it returns an
  empty array rather than throwing, so a feed failure never crashes the dashboard.
  NewsAPI stays defined but unused to avoid the key dependency.
- **maritime.csv over the generic sanctions CSV.** The maritime dataset has real
  IMO, flag, MMSI, and alias columns; the generic CSV was missing IMO.
- **Idempotent cron guard.** A `started` flag stops a WebSocket reconnect from
  registering the crons twice.

**Gotchas.**

- Alpha Vantage signals rate limits in the JSON body (a `Note` or `Information`
  field), not via HTTP status, and its key is mandatory (it throws if missing),
  unlike FRED's optional key.
- The sanctions stale cleanup deletes every IMO absent from the latest fetch, so a
  partial or corrupted fetch could delete valid rows.
- Authority derivation is precedence-ordered (OFAC first, then EU, UK, and so on),
  so a vessel sanctioned by two bodies reports only the highest-precedence one.
- Eager startup fetches are not awaited, so there's a brief window where the UI can
  see empty tables on a cold start.

---

## AIS ingester & harvester services

**Purpose.** Consume AISStream `PositionReport` and `ShipStaticData` messages and
drive detection plus enrichment. Two entry points, same shared logic, different
scope: always-on versus one-shot.

**Key files.**

| Path | Role |
|---|---|
| `src/services/ais-ingester/index.ts` | Always-on daemon: persistent WebSocket, cron detectors and refreshers, streams positions as they arrive |
| `src/services/ais-ingester/harvest-once.ts` | Bounded harvest: one ~90s window, dedupe, bulk upsert, detect once, refresh (gated), prune, write `status.json`, exit |
| `src/services/ais-ingester/detection-jobs.ts` | Cron coordinator; also imported by the harvester to run detectors once |
| `src/services/ais-ingester/refresh-jobs.ts` | Enrichment cron coordinator; harvester calls it behind freshness gates |

**Data flow.** The WebSocket (`wss://stream.aisstream.io/v0/stream`) is filtered
to bounding boxes over the Persian Gulf, Gulf of Oman, Arabian Sea, Red Sea, Gulf
of Aden, and Suez / eastern Med. The daemon handles each message as it arrives,
validates coordinates and speed, and writes asynchronously. The harvester
accumulates a window into `Map<mmsi, position>` and `Map<imo, static>` keeping the
latest of each, then bulk-upserts vessels and positions in 500-row chunks, runs
`detectGoingDark` followed by the six route detectors under `Promise.allSettled`,
computes risk scores, generates alerts, refreshes enrichment if stale, prunes
`vessel_positions` older than `RETENTION_DAYS`, and measures DB size for
`status.json`.

**Notable decisions.**

- **Shared detectors, two drivers.** Both entry points import the same detector
  functions from `src/lib/detection/*` so behavior is identical; only the
  scheduling differs (cron versus once-per-window).
- **Dedupe to latest per MMSI.** AISStream emits many reports per vessel per
  window. Keeping only the latest cuts storage and prevents position jitter from
  creating spurious anomalies.
- **Hard timeout in the harvester.** `HARD_TIMEOUT_MS` (240s default) with an
  unref'd killer means a hung socket or deadlocked query still lets the process
  exit, so `launchd` doesn't stack duplicate runs.
- **Speed hard-drop and jamming flags at ingest.** Positions over 50 knots are
  dropped as unphysical; positions inside the Persian Gulf or Red Sea jamming
  boxes are marked `lowConfidence=true` rather than dropped.

**Gotchas.**

- The harvester must call `pool.end()` in its `finally` block, or open connections
  keep the process alive and `launchd` never sees it exit.
- Daemon cron callbacks are fire-and-forget (no await). A throwing detector is
  logged but there's no back-off or circuit breaker.
- Positions enter with `imo` null from `processPositionReport`; IMO is only set on
  the `vessels` row by `processShipStaticData`. Detectors must join positions to
  vessels to get IMO.
- Alert dedup is a 1-hour window while going-dark runs every 15 min, so a
  long-lived unresolved anomaly can re-alert across windows.

---

## API routes

**Purpose.** The read and export surface. Each route is a Next.js App Router
handler that calls DB or geo functions and returns JSON, with cache headers tuned
per endpoint.

**Key files (grouped).**

| Group | Routes |
|---|---|
| Vessels | `GET /api/vessels` (30s/60s cache), `/api/vessels/search`, `/api/vessels/[imo]/history`, `/api/vessels/[imo]/risk`, `/api/vessels/[imo]/associates`, `/api/positions/[mmsi]` |
| Analytics | `GET /api/analytics/traffic` (5m/10m cache), `/api/analytics/correlation` |
| Intelligence | `GET /api/anomalies`, `/api/chokepoints`, `/api/chokepoints/[id]/vessels`, `/api/brief/[chokepoint]` |
| User | `GET /api/alerts`, `POST /api/alerts/[id]/read`, `GET|POST|DELETE /api/watchlist` (all via `X-User-Id`) |
| Feeds | `GET /api/prices`, `/api/news` |
| Export | `GET /api/export` (CSV/JSON fleet snapshot), `/api/export/vessel/[imo]` (dossier) |
| Health | `GET /api/status` |

**Notable decisions.**

- **Status from freshness, not pings.** `/api/status` classifies AIS, prices, and
  news as live / degraded / offline purely from the newest row timestamp in each
  table, so it costs no external calls. Thresholds are tuned to the ingest cadence:
  AIS 15m/60m, prices 2h/24h, news 1h/12h.
- **The brief endpoint fans out.** `/api/brief/[chokepoint]` composes a SITREP
  from several queries run in parallel (traffic, anomalies, top-risk, prices,
  GPS-jamming ratio, news, SPC band) and can render markdown or JSON.
- **Stateless per-user identity.** Watchlist and alerts key off an `X-User-Id`
  header (a localStorage UUID). There's no session or token; a missing header
  returns 400.
- **Ship-type filters use AIS code ranges.** Tanker is 80 to 89, cargo 70 to 79,
  other is everything else or null, controlled by a CASE statement rather than raw
  user input.

**Gotchas.**

- Status thresholds are hardcoded in the handler.
- The anomalies query requires a position within the staleness window (an EXISTS
  subquery), so a vessel silent for 7 days won't surface even a recent anomaly.
- Cache headers are per-endpoint; an endpoint that omits them falls back to
  browser and CDN defaults.

---

## Frontend: pages, components, state

**Purpose.** Render the dashboard across four pages (Live Map, Analytics, Fleet,
About) with a MapLibre map, terminal-style panels, anomaly tables, and
price-correlation charts. UI state lives in Zustand; data comes from the API
routes.

**Key files.**

| Path | Role |
|---|---|
| `src/app/(protected)/dashboard/page.tsx` | Live map page: map plus the panel stack |
| `src/app/(protected)/analytics/page.tsx` | Traffic charts with oil-price overlay |
| `src/app/(protected)/fleet/page.tsx` | Anomaly tables by type, sanctioned section, export buttons |
| `src/components/map/VesselMap.tsx` | MapLibre canvas, all vessels as GeoJSON circles, chokepoint boxes, flyTo |
| `src/components/panels/VesselPanel.tsx` | Vessel dossier: metadata, sanctions, risk breakdown, history, export |
| `src/components/panels/ClusterPanel.tsx` | Expansion panel for co-located vessels |
| `src/components/ui/Header.tsx` | Nav, search, freshness, filters, notification bell, status bar |
| `src/components/ui/AnomalyBadge.tsx` | Badge for each anomaly type by confidence |
| `src/stores/vessel.ts` | Map/UI state: selection, filters, watchlist, alerts, cluster |
| `src/stores/analytics.ts` | Historical-view state: time range, chokepoints, routes, price symbol |

**Data flow.** `VesselMap` fetches `/api/vessels` and renders a circle layer,
emitting a selection on click. `VesselPanel` then fetches that vessel's risk and
history. `WatchlistPanel` and `NotificationBell` poll per-user endpoints and apply
optimistic updates. The analytics page fetches traffic or correlation data; the
fleet page fetches `/api/anomalies` and groups by type client-side. Prices, news,
chokepoints, and status all poll on their own intervals.

**Notable decisions.**

- **No visual clustering on the map.** Every vessel is an individual GeoJSON
  circle at all zooms. Co-located vessels are grouped for the sidebar via
  pixel-proximity detection, which keeps density visible and avoids clustering
  overhead.
- **Keyless CARTO dark-matter basemap.** No map token, and it fits the terminal
  aesthetic.
- **Two Zustand stores.** `vessel.ts` for map and UI state, `analytics.ts` for the
  historical view, to keep concerns separate.
- **Terminal aesthetic throughout.** JetBrains Mono, black background, amber
  accents (`#f59e0b`), no rounded corners, tight spacing, uppercase labels.

**Gotchas.**

- `VesselMap` guards against duplicate source and layer adds because MapLibre can
  reload the style asynchronously and re-add defaults.
- Proximity grouping is grid-bucketed (not nearest-neighbor), so very dense
  clusters can split across buckets.
- Risk-factor names are hardcoded in `VesselPanel` to match the backend
  `RiskFactors` type; a rename on one side breaks the display on the other.
- `DataFreshness` renders nothing on non-map pages, since it reads `lastUpdate`
  from the vessel store.

---

## Geo, AIS parsing & map transforms

**Purpose.** Turn raw AIS telemetry into clean positions and map features:
parsing, GPS quality filtering, chokepoint and anchorage containment, Haversine
math, and GeoJSON output.

**Key files.**

| Path | Role |
|---|---|
| `src/lib/ais/parser.ts` | Extracts position and static fields from the nested AISStream payload, coerces MMSI to string |
| `src/lib/ais/nav-status.ts` | Decodes nav-status codes 0 to 15; `STATIONARY_NAV_STATUSES` = {1 anchored, 5 moored} |
| `src/lib/ais/filter.ts` | Drops speed >50kt, flags jamming-zone positions as low confidence |
| `src/lib/geo/haversine.ts` | `haversineDistance` (km, `EARTH_RADIUS_KM=6371`) and `calculateBearing` (0 to 360°) |
| `src/lib/geo/chokepoints-constants.ts` | `CHOKEPOINTS` bounds for hormuz, babel_mandeb, suez, gulf_of_aden |
| `src/lib/geo/chokepoints.ts` | Counts vessels in a chokepoint over the staleness window, tankers split out |
| `src/lib/geo/anchorages.ts` | 8 anchorage zones for loitering suppression |
| `src/lib/map/geojson.ts` | `vesselsToGeoJSON` builds a `FeatureCollection<Point>` in `[lon, lat]` order |
| `src/lib/map/filter.ts` | `filterTankers` narrows to ship types 80 to 89 |

**Notable decisions.**

- Chokepoint containment uses axis-aligned bounding-box checks, not polygon
  intersection, for speed. Bounds are inclusive on the edges.
- Jamming-zone positions are flagged, not discarded, so detectors can consume them
  while scoring more conservatively.
- GeoJSON `Feature.id` is `imo ?? mmsi`, so vessels without an IMO still get a
  stable click-through id.

**Gotchas.**

- AISStream nests payloads one level deeper than the type names suggest
  (`msg.Message.PositionReport`), and field names differ (`Name`, not
  `ShipName`). The parser tests pin this down.
- MMSI arrives as a number and must be coerced to string at every read site.
- Tanker codes are 80 to 89 inclusive; boundary tests confirm 79 and 90 are
  excluded.

---

## Types, cross-cutting & deployment

**Purpose.** The domain types, shared constants, client-safe hooks, and the
deployment topology where the two runtimes meet the database.

**Key files.**

| Path | Role |
|---|---|
| `src/types/vessel.ts` | `Vessel` (IMO key), `VesselPosition`, `VesselWithPosition` |
| `src/types/ais.ts` | AISStream wire types; documents the payload nesting and MMSI coercion |
| `src/types/anomaly.ts` | Anomaly types and per-type discriminated-union details |
| `src/types/analytics.ts` | `TimeRange`, `ShipTypeFilter`, traffic point types, `timeRangeToDays` |
| `src/lib/hooks/useLocalStorage.ts` | SSR-safe localStorage hook (reads in `useEffect`, not render) |
| `package.json` | Next.js 16, React 19, TypeScript 5, Tailwind v4, MapLibre, pg, Zustand, Recharts |
| `next.config.ts` | `transpilePackages: ['maplibre-gl']`, Turbopack |
| `run.sh` | Local orchestration: Docker DB, idempotent schema, seed-if-empty, dev server |

**Cross-cutting concerns.**

- **Identity model.** IMO is the single vessel key. It's immutable and registered
  to a hull for life, unlike MMSI. Positions carry MMSI and resolve to IMO by
  join.
- **Freshness and staleness.** Display queries use a 7-day staleness window from
  `staleness.ts`. Detection intervals live in the detector files and are separate.
  Analytics uses the user-selected time range. These three windows are deliberately
  decoupled.
- **No-key-required source posture.** Only the AIS feed needs a key. CARTO tiles,
  Google News RSS, and OpenSanctions are fully keyless; FRED prices run without a
  key (and use one only if set). AISStream is the exception because no free
  keyless equivalent exists. This is what makes the harvester practical to run
  from a laptop.
- **Dual-engine schema portability.** The same query layer runs on local
  TimescaleDB and on Supabase plain Postgres, because the queries avoid
  TimescaleDB-only functions.

**Gotchas.**

- `next.config.ts` needs `transpilePackages: ['maplibre-gl']`, or MapLibre bundles
  as CommonJS and bloats the build.
- `useLocalStorage` must read inside `useEffect`; reading localStorage in render
  breaks SSR.
- `run.sh` writes `DATABASE_URL` to `.env.local` only if it isn't already set, so a
  second run won't clobber an existing file.
