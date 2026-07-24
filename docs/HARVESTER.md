# Straits — macOS Live-Data Harvester

Keeps the deployed Supabase database fed with **live AIS positions** by running a
bounded harvest on this Mac every 10 minutes via a `launchd` LaunchAgent, with an
optional SwiftBar menu-bar readout.

The hosted app on Vercel can't run the always-on ingester (no persistent
WebSockets on serverless), and there is no keyless free AIS source — so the
harvester runs where the free AIS key already lives: your laptop.

---

## Architecture

```
launchd  (StartInterval=600, RunAtLoad)
   └─ scripts/harvester/run-harvest.sh        (wrapper: cd repo, set PATH, load .env.harvester)
        └─ src/services/ais-ingester/harvest-once.ts   (the bounded harvest)
              1. connect AISStream, collect ~90s
              2. dedupe → latest position per vessel this window
              3. bulk upsert vessels + insert positions  → Supabase (:6543 pooler)
              4. run anomaly detectors once
              5. refresh prices / news / sanctions   (freshness-gated)
              6. prune vessel_positions older than RETENTION_DAYS (default 7)
              7. write ~/.straits-harvester/status.json → exit

SwiftBar  (straits.10m.sh, optional)
   └─ reads status.json → 🚢 menu-bar readout + dropdown (open site, run now, view log)
```

**Why bounded, not the daemon:** `src/services/ais-ingester/index.ts` streams
forever + runs crons — right for a server, wrong for a laptop. `harvest-once.ts`
reuses the *same* detectors and refreshers but drives them once and exits, so
`launchd` can re-fire on a clean 10-minute cadence.

**Why `StartInterval`, not `KeepAlive`:** the harvest exits quickly; `KeepAlive`
would relaunch it in a ~10s loop. If the Mac sleeps through fire times, `launchd`
coalesces the misses into a single run on wake (no backfill — expected).

---

## Data volume & retention (Supabase free tier)

- Free tier cap is **500 MB** total DB size. Deduping to latest-per-vessel-per-window
  keeps ingest tiny: a typical run inserts ~25–300 rows (varies with live traffic).
- `raw_message` is never stored (roughly triples row size).
- `RETENTION_DAYS=7` prunes `vessel_positions` older than a week each run. Plain
  Postgres `DELETE` marks tuples dead; autovacuum reclaims the space.
- Current usage prints in `status.json` (`dbSizeMB`, `positionsSizeMB`) and in the
  SwiftBar dropdown — watch it stays well under 500 MB.
- Periodic writes also keep the Supabase project from pausing after 7 days idle.

---

## Setup

### 1. Secrets — `.env.harvester` (repo root, gitignored)

Already created by the deploy step. It holds:

```
DATABASE_URL=postgresql://postgres.<ref>:<pw>@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=no-verify
AISSTREAM_API_KEY=<your free AISStream key>
FRED_API_KEY=<optional, for oil prices>
HARVEST_WINDOW_MS=90000
RETENTION_DAYS=7
```

`DATABASE_URL` is the Supabase **transaction pooler (:6543)** — correct for a
short-lived writer — and points at the SAME database the deployed app reads.

### 2. Install the LaunchAgent

```bash
scripts/harvester/install-harvester.sh
```

This rewrites the plist paths for your machine, validates it, loads it into
`gui/<uid>`, and kickstarts one run immediately. It also installs the SwiftBar
plugin if `~/.swiftbar-plugins` exists.

### 3. (Optional) Menu-bar icon — SwiftBar

```bash
brew install --cask swiftbar
mkdir -p ~/.swiftbar-plugins
open -a SwiftBar          # first launch: point it at ~/.swiftbar-plugins
scripts/harvester/install-harvester.sh   # re-run to drop in the plugin
```

A 🚢 icon shows positions-inserted (green = healthy, orange = stale >30m, red =
last run failed). The dropdown has: open dashboard, run harvest now, view log.

---

## Operations

```bash
# Status of the launchd job
launchctl print gui/$(id -u)/local.straits.harvester | grep -A2 state

# Watch the log
tail -f ~/.straits-harvester/harvest.log

# Last run summary
cat ~/.straits-harvester/status.json

# Force a run right now
launchctl kickstart -k gui/$(id -u)/local.straits.harvester

# Run once by hand (foreground, see all output)
npx tsx --env-file=.env.harvester src/services/ais-ingester/harvest-once.ts

# Uninstall (leaves the log dir)
scripts/harvester/install-harvester.sh --uninstall
```

### Files

| Path | What |
|---|---|
| `src/services/ais-ingester/harvest-once.ts` | The bounded harvest |
| `scripts/harvester/run-harvest.sh` | launchd wrapper (PATH, cd, env-file, log) |
| `scripts/harvester/local.straits.harvester.plist` | LaunchAgent template |
| `scripts/harvester/install-harvester.sh` | Installer / uninstaller |
| `scripts/harvester/straits.10m.sh` | SwiftBar plugin |
| `.env.harvester` | Secrets (gitignored) |
| `~/.straits-harvester/` | Runtime state: `status.json`, `harvest.log`, launchd stdio |

---

## Troubleshooting

- **"works in Terminal, fails under launchd"** — almost always PATH. The wrapper
  sets an explicit PATH (`/opt/homebrew/bin:...`); if node lives elsewhere, edit it.
- **No status.json / job not firing** — `launchctl print gui/$(id -u)/local.straits.harvester`;
  after editing the plist you must `bootout` then `bootstrap` (the installer does this).
- **Site shows AIS "degraded"** — the newest position is >15m old. Either the last
  run failed (check the log) or the Mac was asleep. It self-heals on the next run.
- **DB size creeping up** — lower `RETENTION_DAYS` in `.env.harvester`; space is
  reclaimed by autovacuum after the prune.
- **Few messages per window** — live AIS volume varies by time of day; the window
  is capped at ~90s. Raise `HARVEST_WINDOW_MS` for more per run (costs more runtime).
