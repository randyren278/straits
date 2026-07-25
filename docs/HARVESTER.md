# Straits: macOS Live-Data Harvester

Keeps the deployed Supabase database fed with **live AIS positions** by running a
bounded harvest on this Mac every 10 minutes via a `launchd` LaunchAgent, with an
optional SwiftBar menu-bar readout.

The hosted app on Vercel can't run the always-on ingester (no persistent
WebSockets on serverless), and there is no keyless free AIS source. So the
harvester runs where the free AIS key already lives: your laptop.

---

## Architecture

```
launchd  (StartInterval=600, RunAtLoad)
   └─ scripts/harvester/run-harvest.sh        (wrapper: single-flight lock, cd repo, set PATH, load .env.harvester)
        └─ src/services/ais-ingester/harvest-once.ts   (the bounded harvest)
              1. connect AISStream, collect ~90s
              2. dedupe → latest position per vessel this window
              3. bulk upsert vessels + insert positions  → Supabase (:6543 pooler)   ← the CORE
              4. run anomaly detectors once                       ┐
              5. prune vessel_positions older than RETENTION_DAYS │ each time-budgeted;
              6. refresh prices / news / sanctions (freshness-gated) ┘ skipped, never fatal
              7. write ~/.straits-harvester/status.json → exit

SwiftBar  (straits.10m.sh, optional)
   └─ reads status.json → 🚢 menu-bar readout + dropdown (open site, run now, view log)
   └─ if the last run is >30m old, kickstarts the LaunchAgent (self-revival)
```

**Why bounded, not the daemon:** `src/services/ais-ingester/index.ts` streams
forever and runs crons, which is right for a server and wrong for a laptop.
`harvest-once.ts` reuses the *same* detectors and refreshers but drives them once
and exits, so `launchd` can re-fire on a clean 10-minute cadence.

**Why `StartInterval`, not `KeepAlive`:** the harvest exits quickly, and
`KeepAlive` would relaunch it in a ~10s loop. If the Mac sleeps through fire
times, `launchd` coalesces the misses into a single run on wake (no backfill,
which is expected).

---

## Resilience

The harvest is designed so no single slow or broken dependency can take the
feed down. Four mechanisms, in the order they engage:

1. **Success is judged on the AIS core alone.** Once vessels and positions are
   written, the run is `ok: true`. Detectors, prune, and enrichment are
   best-effort — they record entries in `status.warnings` and the menu bar goes
   amber, but the run is not a failure and `launchd` keeps its cadence.
2. **Every non-core step runs under a time budget** measured against the hard
   deadline — detectors 150s, prune 30s, prices 20s, news 30s, sanctions 60s.
   These are sized from measured cost: the detector pass is the expensive one
   (~50-120s over the pooler), while prune and the three refreshers each take
   seconds. A step that can't fit in the time left is skipped with a named
   warning rather than allowed to overrun. Housekeeping is ordered *before*
   enrichment so a slow external API can never starve the prune. When the
   detector pass is abandoned, `anomalies` is reported as `null` ("unknown"),
   never as `0` — a skipped step must not read as a clean result.
3. **`HARVEST_HARD_TIMEOUT_MS` (default 360s) is a backstop, not the plan.** It
   force-exits a wedged run, preserving whatever the core already achieved. It
   stays well under the 600s `StartInterval` so a wedged run delays at most one
   scheduled harvest.
4. **Single-flight lock.** `run-harvest.sh` takes an atomic `mkdir` lock in
   `~/.straits-harvester/harvest.lock`, so a manual "Run harvest now" during a
   scheduled run exits immediately instead of double-inserting the window. A
   lock whose PID is gone is reclaimed as stale.

**Self-revival:** `launchd` restarts the process every 10 minutes, which covers
crashes. The gap it does *not* cover is the agent being unloaded or wedged, so
the SwiftBar plugin kickstarts the job whenever the last run is more than 30
minutes old (without `-k`, so a legitimately running harvest is never killed).

**Health signals** in `status.json`: `warnings[]` names each degraded step,
`consecutiveFailures` counts runs since the last good one (the menu bar
escalates on it), and `lastOkRun` is the last time the core succeeded.

> **Known-bad pattern to avoid.** Until Jul 2026 the sanctions refresh issued one
> INSERT per entry — ~21k round-trips, which at the pooler's ~25ms RTT took ~7
> minutes against a 240s timeout. It was killed mid-transaction every run, so
> `updated_at` never advanced, the 20h freshness gate never closed, and every
> subsequent run retried the same doomed work: a livelock that restarts could not
> fix. It is now chunked into 500-row multi-row upserts (~1.3s). When adding any
> new bulk write, batch it and give it a budget.

---

## Data volume & retention (Supabase free tier)

- Free tier cap is **500 MB** total DB size. Deduping to latest-per-vessel-per-window
  keeps ingest tiny: a typical run inserts ~25-300 rows (varies with live traffic).
- `raw_message` is never stored (it roughly triples row size).
- `RETENTION_DAYS=7` prunes `vessel_positions` older than a week each run. Plain
  Postgres `DELETE` marks tuples dead; autovacuum reclaims the space.
- Current usage prints in `status.json` (`dbSizeMB`, `positionsSizeMB`) and in the
  SwiftBar dropdown, so you can watch it stays well under 500 MB.
- Periodic writes also keep the Supabase project from pausing after 7 days idle.

---

## Setup

### 1. Secrets: `.env.harvester` (repo root, gitignored)

Already created by the deploy step. It holds:

```
DATABASE_URL=postgresql://postgres.<ref>:<pw>@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=no-verify
AISSTREAM_API_KEY=<your free AISStream key>
FRED_API_KEY=<optional, for oil prices>
HARVEST_WINDOW_MS=90000
HARVEST_HARD_TIMEOUT_MS=360000
RETENTION_DAYS=7
```

`ALPHA_VANTAGE_API_KEY` is the documented fallback when FRED errors, but it is
**not set** here — so a FRED failure currently falls through to the last known
prices in the DB (logged as a warning, harmless). Set the key if you want a real
second source.

`DATABASE_URL` is the Supabase **transaction pooler (:6543)**, which is correct
for a short-lived writer, and points at the SAME database the deployed app reads.

### 2. Install the LaunchAgent

```bash
scripts/harvester/install-harvester.sh
```

This rewrites the plist paths for your machine, validates it, loads it into
`gui/<uid>`, and kickstarts one run immediately. It also installs the SwiftBar
plugin if `~/.swiftbar-plugins` exists.

### 3. (Optional) Menu-bar icon: SwiftBar

```bash
brew install --cask swiftbar
mkdir -p ~/.swiftbar-plugins
open -a SwiftBar          # first launch: point it at ~/.swiftbar-plugins
scripts/harvester/install-harvester.sh   # re-run to drop in the plugin
```

A 🚢 icon shows positions-inserted: **green** = healthy, **orange** = stale >30m
or some step degraded (`⚠` suffix), **red** = the AIS core failed. The dropdown
names each degraded step, shows the failure streak and last good run, and has:
open dashboard, run harvest now, view log.

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

- **"works in Terminal, fails under launchd"** is almost always PATH. The wrapper
  sets an explicit PATH (`/opt/homebrew/bin:...`); if node lives elsewhere, edit it.
- **No status.json / job not firing:** run `launchctl print gui/$(id -u)/local.straits.harvester`.
  After editing the plist you must `bootout` then `bootstrap` (the installer does this).
- **Site shows AIS "degraded":** the newest position is >15m old. Either the last
  run failed (check the log) or the Mac was asleep. It self-heals on the next run.
- **Menu bar amber with `⚠`:** AIS landed fine; one of the best-effort steps was
  skipped or timed out. The dropdown names it, and `status.warnings` has the
  detail. A single amber run is normal (e.g. sanctions skipped near the deadline);
  the same step degraded run after run is worth investigating.
- **"harvest skipped (already running)":** the single-flight lock did its job —
  a manual run overlapped the scheduled one. Nothing was lost.
- **Every run fails identically at the same step:** suspect a livelock like the
  sanctions one above — work that cannot finish inside the budget, retried
  forever because its freshness gate never closes. Time the step in isolation
  before assuming the network or the DB is at fault.
- **DB size creeping up:** lower `RETENTION_DAYS` in `.env.harvester`; space is
  reclaimed by autovacuum after the prune.
- **Few messages per window:** live AIS volume varies by time of day, and the window
  is capped at ~90s. Raise `HARVEST_WINDOW_MS` for more per run (it costs more runtime).
