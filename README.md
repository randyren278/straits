# Tanker Tracker

Personal geopolitical intelligence dashboard tracking oil tankers across the Middle East and major export routes, from Persian Gulf loading terminals through the Strait of Hormuz, Arabian Sea, Red Sea, and Suez Canal. Built for real-time visibility into oil flow with sanctions flags, price correlation, anomaly detection, and route analytics.

## Features

- Live vessel positions on an interactive WebGL map (MapLibre + deck.gl)
- Sanctions flag overlay via OpenSanctions IMO matching
- WTI/Brent oil price panel with 30-day chart (Alpha Vantage + FRED)
- Geopolitical news feed filtered for Middle East and oil keywords
- Going-dark detection and route anomaly alerts
- Historical traffic analytics correlated with oil price movements
- Vessel watchlist with notifications
- Bloomberg terminal aesthetic: true black, amber accents, monospace data
- Route deviation detection via destination geocoding
- Behavioral pattern detection: repeat going-dark, destination changes, ship-to-ship transfers
- Dark fleet risk scoring (0-100 composite score per vessel)
- Vessel intelligence dossier panel with risk breakdown and anomaly history
- About page documenting all anomaly definitions and scoring methodology

## Anomaly Detection

Tanker Tracker monitors 6 types of vessel anomalies: AIS signal loss (going dark), loitering outside anchorage, speed anomalies, route deviation from declared destination, repeat going-dark patterns, and ship-to-ship transfers. Each vessel receives a composite dark fleet risk score (0-100) based on its evasion signal history. See the About tab in the dashboard for full definitions and scoring methodology.

## Prerequisites

- Node.js 18+
- Docker Desktop (for local TimescaleDB)
- Git
- Accounts needed: [aisstream.io](https://aisstream.io), [Mapbox](https://account.mapbox.com/access-tokens/), [Alpha Vantage](https://www.alphavantage.co/support/#api-key), [NewsAPI](https://newsapi.org/register)

## Local Setup

### 1. Clone and Install

```bash
git clone https://github.com/randyren278/tanker-tracker.git
cd tanker-tracker
npm install
```

### 2. Start TimescaleDB

The app requires TimescaleDB (not plain PostgreSQL — the schema uses hypertables). Start it with Docker:

```bash
docker run -d --name timescaledb -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=tanker_tracker \
  timescale/timescaledb:latest-pg16
```

This runs TimescaleDB (PostgreSQL 16 + TimescaleDB extension) on port 5432. The container name `timescaledb` is used for subsequent start/stop commands.

### 3. Apply Database Schema

No migration runner — apply the schema manually:

```bash
psql postgresql://postgres:password@localhost:5432/tanker_tracker -f src/lib/db/schema.sql
```

Or open `src/lib/db/schema.sql` in a GUI tool (TablePlus, DBeaver, pgAdmin) and run it against the database.

> **Note:** This step must run before starting the app or ingester. If the app starts without tables, the ingester will crash immediately with "relation does not exist".

### 4. Configure Environment Variables

```bash
cp .env.example .env.local
# Edit .env.local and fill in all values
```

#### Required Environment Variables

| Variable | Description | How to Get |
|----------|-------------|------------|
| `DATABASE_URL` | PostgreSQL connection string | Local: `postgresql://postgres:password@localhost:5432/tanker_tracker` |
| `AISSTREAM_API_KEY` | AISStream.io WebSocket API key | [aisstream.io](https://aisstream.io) — free tier |
| `JWT_SECRET` | 32+ character secret for session tokens | Generate with command below |
| `PASSWORD_HASH` | bcrypt hash of the shared dashboard password | Generate with command below |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox access token for map rendering | [account.mapbox.com](https://account.mapbox.com/access-tokens/) — free 50k tile loads/month |
| `ALPHA_VANTAGE_API_KEY` | Oil prices primary source (25 req/day free) | [alphavantage.co](https://www.alphavantage.co/support/#api-key) |
| `FRED_API_KEY` | Oil prices fallback — free, no rate limits | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) |
| `NEWSAPI_KEY` | Geopolitical news headlines (100 req/day free) | [newsapi.org/register](https://newsapi.org/register) |

> **Important — `NEXT_PUBLIC_` prefix:** Next.js only exposes environment variables prefixed with `NEXT_PUBLIC_` to the browser bundle. `NEXT_PUBLIC_MAPBOX_TOKEN` must be set exactly as shown — if you use `MAPBOX_TOKEN`, the map renders blank with no error message.

#### Generating Secrets

**JWT_SECRET** (random 32-byte hex string):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**PASSWORD_HASH** (replace `yourpassword` with your chosen password):
```bash
node -e "const b=require('bcrypt'); b.hash('yourpassword',10).then(h=>console.log(h))"
```

Copy the output and paste it as the `PASSWORD_HASH` value.

### 5. Start the App

```bash
npm run dev
```

App available at [http://localhost:3000](http://localhost:3000).

### 6. Start the AIS Ingester

In a separate terminal:

```bash
npm run ingester
```

The ingester connects to AISStream.io and logs:

```
============================================================
AIS Ingester Service
============================================================
Environment: development
Database URL: (configured)
AISStream API Key: (configured)
============================================================
Connected. Sending subscription...
Subscription sent. Waiting for messages...
```

#### Coverage Areas

The ingester subscribes to 6 regional bounding boxes via AISStream.io:

| Region | Lat | Lon | Purpose |
|--------|-----|-----|---------|
| Full Persian Gulf | 23–30°N | 47–57.5°E | Loading terminals: Ras Tanura, Kharg Island, Kuwait, UAE |
| Gulf of Oman + Arabian Sea (west) | 22–26°N | 55–66°E | Tankers exiting Strait of Hormuz |
| Arabian Sea (transit) | 8–25°N | 60–78°E | East-bound routes to India and Asia |
| Full Red Sea | 12–30°N | 32–45°E | Entire Red Sea corridor |
| Gulf of Aden | 11–14°N | 42–52°E | Exits from Bab-el-Mandeb strait |
| Suez + Eastern Mediterranean | 29.5–37°N | 28–37°E | Suez Canal northbound exits |

Vessels outside all 6 boxes are not received from AISStream.io. To adjust coverage, edit the `BOUNDING_BOXES` array in `src/services/ais-ingester/index.ts`.

Vessel positions will start appearing on the map within seconds of a successful connection.

---

## Production Deployment

### Architecture

The app has two components that deploy separately:

| Component | What It Is | Hosting |
|-----------|------------|---------|
| Next.js app | Frontend + all API routes | Vercel (recommended) |
| AIS Ingester | Standalone Node.js WebSocket service | Railway or Render |

Vercel cannot maintain persistent WebSocket connections — this is why the ingester is a separate service. All data flows through the shared production database.

### Production Database

Options (TimescaleDB required — plain PostgreSQL will not work):

- **[Timescale Cloud](https://console.cloud.timescale.com)** (recommended) — managed, free tier available
- **Railway PostgreSQL** with TimescaleDB extension enabled
- **Self-hosted** — VPS running `timescale/timescaledb:latest-pg16` via Docker

After creating the database, apply the schema:
```bash
psql <your-production-DATABASE_URL> -f src/lib/db/schema.sql
```

### Next.js App on Vercel

1. Connect your GitHub repository to Vercel
2. In Vercel Project Settings > Environment Variables, add all 8 environment variables from the table above, using the production database URL
3. Deploy — Vercel auto-detects Next.js and builds with `next build`

### AIS Ingester on Railway

The ingester lives at `src/services/ais-ingester/` and has its own `package.json` with a `start` script.

**Railway:**
1. Create a new Railway service from your GitHub repo
2. Set the root directory to `src/services/ais-ingester/`
3. Add environment variables: `DATABASE_URL` (production), `AISSTREAM_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `FRED_API_KEY`, `NEWSAPI_KEY`
4. Railway auto-runs `npm start`

**Render (alternative):**
Same pattern — create a Web Service, set root directory to `src/services/ais-ingester/`, set env vars, Render runs `npm start`.

---

## Troubleshooting

**Map is blank, no error message**
The `NEXT_PUBLIC_MAPBOX_TOKEN` env var is missing or uses the wrong name. Confirm the variable name is exactly `NEXT_PUBLIC_MAPBOX_TOKEN` (not `MAPBOX_TOKEN`). Rebuild after setting it.

**Ingester crashes immediately with "relation does not exist"**
The database schema hasn't been applied. Run step 3 (Apply Database Schema) before starting the ingester.

**Schema application fails with "function create_hypertable does not exist"**
You started a plain `postgres:16` container instead of `timescale/timescaledb:latest-pg16`. Stop the container, remove it, and use the exact Docker image from step 2.

**Oil prices show as offline**
Alpha Vantage free tier is 25 requests/day. The app fetches prices every 6 hours, so this limit is rarely hit during normal use. If it does hit, the FRED fallback takes over. Set both `ALPHA_VANTAGE_API_KEY` and `FRED_API_KEY` for maximum resilience.
