# Tanker Tracker

**A real-time geopolitical intelligence dashboard for Middle East maritime oil flows.**

Tanker Tracker fuses live AIS vessel positions, oil prices, sanctions data, geopolitical news, and behavioral anomaly detection into a single Bloomberg-terminal-style command center. It was built to answer one question quickly during periods of regional tension: **what is actually happening to oil shipping through the Strait of Hormuz, Bab el-Mandeb, the Gulf of Aden, and the Suez Canal right now?**

![Tanker Tracker dashboard](docs/screenshots/dashboard.png)

---

## What it does

- **Live vessel map** — every tracked ship rendered as a color-coded dot across the Persian Gulf, Gulf of Oman, Red Sea, and approaches. Colors encode threat state: going-dark, loitering, route deviation, speed anomaly, sanctioned, shadow-fleet, tanker, or ordinary traffic. GPS-degraded (jamming-zone) contacts are drawn distinctly.
- **Vessel intelligence dossiers** — click any vessel for a full profile: identity (IMO/MMSI/flag/type), live kinematics + nav-status, a composite **dark-fleet risk score** (going-dark history, sanctions match, flag risk, loitering, STS transfers, **repeat-rendezvous partners**), 24h track replay, and a **Known Associates** list of vessels it has met at sea.
- **Identity-first risk** — a sanctioned or high-risk-flag hull is scored the instant it appears, even with zero anomalies — so a disciplined, clean-behaving sanctioned tanker still surfaces on the leaderboard.
- **Chokepoint monitoring** — live vessel/tanker counts for the Strait of Hormuz, Bab el-Mandeb, Suez Canal, and the **Gulf of Aden** (the post-2024 Houthi rerouting corridor).
- **Evasion & anomaly detection** — AIS gaps ("going dark"), loitering, route/speed deviation, ship-to-ship transfers, **GPS-spoofing "teleport" jumps**, and **composite diversions** (a declared-destination flip followed by evasion), computed by the ingester and surfaced as per-user alerts.
- **Personal alert inbox** — watchlist a vessel and the notification bell becomes a personal feed of *its* anomalies, not a fleet-wide firehose.
- **Chokepoint situation brief** — a timestamped SITREP per chokepoint: counts, anomaly breakdown, top-risk vessels present, prices, GPS-jamming ratio, and relevance-ranked news — as JSON or Markdown.
- **Market + news context** — WTI/Brent price sparklines (toggleable) and a live geopolitical news feed alongside the map.
- **Historical analytics** — traffic-vs-price correlation charts per chokepoint (or grouped by route) over 7/30/90-day windows, with a statistical-process-control throughput band that flags abnormal flow.
- **Data export** — one-click CSV / JSON export of the live fleet snapshot, plus a structured per-vessel **dossier export** (identity + sanctions + risk factors + anomaly evidence + track).

---

### Live situational dashboard
Map + oil prices + intel feed, updating in near real-time.
![Dashboard](docs/screenshots/dashboard.png)

### Vessel intelligence dossier
Click any vessel for identity, kinematics, and a composite dark-fleet risk score.
![Vessel detail](docs/screenshots/dashboard-detail.png)

### Fleet overview
Sanctioned vessels and active anomalies grouped by type — with CSV/JSON export.
![Fleet](docs/screenshots/fleet.png)

---

## Features at a glance

| Capability | Detail |
|---|---|
| Real-time AIS | Standalone ingester streams positions from AISStream.io into TimescaleDB |
| Identity model | IMO is the primary vessel key (MMSI can be reused / spoofed) |
| Anomaly engine | Going-dark, loitering, deviation, speed, STS-transfer, GPS-spoof/teleport, composite-diversion |
| Risk scoring | Composite 0–100 dark-fleet score, identity-first (sanctioned hulls scored on sight), incl. repeat-rendezvous |
| Rendezvous ledger | Sustained co-locations persisted with distance + sanctions-at-encounter → Known Associates |
| Sanctions | OpenSanctions maritime dataset, IMO-matched |
| Chokepoints | Live counts + SPC throughput band for Hormuz, Bab el-Mandeb, Suez, Gulf of Aden |
| Alerts | Per-user watchlist inbox; fleet-level (IMO-less) chokepoint-disruption alerts |
| Situation brief | `/api/brief/<chokepoint>` — timestamped SITREP (JSON or `?format=md`) |
| Export | `/api/export?format=csv\|json` (fleet) and `/api/export/vessel/<imo>` (dossier JSON) |
| Aesthetic | True-black + amber, JetBrains Mono, sharp corners, zero chrome |

---

## Stack

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript 5**, **Tailwind CSS v4**
- **MapLibre GL JS** + **CARTO dark-matter** basemap for WebGL rendering — **keyless, no map token required**
- **PostgreSQL + TimescaleDB** hypertables for time-series position data
- **Zustand** for state, **Recharts** for analytics
- **Standalone AIS ingester** (Node + `ws`) running anomaly-detection cron jobs

---

## Data sources

Everything except the AIS feed is **keyless / free** — the dashboard runs without paid API keys.

| Layer | Source | Key required? |
|---|---|---|
| Map tiles | MapLibre GL + CARTO dark-matter | None |
| Oil prices | **FRED** (WTI `DCOILWTICO`, Brent `DCOILBRENTEU`) — primary; Alpha Vantage optional fallback | Optional |
| News | **Google News RSS** (keyless) | None |
| Sanctions | **OpenSanctions** maritime dataset (CC BY-NC 4.0) | None |
| AIS positions | **AISStream.io** WebSocket | Free key |

> The map, prices, and news layers were migrated off paid/rate-limited providers to free open-source equivalents without sacrificing quality or the terminal aesthetic.

---

## Running locally

**One command:**

```bash
./run.sh
```

`run.sh` fires every part needed and blocks on the dev server: it starts (or reuses) the TimescaleDB Docker container, waits for Postgres, writes `DATABASE_URL` into `.env.local` if missing (never clobbering an existing one), applies the schema idempotently, installs deps on first run, seeds ~140 demo vessels **only if the DB is empty**, and launches the app at **http://localhost:3000/dashboard** — no map token, no login.

```bash
./run.sh --reseed      # force a fresh demo dataset (truncates + reseeds)
./run.sh --ingester    # also start the live AIS ingester (needs AISSTREAM_API_KEY)
./run.sh --help        # usage
```

<details>
<summary><b>Manual steps</b> (what <code>run.sh</code> automates) — see also <a href="scripts/README-dev.md"><code>scripts/README-dev.md</code></a></summary>

```bash
# 1. Start TimescaleDB
docker run -d --name tanker-ts -p 5432:5432 \
  -e POSTGRES_PASSWORD=password -e POSTGRES_DB=tanker_tracker \
  timescale/timescaledb:latest-pg16

# 2. Point the app at it (in .env.local)
#    DATABASE_URL=postgresql://postgres:password@localhost:5432/tanker_tracker

# 3. Apply schema
docker exec tanker-ts psql -U postgres -d tanker_tracker -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
docker exec -i tanker-ts psql -U postgres -d tanker_tracker < src/lib/db/schema.sql

# 4. Seed realistic demo data (~140 vessels, positions, sanctions, anomalies, prices, news)
npx tsx --env-file=.env.local scripts/seed-demo.ts

# 5. Run — no map token needed
npm run dev            # http://localhost:3000/dashboard
```

</details>

For **live data** instead of the seed, add `AISSTREAM_API_KEY` to `.env.local` and run the ingester (or use `./run.sh --ingester`):

```bash
npm run ingester:dev   # streams real AIS positions into the DB
```

### Auth posture

The dashboard is currently an **open, unauthenticated** app (intended for a small-group demo). The env vars `JWT_SECRET` and `PASSWORD_HASH` exist to enable a shared-password gate via a `middleware.ts` (JWT verified with `jose`) when needed — see [`CLAUDE.md`](CLAUDE.md).

---

## Architecture

```mermaid
flowchart TD
    AIS["AISStream.io"] -->|WebSocket| ING["AIS Ingester<br/>standalone process<br/>+ cron anomaly detection"]
    EXT["FRED / RSS / OpenSanctions<br/>refreshed by ingester"] --> ING
    ING -->|writes| DB[("PostgreSQL + TimescaleDB<br/>hypertable: vessel_positions")]
    DB -->|reads| APP["Next.js 16 (App Router)<br/>API routes + React 19 UI<br/>MapLibre + Recharts"]
```

- The ingester runs **outside** Next.js (`npm run ingester`) so streaming and cron detection don't block request handling.
- Vessel status is derived from **DB freshness timestamps**, not live API pings.

---

## Project structure

```mermaid
graph LR
    root["tanker-tracker/"] --> src["src/"]
    root --> scripts["scripts/<br/><i>seed data, screenshots, checkpoints</i>"]
    src --> app["app/<br/><i>App Router — pages + API routes</i>"]
    src --> components["components/<br/><i>map, panels, fleet, charts, ui</i>"]
    src --> lib["lib/<br/><i>db, ais, external APIs, detection, geo</i>"]
    src --> services["services/<br/><i>standalone AIS ingester + cron jobs</i>"]
    src --> stores["stores/<br/><i>Zustand state</i>"]
    src --> types["types/<br/><i>TypeScript definitions</i>"]
```

---

## Testing

```bash
npm test               # vitest — 433 tests
npx eslint src/        # lint (clean)
npx tsc --noEmit       # typecheck
```
