# Phase 7: Documentation - Research

**Researched:** 2026-03-13
**Domain:** Developer documentation, README authoring, .gitignore hygiene
**Confidence:** HIGH (all findings from direct codebase audit — no external sources needed)

## Summary

Phase 7 is pure documentation work. No new code is written. The deliverables are a README.md (created from scratch — none currently exists) and a repaired .gitignore (current version is dangerously minimal, missing critical exclusions).

The codebase audit reveals two gaps the planner must address: (1) the .env.example is missing three env vars that the code actually reads (`NEWSAPI_KEY`, `ALPHA_VANTAGE_API_KEY`, `FRED_API_KEY`), and (2) the env var name `NEXT_PUBLIC_MAPBOX_TOKEN` in the live code differs from `MAPBOX_ACCESS_TOKEN` used in the quick-task summary — the code is authoritative, so the README must use `NEXT_PUBLIC_MAPBOX_TOKEN`. The .env.example also needs to be updated to match reality.

There is no Docker compose file. The Docker command is a single `docker run` invocation. No schema migration runner exists — the README must instruct users to run `schema.sql` manually via `psql` or a database GUI. The ingester has its own `package.json` inside `src/services/ais-ingester/` — local development runs it via `npm run ingester` from the project root (which uses `tsx`), while the ingester directory's own `package.json` is for production deployment on Railway/Render.

**Primary recommendation:** Write README.md first (it is the core deliverable), fix .gitignore second, then update .env.example to match all 8 real env vars.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCS-01 | README covers prerequisites, step-by-step local setup (env vars, Docker, schema, ingester) | Full local setup procedure documented below |
| DOCS-02 | README documents every required environment variable with description and where to get it | All 8 vars identified with signup URLs and generation commands |
| DOCS-03 | README includes production deployment section (hosting options, env config, ingester deployment) | Railway/Render pattern documented; Next.js on Vercel documented |
| DOCS-04 | .gitignore excludes .env files, build artifacts, TimescaleDB data volumes, and local logs | Current .gitignore gaps documented; complete replacement listed |
</phase_requirements>

---

## Current State Audit

### What Exists

| File | Status | Notes |
|------|--------|-------|
| `README.md` | MISSING | Does not exist — must be created from scratch |
| `.gitignore` | EXISTS but critically incomplete | Only excludes `node_modules/` and `.env.local` |
| `.env.example` | EXISTS but incomplete | Missing 3 of 8 required env vars |
| `src/lib/db/schema.sql` | EXISTS | Full schema — manually applied via psql |
| `src/services/ais-ingester/` | EXISTS | Standalone service with its own `package.json` |
| `docker-compose.yml` | MISSING | No compose file; Docker is a single `docker run` command |

### .gitignore Current Content (2 lines only)
```
node_modules/
.env.local
```

Missing: `.env`, `.next/`, `dist/`, `*.log`, TimescaleDB data volumes, `tsconfig.tsbuildinfo`, `.planning/debug/`.

### .env.example Current Content (incomplete)

The file exists but documents only 5 of 8 required variables:

| Var in .env.example | Var in code | Match? |
|---------------------|-------------|--------|
| `DATABASE_URL` | `DATABASE_URL` | YES |
| `AISSTREAM_API_KEY` | `AISSTREAM_API_KEY` | YES |
| `JWT_SECRET` | `JWT_SECRET` | YES |
| `PASSWORD_HASH` | `PASSWORD_HASH` | YES |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `NEXT_PUBLIC_MAPBOX_TOKEN` | YES |
| (missing) | `ALPHA_VANTAGE_API_KEY` | NO — in alphavantage.ts |
| (missing) | `FRED_API_KEY` | NO — in fred.ts |
| (missing) | `NEWSAPI_KEY` | NO — in newsapi.ts |

---

## All 8 Required Environment Variables

Sourced from direct code audit of `src/**/*.ts` and the quick-task API key summary.

| Variable | Where Used | Source | Required? | Free Tier | Signup URL |
|----------|-----------|--------|-----------|-----------|------------|
| `DATABASE_URL` | `src/lib/db/index.ts`, ingester | PostgreSQL connection string | Required | Free (local Docker) | n/a — self-hosted |
| `AISSTREAM_API_KEY` | `src/services/ais-ingester/index.ts` | aisstream.io WebSocket API | Required | Yes | https://aisstream.io |
| `JWT_SECRET` | `src/lib/auth.ts` | Self-generated 32+ char secret | Required | n/a | Self-generated |
| `PASSWORD_HASH` | `src/lib/auth.ts` | bcrypt hash of shared password | Required | n/a | Self-generated |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `src/components/map/VesselMap.tsx` | Mapbox access token (browser) | Required | 50k tile loads/month | https://account.mapbox.com/access-tokens/ |
| `ALPHA_VANTAGE_API_KEY` | `src/lib/external/alphavantage.ts` | Oil prices primary source | Required | 25 req/day | https://www.alphavantage.co/support/#api-key |
| `FRED_API_KEY` | `src/lib/external/fred.ts` | Oil prices fallback (optional key) | Optional | No limits | https://fred.stlouisfed.org/docs/api/api_key.html |
| `NEWSAPI_KEY` | `src/lib/external/newsapi.ts` | News headlines | Required | 100 req/day | https://newsapi.org/register |

**Important notes:**
- `NEXT_PUBLIC_` prefix is mandatory — Next.js only exposes env vars with this prefix to the browser. Without it, the Mapbox map renders blank.
- `FRED_API_KEY` is optional — `fred.ts` constructs the URL without a key if it's absent. Still recommended.
- `JWT_SECRET` and `PASSWORD_HASH` are self-generated — no external signup.

### Self-Generation Commands

**JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**PASSWORD_HASH** (replace `your-password-here`):
```bash
node -e "const b=require('bcrypt'); b.hash('your-password-here',10).then(h=>console.log(h))"
```

Note: `bcrypt` not `bcryptjs` — the project uses the `bcrypt` npm package.

---

## Local Setup Procedure (End-to-End)

This is the authoritative step sequence the README must document, derived from codebase audit.

### Prerequisites
- Node.js 18+ (ingester `package.json` specifies `>=18.0.0`)
- Docker Desktop (for local TimescaleDB)
- Git

### Step 1: Clone and Install
```bash
git clone https://github.com/randyren278/tanker-tracker.git
cd tanker-tracker
npm install
```

### Step 2: Start TimescaleDB (Docker)
```bash
docker run -d --name timescaledb -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=tanker_tracker \
  timescale/timescaledb:latest-pg16
```

This runs TimescaleDB (PostgreSQL 16 + TimescaleDB extension) on port 5432.

### Step 3: Apply Database Schema
No migration runner exists. Users must apply schema.sql manually:
```bash
psql postgresql://postgres:password@localhost:5432/tanker_tracker -f src/lib/db/schema.sql
```

Or use a GUI tool (TablePlus, DBeaver, pgAdmin) to run the SQL file.

### Step 4: Configure Environment Variables
```bash
cp .env.example .env.local
# Edit .env.local and fill in all 8 values
```

### Step 5: Start the Next.js App
```bash
npm run dev
```
App available at http://localhost:3000.

### Step 6: Start the AIS Ingester
In a separate terminal:
```bash
npm run ingester
```

The ingester connects to AISStream.io WebSocket and logs:
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

---

## Production Deployment Architecture

Based on STATE.md decisions and ingester code comments.

### Architecture Split
The app has two components that deploy separately:

| Component | What It Is | Hosting |
|-----------|-----------|---------|
| Next.js app | Frontend + API routes | Vercel (recommended) |
| AIS Ingester | Standalone Node.js service | Railway or Render |

Vercel cannot maintain persistent WebSocket connections — this is why the ingester is a separate service. This is a documented architectural decision from Phase 1.

### Next.js on Vercel
1. Connect GitHub repo to Vercel
2. Set all 8 env vars in Vercel Project Settings > Environment Variables
3. Deploy — Vercel auto-detects Next.js and builds with `next build`

### Ingester on Railway
The ingester directory (`src/services/ais-ingester/`) has its own `package.json` with `start` script. Railway deployment:
1. Create new Railway service
2. Point to the GitHub repo
3. Set `RAILWAY_DOCKERFILE_PATH` or configure root directory to `src/services/ais-ingester/`
4. Set env vars: `DATABASE_URL` (pointing to production TimescaleDB), `ALPHA_VANTAGE_API_KEY`, `FRED_API_KEY`, `NEWSAPI_KEY`, `AISSTREAM_API_KEY`
5. Railway auto-runs `npm start` (which is `node --experimental-specifier-resolution=node index.js`)

**Alternative for ingester: Render**
Same pattern — point to the ingester subdirectory, set env vars, Render runs `npm start`.

### Production Database
Options:
- **Timescale Cloud** (recommended) — managed TimescaleDB, free tier available at https://console.cloud.timescale.com
- **Railway PostgreSQL** with TimescaleDB — Railway offers managed PostgreSQL but TimescaleDB extension requires explicit enablement
- **Self-hosted** — VPS with Docker

---

## .gitignore Replacement

The current .gitignore is critically inadequate. The complete replacement:

```gitignore
# Dependencies
node_modules/

# Environment files (NEVER commit secrets)
.env
.env.local
.env.*.local

# Next.js build output
.next/
out/

# TypeScript build info
tsconfig.tsbuildinfo
*.tsbuildinfo

# Logs
*.log
npm-debug.log*

# TimescaleDB data volumes (if running Docker with volume mounts)
pgdata/
timescaledb-data/

# OS files
.DS_Store
Thumbs.db

# Planning debug artifacts
.planning/debug/

# Editor
.vscode/
.idea/
```

**Key additions over current state:**
- `.env` and `.env.*.local` — protect all env file variants
- `.next/` — Next.js build output (currently unignored, showing in `git status`)
- `tsconfig.tsbuildinfo` — already showing as modified in git status, must be excluded
- `pgdata/`, `timescaledb-data/` — Docker volume directories if user mounts them locally
- `.planning/debug/` — already showing as untracked in git status

---

## Common Pitfalls the README Must Address

### Pitfall 1: NEXT_PUBLIC_ prefix confusion
**What goes wrong:** User sets `MAPBOX_TOKEN` instead of `NEXT_PUBLIC_MAPBOX_TOKEN`. Map is blank with no error.
**How to avoid:** Explain in README that Next.js only exposes `NEXT_PUBLIC_*` vars to the browser bundle. Every other env var is server-side only.

### Pitfall 2: Schema not applied
**What goes wrong:** App starts, ingester connects, but DB tables don't exist — ingester crashes immediately with "relation does not exist".
**How to avoid:** Make schema migration step 3 in local setup, before starting any service. Include the exact psql command.

### Pitfall 3: TimescaleDB vs plain PostgreSQL
**What goes wrong:** User runs plain `postgres:16` Docker image instead of `timescale/timescaledb:latest-pg16`. Schema fails with "function create_hypertable does not exist".
**How to avoid:** Specify the exact Docker image in the README. Explain why TimescaleDB is required.

### Pitfall 4: Ingester env vars vs app env vars
**What goes wrong:** User sets env vars in `.env.local` but the ingester doesn't read Next.js env files. The ingester reads from its own `.env` or process environment.
**How to avoid:** The root `npm run ingester` script uses `tsx` which loads `.env.local` via Next.js conventions... actually the ingester imports `dotenv/config` directly (line 20 of ingester/index.ts). So it reads `.env` from the ingester's working directory or the root. Clarify that for local dev, `.env.local` works because `tsx` is run from the root.

### Pitfall 5: Alpha Vantage rate limits
**What goes wrong:** User hits 25 req/day limit immediately during testing. Prices show as offline.
**How to avoid:** Document the limit. Explain FRED is the fallback. Recommend signing up for FRED key too.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

Phase 7 is documentation-only. The requirements are verified by human inspection, not automated tests. However, one automated check is meaningful:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCS-04 | .gitignore excludes .env files, .next/, build artifacts | manual inspection | n/a — manual-only | n/a |
| DOCS-01 | README exists with local setup steps | manual inspection | n/a — manual-only | n/a |
| DOCS-02 | All 8 env vars documented | manual inspection | n/a — manual-only | n/a |
| DOCS-03 | README includes production deployment section | manual inspection | n/a — manual-only | n/a |

**Verification approach:** The planner should include a human verification task (similar to 06-03-PLAN.md) where the implementer:
1. Follows the README from scratch on a clean directory to confirm it works
2. Checks `git status` on a fresh clone to confirm no secrets would be committed
3. Checks that all 8 env vars are present and described in the README

### Wave 0 Gaps
None — no test files to create. Phase 7 has no automated test surface.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema migration | Custom migration runner | Apply schema.sql manually via psql | One SQL file is sufficient; migration tooling (Flyway, Liquibase) is overkill for a personal project |
| Docker orchestration | docker-compose.yml | Single `docker run` command | A compose file adds complexity without benefit for a single-container setup |
| Environment validation | Custom env-check script | Document in README; ingester already validates at startup | The ingester exits with clear errors if DATABASE_URL or AISSTREAM_API_KEY are missing |

---

## Architecture Patterns

### README Structure (Recommended)

```
README.md
├── Overview (1 paragraph — what this is)
├── Prerequisites
├── Local Setup
│   ├── 1. Clone and Install
│   ├── 2. Start TimescaleDB
│   ├── 3. Apply Schema
│   ├── 4. Configure Environment Variables
│   │   └── Full env var table with descriptions and sources
│   ├── 5. Start the App
│   └── 6. Start the Ingester
├── Production Deployment
│   ├── Architecture (Next.js + Ingester split)
│   ├── Next.js on Vercel
│   ├── AIS Ingester on Railway / Render
│   └── Production Database (Timescale Cloud)
└── Troubleshooting (optional, covers top 3 pitfalls)
```

### .env.example Complete Template

The planner should update `.env.example` to document all 8 vars:

```bash
# Database (TimescaleDB/PostgreSQL)
# Local: postgresql://postgres:password@localhost:5432/tanker_tracker
# Production: get from Timescale Cloud or Railway
DATABASE_URL=postgresql://user:password@host:5432/tanker_tracker

# AISStream.io WebSocket API — free tier at https://aisstream.io
AISSTREAM_API_KEY=your_aisstream_api_key

# JWT secret for session tokens — generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_jwt_secret_min_32_chars

# bcrypt hash of the shared dashboard password — generate with:
# node -e "const b=require('bcrypt'); b.hash('yourpassword',10).then(h=>console.log(h))"
PASSWORD_HASH=$2b$10$your_bcrypt_hash_here

# Mapbox access token for map rendering (NEXT_PUBLIC_ prefix required for browser access)
# Get at https://account.mapbox.com/access-tokens/ — free 50k tile loads/month
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token

# Alpha Vantage API key for oil prices (primary) — free 25 req/day
# Get at https://www.alphavantage.co/support/#api-key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key

# FRED API key for oil prices (fallback) — free, no rate limits
# Get at https://fred.stlouisfed.org/docs/api/api_key.html
FRED_API_KEY=your_fred_api_key

# NewsAPI key for geopolitical headlines — free 100 req/day
# Get at https://newsapi.org/register
NEWSAPI_KEY=your_newsapi_key
```

---

## Sources

### Primary (HIGH confidence — direct codebase audit)

All findings are based on direct file reads from the repository. No external sources required.

| File | What Was Checked |
|------|-----------------|
| `src/**/*.ts` (grep) | All `process.env.*` usages — identified all 8 env vars |
| `src/services/ais-ingester/index.ts` | Startup procedure, required env vars, WebSocket connection |
| `src/services/ais-ingester/package.json` | Production start script, Node.js requirement |
| `src/lib/db/schema.sql` | Schema application procedure |
| `.env.example` | What's documented vs what's missing |
| `.gitignore` | Current inadequacy |
| `.planning/quick/1-.../1-SUMMARY.md` | Previous API key reference (used for cross-checking) |
| `package.json` | npm scripts for running app and ingester |

---

## Metadata

**Confidence breakdown:**
- Env var inventory: HIGH — verified by direct grep of all process.env usages
- Local setup procedure: HIGH — derived from actual code (startup checks, ingester startup logs)
- Production deployment: HIGH — from STATE.md decisions + ingester code comments
- .gitignore gaps: HIGH — from `git status` output and file inspection

**Research date:** 2026-03-13
**Valid until:** This research reflects the codebase at time of Phase 7 planning. If Phase 6 changes added new env vars, re-audit before writing the README.
