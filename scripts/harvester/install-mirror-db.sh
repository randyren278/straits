#!/bin/bash
#
# install-mirror-db.sh — set up (idempotently) the local Postgres the harvester
# mirrors its own Supabase tables into, so heavy reads never cross the network.
# See docs/HARVESTER.md "Local mirror".
#
#   bash scripts/harvester/install-mirror-db.sh
#
# Safe to re-run: keeps an existing data directory, rewrites the config and the
# LaunchAgent, and reloads the agent. The mirror holds only re-derivable copies
# of public AIS data, listens on 127.0.0.1 only, and trusts local connections.

set -euo pipefail

PGBIN="/opt/homebrew/opt/postgresql@17/bin"
DATA="$HOME/.straits-harvester/mirror-pg"
PORT=5433
DB=straits_mirror
LABEL=local.straits.mirror-db
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

# The LaunchAgent runs run-mirror-db.sh from this checkout, so it must be the
# permanent one: a worktree disappears, and the mirror with it on next start.
if [ "$(git -C "$REPO" rev-parse --path-format=absolute --git-dir 2>/dev/null)" != \
     "$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" ]; then
  echo "Run this from the main checkout, not a git worktree ($REPO)." >&2
  exit 1
fi

[ -x "$PGBIN/postgres" ] || HOMEBREW_NO_AUTO_UPDATE=1 brew install postgresql@17

if [ ! -f "$DATA/PG_VERSION" ]; then
  mkdir -p "$(dirname "$DATA")"
  # Same encoding and collation as the Supabase database it mirrors.
  "$PGBIN/initdb" -D "$DATA" -U postgres -A trust -E UTF8 --locale=en_US.UTF-8 >/dev/null
fi

cat > "$DATA/straits.conf" <<EOF
# Managed by scripts/harvester/install-mirror-db.sh — edits are overwritten.
port = $PORT
listen_addresses = '127.0.0.1'
unix_socket_directories = '$DATA'
timezone = 'UTC'
log_timezone = 'UTC'
max_connections = 40
shared_buffers = 128MB
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%a.log'
log_truncate_on_rotation = on
log_rotation_age = 1d
EOF
grep -q "^include_if_exists = 'straits.conf'" "$DATA/postgresql.conf" ||
  echo "include_if_exists = 'straits.conf'" >> "$DATA/postgresql.conf"

mkdir -p "$HOME/Library/LaunchAgents"
sed -e "s#__REPO__#$REPO#g" -e "s#__HOME__#$HOME#g" "$REPO/scripts/harvester/$LABEL.plist" > "$PLIST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
# bootout returns before the old postgres has exited (it waits for connected
# sessions); bootstrapping a label that is still loaded fails.
for _ in $(seq 1 60); do
  launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || break
  sleep 1
done
launchctl bootstrap "gui/$(id -u)" "$PLIST"

for _ in $(seq 1 30); do
  "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PORT" -q && break
  sleep 1
done
"$PGBIN/pg_isready" -h 127.0.0.1 -p "$PORT"

if ! "$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$DB'" | grep -q 1; then
  "$PGBIN/createdb" -h 127.0.0.1 -p "$PORT" -U postgres "$DB"
fi
echo "Mirror ready: postgres://postgres@127.0.0.1:$PORT/$DB (the harvester creates its tables)"
