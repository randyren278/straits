#!/usr/bin/env bash
#
# run.sh — one command to boot Tanker Tracker locally.
#
# Fires every part needed for a fully-populated dashboard:
#   1. TimescaleDB (Docker)      4. .env.local (DATABASE_URL)
#   2. wait for Postgres         5. schema (extension + tables, idempotent)
#   3. prerequisites             6. npm deps → 7. seed demo data → 8. dev server
#
# Usage:
#   ./run.sh                 boot everything, seed only if the DB is empty, open dev server
#   ./run.sh --reseed        force a fresh demo dataset (truncates + reseeds)
#   ./run.sh --ingester      also start the live AIS ingester (needs AISSTREAM_API_KEY)
#   ./run.sh --help          show this help
#
# The dashboard comes up at http://localhost:3000/dashboard — no map token, no login.
#
set -euo pipefail
cd "$(dirname "$0")"

# ---- config (override via env if you like) ----
DB_CONTAINER="${DB_CONTAINER:-tanker-ts}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-tanker_tracker}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-password}"
DB_IMAGE="${DB_IMAGE:-timescale/timescaledb:latest-pg16}"
DATABASE_URL_LOCAL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"
APP_URL="http://localhost:3000/dashboard"

RESEED=0
WITH_INGESTER=0
for arg in "$@"; do
  case "$arg" in
    --reseed)   RESEED=1 ;;
    --ingester) WITH_INGESTER=1 ;;
    -h|--help)
      sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 1 ;;
  esac
done

# ---- pretty output ----
AMBER=$'\033[38;5;208m'; RED=$'\033[31m'; DIM=$'\033[2m'; UL=$'\033[4m'; RST=$'\033[0m'
log() { printf '%s▸%s %s\n' "$AMBER" "$RST" "$*"; }
die() { printf '%s✗ %s%s\n' "$RED" "$*" "$RST" >&2; exit 1; }

# ---- 1. prerequisites ----
command -v docker >/dev/null 2>&1 || die "docker not found — install Docker Desktop"
command -v node   >/dev/null 2>&1 || die "node not found — install Node.js 20+"
command -v npm    >/dev/null 2>&1 || die "npm not found"
docker info >/dev/null 2>&1        || die "docker daemon not running — start Docker Desktop"

# ---- 2. database container ----
if docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  log "DB container '$DB_CONTAINER' already running"
elif docker ps -a --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  log "Starting existing DB container '$DB_CONTAINER'"
  docker start "$DB_CONTAINER" >/dev/null
else
  log "Creating TimescaleDB container '$DB_CONTAINER' on port $DB_PORT"
  docker run -d --name "$DB_CONTAINER" -p "${DB_PORT}:5432" \
    -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DB="$DB_NAME" \
    "$DB_IMAGE" >/dev/null
fi

# ---- 3. wait for Postgres ----
log "Waiting for Postgres to accept connections..."
ready=0
for _ in $(seq 1 60); do
  if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    ready=1; break
  fi
  sleep 1
done
[ "$ready" = 1 ] || die "Postgres did not become ready within 60s"

# ---- 4. .env.local (never clobber an existing one) ----
if [ ! -f .env.local ]; then
  log "Creating .env.local with local DATABASE_URL"
  echo "DATABASE_URL=${DATABASE_URL_LOCAL}" > .env.local
elif ! grep -q '^DATABASE_URL=' .env.local; then
  log "Adding DATABASE_URL to existing .env.local"
  echo "DATABASE_URL=${DATABASE_URL_LOCAL}" >> .env.local
else
  log ".env.local already configured — leaving it untouched"
fi

# ---- 5. schema (TimescaleDB extension + tables; idempotent) ----
log "Applying schema (extension + tables)"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q \
  -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" >/dev/null
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q -v ON_ERROR_STOP=1 \
  < src/lib/db/schema.sql >/dev/null

# ---- 6. dependencies ----
if [ ! -d node_modules ]; then
  log "Installing npm dependencies (first run)"
  npm install
fi

# ---- 7. seed demo data (only if empty, unless --reseed) ----
count=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT count(*) FROM vessels;" 2>/dev/null | tr -d '[:space:]' || echo 0)
if [ "$RESEED" = 1 ] || [ "${count:-0}" = 0 ]; then
  log "Seeding demo data (~140 vessels + positions, sanctions, anomalies, prices, news)"
  npx tsx --env-file=.env.local scripts/seed-demo.ts
else
  log "DB already has $count vessels — skipping seed (use --reseed to refresh)"
fi

# ---- 8. optional live AIS ingester ----
cleanup() {
  if [ -f .ingester.pid ]; then
    kill "$(cat .ingester.pid)" 2>/dev/null || true
    rm -f .ingester.pid
    log "Stopped AIS ingester"
  fi
}
trap cleanup EXIT INT TERM

if [ "$WITH_INGESTER" = 1 ]; then
  if grep -Eq '^AISSTREAM_API_KEY=.+' .env.local; then
    log "Starting AIS ingester in background (logs → ingester.log)"
    npm run ingester:dev > ingester.log 2>&1 &
    echo $! > .ingester.pid
  else
    log "--ingester set but no AISSTREAM_API_KEY in .env.local — skipping (seed data still renders the full dashboard)"
  fi
fi

# ---- 9. launch dev server ----
printf '\n  %sTANKER TRACKER%s  %s→%s  %s%s%s\n\n' "$AMBER" "$RST" "$AMBER" "$RST" "$UL" "$APP_URL" "$RST"
printf '  %sCtrl-C to stop. Dashboard, fleet, analytics, and the intel brief are all live.%s\n\n' "$DIM" "$RST"
npm run dev
