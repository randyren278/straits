#!/bin/bash
#
# straits.10m.sh — SwiftBar plugin for the Straits AIS harvester.
#
# Install:
#   brew install --cask swiftbar
#   mkdir -p ~/.swiftbar-plugins
#   cp scripts/harvester/straits.10m.sh ~/.swiftbar-plugins/
#   chmod +x ~/.swiftbar-plugins/straits.10m.sh
#   open -a SwiftBar   # then point it at ~/.swiftbar-plugins on first launch
#
# The 10m in the filename = SwiftBar refreshes it every 10 minutes (matching the
# harvester cadence). It reads ~/.straits-harvester/status.json (written at the
# end of each harvest) and renders a menu-bar readout + dropdown actions.
#
# Everything before the first "---" is the menu-bar line; lines after are the
# dropdown. "| bash=... terminal=false refresh=true" runs a shell action.

STATE_DIR="$HOME/.straits-harvester"
STATUS="$STATE_DIR/status.json"
LOG="$STATE_DIR/harvest.log"
REPO="__REPO__"   # rewritten by install-harvester.sh; falls back below if not
[ -d "$REPO" ] || REPO="$HOME/Developer/tanker-tracker"
SITE="https://straits.randyren.org/dashboard"

# --- no status yet ---
if [ ! -f "$STATUS" ]; then
  echo "🚢 —"
  echo "---"
  echo "Straits harvester: no run yet"
  echo "Run now | bash=/bin/bash param1=$REPO/scripts/harvester/run-harvest.sh terminal=true refresh=true"
  echo "Open dashboard | href=$SITE"
  exit 0
fi

# --- parse status.json (jq if present, else python3) ---
read_json() {
  if command -v jq >/dev/null 2>&1; then
    jq -r "$1 // \"\"" "$STATUS" 2>/dev/null
  else
    python3 -c "import json,sys; d=json.load(open('$STATUS')); k='$2'; v=d.get(k,''); print('' if v is None else v)" 2>/dev/null
  fi
}

# warnings is an array — count it, and list the entries one per line.
read_warnings() {
  if command -v jq >/dev/null 2>&1; then
    jq -r '(.warnings // [])[]' "$STATUS" 2>/dev/null
  else
    python3 -c "import json; print('\n'.join(json.load(open('$STATUS')).get('warnings') or []))" 2>/dev/null
  fi
}

OK=$(read_json '.ok' 'ok')
# jq's `//` operator treats false itself as empty — a failed run must read as
# "false" (red), not as unreadable (orange). Corrupt JSON still yields "".
if [ -z "$OK" ] && command -v jq >/dev/null 2>&1; then
  OK=$(jq -r '.ok | tostring' "$STATUS" 2>/dev/null)
  [ "$OK" = "null" ] && OK=""
fi
LAST=$(read_json '.lastRun' 'lastRun')
INSERTED=$(read_json '.positionsInserted' 'positionsInserted')
UNIQUE=$(read_json '.uniqueVessels' 'uniqueVessels')
MSGS=$(read_json '.messagesReceived' 'messagesReceived')
ANOM=$(read_json '.anomalies' 'anomalies')
TOTAL=$(read_json '.positionsTotal' 'positionsTotal')
DBMB=$(read_json '.dbSizeMB' 'dbSizeMB')
NEWS=$(read_json '.newsRefreshed' 'newsRefreshed')
PRUNED=$(read_json '.pruned' 'pruned')
ERR=$(read_json '.error' 'error')
FAILS=$(read_json '.consecutiveFailures' 'consecutiveFailures')
LASTOK=$(read_json '.lastOkRun' 'lastOkRun')
WARNINGS=$(read_warnings)
WARN_COUNT=0
[ -n "$WARNINGS" ] && WARN_COUNT=$(printf '%s\n' "$WARNINGS" | wc -l | tr -d ' ')

# --- freshness: minutes since last run (status stores UTC, e.g. 2026-07-24T21:04:38.511Z) ---
AGE_MIN="?"
LAST_EPOCH=""
if [ -n "$LAST" ]; then
  # Strip fractional seconds + trailing Z, then parse as UTC.
  LAST_CLEAN="${LAST%.*}"; LAST_CLEAN="${LAST_CLEAN%Z}"
  LAST_EPOCH=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "$LAST_CLEAN" "+%s" 2>/dev/null || echo "")
fi
# A corrupt/unparsable status.json must not disarm the watchdog below — fall
# back to the file's own mtime (it's rewritten at the end of every run).
[ -z "$LAST_EPOCH" ] && LAST_EPOCH=$(stat -f %m "$STATUS" 2>/dev/null || echo "")
if [ -n "$LAST_EPOCH" ]; then
  NOW_EPOCH=$(date "+%s")
  AGE_MIN=$(( (NOW_EPOCH - LAST_EPOCH) / 60 ))
  [ "$AGE_MIN" -lt 0 ] 2>/dev/null && AGE_MIN=0
fi

# --- self-revival: if no run has landed in 30+ min, launchd's StartInterval is
# not firing (agent unloaded, Mac was asleep, job wedged). Nudge it. No -k, so a
# legitimately running harvest is never killed; run-harvest.sh's lock handles
# the rest. Backgrounded so the menu never blocks on it.
if [ "$AGE_MIN" != "?" ] && [ "$AGE_MIN" -gt 30 ] 2>/dev/null; then
  ( launchctl kickstart "gui/$(id -u)/local.straits.harvester" >/dev/null 2>&1 & ) 2>/dev/null
  REVIVED="yes"
fi

# --- menu-bar line: green if ok & recent, amber if degraded or stale, red if failed ---
if [ "$OK" = "true" ] || [ "$OK" = "True" ]; then
  if [ "$AGE_MIN" != "?" ] && [ "$AGE_MIN" -gt 30 ] 2>/dev/null; then
    echo "🚢 ${INSERTED:-0} | color=orange"   # ran ok but data is stale (>30m)
  elif [ "$WARN_COUNT" -gt 0 ] 2>/dev/null; then
    echo "🚢 ${INSERTED:-0} ⚠ | color=orange" # AIS landed, some step degraded
  else
    echo "🚢 ${INSERTED:-0} | color=green"
  fi
elif [ -z "$OK" ]; then
  echo "🚢 ? | color=orange"                  # status.json unreadable — not a verdict either way
else
  echo "🚢 ✗ | color=red"
fi

echo "---"
echo "STRAITS · AIS Harvester | size=11 color=gray"
if [ "$OK" = "true" ] || [ "$OK" = "True" ]; then
  if [ "$WARN_COUNT" -gt 0 ] 2>/dev/null; then
    echo "Last run OK (${AGE_MIN}m ago) · ${WARN_COUNT} degraded | color=orange"
  else
    echo "Last run: ${AGE_MIN}m ago | color=gray"
  fi
elif [ -z "$OK" ]; then
  echo "status.json unreadable — next run rewrites it (${AGE_MIN}m old) | color=orange"
else
  echo "Last run FAILED: ${ERR:-unknown} | color=red"
  [ -n "$FAILS" ] && [ "$FAILS" -gt 1 ] 2>/dev/null && echo "Failing for ${FAILS} runs in a row | color=red"
  [ -n "$LASTOK" ] && echo "Last good run: $LASTOK | size=11 color=gray"
fi
[ -n "$REVIVED" ] && echo "Stale >30m — kickstarted the agent | color=orange size=11"
# Name the degraded steps rather than a generic "failed".
if [ -n "$WARNINGS" ]; then
  echo "---"
  printf '%s\n' "$WARNINGS" | while IFS= read -r w; do
    [ -n "$w" ] && echo "⚠ $w | size=11 color=orange"
  done
fi
echo "---"
echo "Positions inserted: ${INSERTED:-0}  (of ${UNIQUE:-0} unique)"
echo "Messages this window: ${MSGS:-0}"
echo "Active anomalies: ${ANOM:-— (detectors did not run)}"
echo "News refreshed: ${NEWS:-0}"
echo "Pruned (>7d): ${PRUNED:-0}"
echo "---"
echo "DB size: ${DBMB:-?} MB / 500 MB cap | color=gray"
echo "Total positions stored: ${TOTAL:-?} | color=gray"
echo "---"
echo "Open dashboard ↗ | href=$SITE"
echo "Run harvest now | bash=/bin/bash param1=$REPO/scripts/harvester/run-harvest.sh terminal=true refresh=true"
echo "View log | bash=/usr/bin/open param1=-a param2=Console param3=$LOG terminal=false"
echo "Refresh | refresh=true"
