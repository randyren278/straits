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

OK=$(read_json '.ok' 'ok')
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

# --- freshness: minutes since last run (status stores UTC, e.g. 2026-07-24T21:04:38.511Z) ---
AGE_MIN="?"
if [ -n "$LAST" ]; then
  # Strip fractional seconds + trailing Z, then parse as UTC.
  LAST_CLEAN="${LAST%.*}"; LAST_CLEAN="${LAST_CLEAN%Z}"
  LAST_EPOCH=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "$LAST_CLEAN" "+%s" 2>/dev/null || echo "")
  if [ -n "$LAST_EPOCH" ]; then
    NOW_EPOCH=$(date "+%s")
    AGE_MIN=$(( (NOW_EPOCH - LAST_EPOCH) / 60 ))
    [ "$AGE_MIN" -lt 0 ] 2>/dev/null && AGE_MIN=0
  fi
fi

# --- menu-bar line: green if last run ok & recent, amber if stale, red if failed ---
if [ "$OK" = "true" ] || [ "$OK" = "True" ]; then
  if [ "$AGE_MIN" != "?" ] && [ "$AGE_MIN" -gt 30 ] 2>/dev/null; then
    echo "🚢 ${INSERTED:-0} | color=orange"   # ran ok but data is stale (>30m)
  else
    echo "🚢 ${INSERTED:-0} | color=green"
  fi
else
  echo "🚢 ✗ | color=red"
fi

echo "---"
echo "STRAITS · AIS Harvester | size=11 color=gray"
if [ "$OK" = "true" ] || [ "$OK" = "True" ]; then
  echo "Last run: ${AGE_MIN}m ago | color=gray"
else
  echo "Last run FAILED: ${ERR:-unknown} | color=red"
fi
echo "---"
echo "Positions inserted: ${INSERTED:-0}  (of ${UNIQUE:-0} unique)"
echo "Messages this window: ${MSGS:-0}"
echo "Active anomalies: ${ANOM:-0}"
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
