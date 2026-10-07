#!/bin/bash
#
# run-mirror-db.sh — launchd wrapper for the harvester's local Postgres mirror
# (LaunchAgent local.straits.mirror-db, KeepAlive). Runs postgres in the
# foreground so launchd supervises it and restarts it if it dies.

PGBIN="/opt/homebrew/opt/postgresql@17/bin"
DATA="$HOME/.straits-harvester/mirror-pg"
# launchd starts jobs with no locale; macOS Postgres then dies with "postmaster
# became multithreaded during startup" (Homebrew's own service sets this too).
export LC_ALL="en_US.UTF-8"

# A hard power-off leaves postmaster.pid behind. After the reboot its PID can
# belong to an unrelated process, and Postgres then refuses to start because it
# believes another server owns the data directory — forever, the same trap as
# harvest.lock in run-harvest.sh. Only this data directory's own postmaster may
# hold the file, so drop it when that postmaster is not running.
if [ -f "$DATA/postmaster.pid" ] && ! pgrep -f "^$PGBIN/postgres -D $DATA\$" >/dev/null 2>&1; then
  echo "$(date -u +%FT%TZ) removing stale postmaster.pid" >&2
  rm -f "$DATA/postmaster.pid"
fi

exec "$PGBIN/postgres" -D "$DATA"
