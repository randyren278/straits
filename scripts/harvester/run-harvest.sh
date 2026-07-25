#!/bin/bash
#
# run-harvest.sh — wrapper the LaunchAgent invokes every ~10 minutes.
#
# launchd runs jobs with a minimal environment and no login shell, so we:
#   • cd into the repo (relative imports + node_modules resolve here)
#   • set an explicit PATH (launchd EnvironmentVariables does not expand $PATH)
#   • load secrets from .env.harvester via tsx --env-file
#   • append all output to a rotating-ish log
#
# The harvester itself is bounded (connect → ~90s window → flush → detect →
# prune → exit), so this wrapper returns in a couple of minutes and launchd
# fires it again on the next StartInterval.

set -o pipefail

REPO="/Users/randyren/Developer/tanker-tracker"
LOG_DIR="$HOME/.straits-harvester"
LOG="$LOG_DIR/harvest.log"

mkdir -p "$LOG_DIR"

# Find node/npx. launchd gives us a bare PATH, so include common install dirs.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

cd "$REPO" || { echo "$(date -u +%FT%TZ) FATAL: repo not found at $REPO" >>"$LOG"; exit 1; }

# Single-flight: the scheduled run and a manual "Run harvest now" must not
# overlap (two harvests double-insert the same window and fight over the DB).
# mkdir is atomic on macOS.
LOCK_DIR="$LOG_DIR/harvest.lock"

# A lock is stale if it is older than any possible harvest, OR its owner is
# gone. Age is checked FIRST and is decisive, because PID liveness alone is not
# trustworthy: a hard power-off leaves the lock behind (the EXIT trap never
# runs), and after the reboot that PID number is very likely reused by an
# unrelated process — kill -0 would then succeed forever and wedge the harvester
# permanently. The harvest is hard-capped at HARVEST_HARD_TIMEOUT_MS (360s), so
# 15 minutes is ~2.5x any legitimate run.
LOCK_MAX_AGE_SEC=900
lock_is_stale() {
  local mtime age pid
  mtime=$(stat -f %m "$LOCK_DIR" 2>/dev/null || echo 0)
  age=$(( $(date +%s) - mtime ))
  [ "$age" -gt "$LOCK_MAX_AGE_SEC" ] && return 0
  pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
  [ -z "$pid" ] && return 0
  kill -0 "$pid" 2>/dev/null || return 0
  return 1
}

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  if lock_is_stale; then
    echo "----- $(date -u +%FT%TZ) reclaiming stale lock -----" >>"$LOG"
    rm -rf "$LOCK_DIR"
    mkdir "$LOCK_DIR" || { echo "$(date -u +%FT%TZ) FATAL: cannot acquire lock" >>"$LOG"; exit 1; }
  else
    echo "----- $(date -u +%FT%TZ) harvest skipped (already running, pid $(cat "$LOCK_DIR/pid" 2>/dev/null)) -----" >>"$LOG"
    exit 0
  fi
fi
echo $$ > "$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR"' EXIT

echo "----- $(date -u +%FT%TZ) harvest start -----" >>"$LOG"

# --env-file loads .env.harvester (DATABASE_URL + AISSTREAM_API_KEY + FRED_API_KEY).
# Use the repo-local tsx via npx so we don't depend on a global install.
npx tsx --env-file=.env.harvester src/services/ais-ingester/harvest-once.ts >>"$LOG" 2>&1
CODE=$?

echo "----- $(date -u +%FT%TZ) harvest end (exit $CODE) -----" >>"$LOG"

# Keep the log from growing unbounded: trim to the last 2000 lines.
if [ -f "$LOG" ]; then
  tail -n 2000 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
fi

exit $CODE
