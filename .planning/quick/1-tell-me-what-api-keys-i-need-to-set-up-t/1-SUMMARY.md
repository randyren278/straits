---
phase: quick
plan: 1
subsystem: infra
tags: [env, api-keys, secrets, configuration]

requires: []
provides:
  - "Complete API key reference for all 8 required secrets"
  - "Instructions for generating JWT_SECRET and PASSWORD_HASH locally"
  - "Docker command for local TimescaleDB setup"
  - ".env.local template with all variables"
affects: [all-phases]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: [.env.local]

key-decisions:
  - "All 8 secrets must be configured before the app starts cleanly"
  - "JWT_SECRET and PASSWORD_HASH are self-generated (no signup needed)"
  - "DATABASE_URL can point to local Docker TimescaleDB or Timescale Cloud"

patterns-established: []

requirements-completed: []

duration: n/a
completed: 2026-03-12
---

# Quick Task 1: API Key Setup Summary

**8 external secrets documented with signup URLs, free tier details, and generation commands for self-hosted secrets**

## Performance

- **Duration:** < 1 min (informational task)
- **Completed:** 2026-03-12
- **Tasks:** 2 (both human-action checkpoints)
- **Files modified:** 0 (awaiting user input)

## Accomplishments

- Identified all 8 required secrets for end-to-end app operation
- Provided direct signup URLs for each external service
- Documented free tier limits (all services have adequate free tiers for personal use)
- Provided self-generation commands for JWT_SECRET and PASSWORD_HASH
- Provided Docker command for local TimescaleDB instance
- Provided complete .env.local template ready to fill in

## What You Need to Do

This quick task is a human-action checkpoint. The plan cannot be auto-executed because you must sign up for external services and provide secrets.

### The 8 Required Secrets

| Secret | Source | Cost | Priority |
|--------|--------|------|----------|
| `AISSTREAM_API_KEY` | https://aisstream.io | Free tier | Required - ships won't show without it |
| `MAPBOX_ACCESS_TOKEN` | https://account.mapbox.com/access-tokens | Free (50k loads/month) | Required - map is blank without it |
| `ALPHA_VANTAGE_API_KEY` | https://www.alphavantage.co/support/#api-key | Free (25 req/day) | Required for oil prices |
| `FRED_API_KEY` | https://fred.stlouisfed.org/docs/api/api_key.html | Free, no limits | Recommended (price fallback) |
| `NEWSAPI_KEY` | https://newsapi.org/register | Free (100 req/day) | Required for news panel |
| `JWT_SECRET` | Generate locally (see below) | Free | Required for auth |
| `PASSWORD_HASH` | Generate locally (see below) | Free | Required for auth |
| `DATABASE_URL` | Local Docker or Timescale Cloud | Free (local) | Required |

### Generate JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Generate PASSWORD_HASH

```bash
node -e "const b=require('bcryptjs'); b.hash('your-password-here',10).then(h=>console.log(h))"
```

Replace `your-password-here` with the shared password you'll give to friends.

### Start Local Database

```bash
docker run -d --name timescaledb -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=tanker_tracker \
  timescale/timescaledb:latest-pg16
```

### .env.local Template

Create `.env.local` in the project root:

```
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/tanker_tracker

# AIS live feed
AISSTREAM_API_KEY=your_key_here

# JWT for session auth
JWT_SECRET=your_64char_hex_here

# Bcrypt hash of shared login password
PASSWORD_HASH=your_bcrypt_hash_here

# Map rendering
MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token

# Oil prices (primary + fallback)
ALPHA_VANTAGE_API_KEY=your_alphavantage_key
FRED_API_KEY=your_fred_key

# News panel
NEWSAPI_KEY=your_newsapi_key
```

Also create `src/services/ais-ingester/.env`:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/tanker_tracker
AISSTREAM_API_KEY=your_key_here
```

### Verification

After creating `.env.local`, run:

```bash
npm run dev
```

Expected: App starts at http://localhost:3000 with no "missing env" errors in the terminal.

## Deviations from Plan

None - this was an informational task with no code changes.

## Issues Encountered

None.

---
*Phase: quick*
*Completed: 2026-03-12*
