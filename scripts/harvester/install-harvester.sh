#!/bin/bash
#
# install-harvester.sh — install (or reinstall) the Straits AIS harvester
# LaunchAgent on this Mac.
#
# What it does:
#   1. Rewrites the plist's absolute paths (repo + home) for THIS machine
#   2. Copies it to ~/Library/LaunchAgents/local.straits.harvester.plist
#   3. plutil -lint validates it
#   4. bootout any existing instance, then bootstrap the fresh one
#   5. kickstart one run immediately so you see data right away
#
# Usage:
#   scripts/harvester/install-harvester.sh          install / reinstall
#   scripts/harvester/install-harvester.sh --uninstall
#
# Requires: .env.harvester present in the repo root (DATABASE_URL + AISSTREAM_API_KEY).

set -euo pipefail

LABEL="local.straits.harvester"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SRC_PLIST="$REPO/scripts/harvester/$LABEL.plist"
DEST_PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UID_NUM="$(id -u)"
DOMAIN="gui/$UID_NUM"

uninstall() {
  echo "▸ Unloading $LABEL ..."
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || launchctl bootout "$DOMAIN" "$DEST_PLIST" 2>/dev/null || true
  rm -f "$DEST_PLIST"
  echo "✓ Uninstalled. (Log dir ~/.straits-harvester left intact.)"
}

if [ "${1:-}" = "--uninstall" ]; then
  uninstall
  exit 0
fi

# --- preflight ---
[ -f "$REPO/.env.harvester" ] || { echo "✗ Missing $REPO/.env.harvester — create it first (DATABASE_URL + AISSTREAM_API_KEY)."; exit 1; }
[ -f "$SRC_PLIST" ] || { echo "✗ Missing source plist $SRC_PLIST"; exit 1; }
chmod +x "$REPO/scripts/harvester/run-harvest.sh"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.straits-harvester"

# --- rewrite paths for this machine ---
echo "▸ Writing $DEST_PLIST (paths rewritten for this Mac) ..."
sed -e "s#/Users/randyren/Developer/tanker-tracker#$REPO#g" \
    -e "s#/Users/randyren/.straits-harvester#$HOME/.straits-harvester#g" \
    "$SRC_PLIST" > "$DEST_PLIST"

# --- validate ---
plutil -lint "$DEST_PLIST" >/dev/null && echo "✓ plist valid"

# --- (re)load ---
echo "▸ Bootstrapping into $DOMAIN ..."
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$DEST_PLIST"
launchctl enable "$DOMAIN/$LABEL" 2>/dev/null || true

echo "▸ Kickstarting first run ..."
launchctl kickstart -k "$DOMAIN/$LABEL"

echo ""
echo "✓ Installed. The harvester now runs every 10 minutes."
echo "  Logs:    ~/.straits-harvester/harvest.log"
echo "  Status:  ~/.straits-harvester/status.json"
echo "  Check:   launchctl print $DOMAIN/$LABEL | grep -A2 state"
echo "  Remove:  scripts/harvester/install-harvester.sh --uninstall"

# --- optional: install the SwiftBar menu-bar plugin if the plugins dir exists ---
SWIFTBAR_DIR="$HOME/.swiftbar-plugins"
if [ -d "$SWIFTBAR_DIR" ]; then
  echo ""
  echo "▸ SwiftBar plugins dir found — installing straits.10m.sh ..."
  sed "s#__REPO__#$REPO#g" "$REPO/scripts/harvester/straits.10m.sh" > "$SWIFTBAR_DIR/straits.10m.sh"
  chmod +x "$SWIFTBAR_DIR/straits.10m.sh"
  echo "✓ Menu-bar plugin installed (SwiftBar will pick it up on next refresh)."
else
  echo ""
  echo "ℹ For the menu-bar icon: brew install --cask swiftbar, then"
  echo "  mkdir -p ~/.swiftbar-plugins && point SwiftBar at it, then re-run this installer"
  echo "  (or: sed 's#__REPO__#$REPO#g' scripts/harvester/straits.10m.sh > ~/.swiftbar-plugins/straits.10m.sh && chmod +x ~/.swiftbar-plugins/straits.10m.sh)"
fi
