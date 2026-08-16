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
   └─ reads status.json → ● menu-bar readout (hidden when healthy) + dropdown (open site, run now, view log)
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
feed down. Five mechanisms, in the order they engage:

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
   scheduled harvest. It is enforced by polling the wall clock, not a single
   `setTimeout`: Node timers pause during system sleep, so a lid-close mid-run
   once stretched the "360s" cap to 743s of wall clock. The poll's first tick
   after wake sees the expired deadline and exits.
4. **An abandoned step's connection is bounded by Supabase's own
   `statement_timeout` default, not a value this codebase sets — and
   `harvest-once.ts` waits for it instead of racing shutdown against it.**
   node-postgres has no client-side query cancellation — when a `step()`
   budget (above) loses its race against a slow query, the query itself
   keeps running and keeps holding one of the pool's 20 connections. The
   obvious-looking fix (a client-supplied `statement_timeout`, or a bare
   `SET statement_timeout` after connecting) does not work here: verified
   empirically against this project's Supabase transaction pooler (:6543,
   Supavisor), the former is silently dropped (`SHOW statement_timeout`
   still reports the project default, 2min at last check) and the latter is
   actively unsafe — a session-level `SET` was observed leaking into later,
   unrelated client sessions once the pooler recycled the backend, which
   could affect the deployed app's own connections through the same pooler.
   `SET LOCAL` inside an explicit transaction on a `pool.connect()`-checked-out
   client *does* work and does not leak, but requires every call site to hold
   an exclusive client for a wrapped transaction instead of a bare
   `pool.query()` — not applied here (see `pool`'s comment in
   `src/lib/db/index.ts` for the full writeup and options considered). So the
   real worst case for one abandoned query is Supabase's own project-level
   default (currently ~2 minutes), not something tunable from here.
   `connectionTimeoutMillis` is 8s (up from a too-tight 2s — a healthy
   Supabase pooler connect was measured at 1455ms, leaving almost no margin);
   that one *is* fully client-side and works as configured. `harvest-once.ts`
   tracks every abandoned promise and awaits it at shutdown (worst case ~2min)
   before ending the pool, so cleanup doesn't race still-running work — this
   stays safely under the 360s hard timeout above.
5. **Single-flight lock.** `run-harvest.sh` takes an atomic `mkdir` lock in
   `~/.straits-harvester/harvest.lock`, so a manual "Run harvest now" during a
   scheduled run exits immediately instead of double-inserting the window. A
   lock is stale if it is **older than 15 minutes** (checked first, and
   decisive) or its owning PID is gone — see the reboot case below for why age
   has to win.

**Self-revival:** `launchd` restarts the process every 10 minutes, which covers
crashes. The gap it does *not* cover is the agent being unloaded or wedged, so
the SwiftBar plugin kickstarts the job whenever the last run is more than 30
minutes old (without `-k`, so a legitimately running harvest is never killed).

### Laptop closed, or no Wi-Fi

Neither is an error state, and neither requires any intervention.

**Mac asleep or powered off.** Nothing runs — expected, since the harvester
lives here. On wake, `launchd` coalesces every missed fire into a single run
(no backfill: AIS is a live broadcast with no replay, so the gap in track
history is permanent and that is by design). On boot or login, `RunAtLoad`
fires a run immediately. If SwiftBar is up, it also sees a `lastRun` older than
30 minutes and kickstarts, so you get data back without waiting out the
10-minute interval.

The subtle failure here is the lock, not the schedule: a hard power-off leaves
`harvest.lock` behind because the cleanup trap never runs, and after a reboot
its PID number is likely reused by an unrelated process. Liveness alone would
then read as "already running" *forever*. That is why staleness is decided by
**age first** — any lock older than 15 minutes is stale regardless of who
appears to own it, since a harvest is hard-capped at 6.

**No Wi-Fi.** The websocket fails, the window ends empty, and both bulk writes
return early without touching the DB — so the run still exits 0 rather than
crashing. Both facts are recorded as warnings (`AIS websocket error: …` and
`no AIS positions this window (N msgs) — …`), so the menu bar goes amber with
the reason named instead of quietly showing a clean run that collected
nothing. The empty-window check gates on **positions landed, not messages
received** — a darkwake window once collected a single static record and
reported a clean green run with zero positions on the map. The next fire
reconnects from scratch; nothing carries over. If the network is up but
Supabase is unreachable, the AIS write itself fails, `withDbRetry` retries,
and only then does the run go red — which is correct, because that *is* a
real failure.

**Corrupt state can't wedge the loop.** `status.json` is written atomically
(tmp + rename), so a power cut mid-write can't truncate it. If it is somehow
unreadable anyway, the menu bar shows an explicit orange `●` rather than
a false verdict, and the SwiftBar watchdog falls back to the file's mtime for
its staleness check — a corrupt status file can never disarm self-revival.

> **One caveat that no amount of local hardening fixes:** Supabase's free tier
> pauses a project after ~7 days with no activity. If the Mac stays off that
> long, the harvester will fail on return until you resume the project from the
> Supabase dashboard. The 10-minute write cadence is what normally keeps it
> awake.

**Health signals** in `status.json`: `warnings[]` names each degraded step,
`consecutiveFailures` counts runs since the last good one (the menu bar
escalates on it), `lastOkRun` is the last time the core succeeded, and
`consecutiveDetectorFailures` counts runs since the anomaly detectors last
completed (SwiftBar surfaces it once it exceeds 1).

### Sustained-failure alerts (AIS outage + detector failures)

A single bad run is noise; a *run* of them is an incident. Two conditions are
tracked this way, sharing one pure decision function
(`computeSustainedAlert` in `src/services/ais-ingester/outage-alert.ts`, unit
tested without needing a real outage or a broken detector to reproduce):

- **AIS outage** — after `AIS_OUTAGE_THRESHOLD` consecutive windows land zero
  positions (default **3**, ≈30 min at the 10-minute cadence), the harvester
  logs an `ALERT (STRAITS · AIS feed dark):` line and fires a macOS
  notification. `consecutiveEmptyAisWindows`, `aisOutageAlertSent`, and
  `aisOutageLastNotifyAt` carry the streak across runs in `status.json`; a
  window that lands positions resets all three, re-arming the alarm for next
  time.
- **Detector failures** — after `DETECTOR_FAILURE_THRESHOLD` consecutive runs
  where the detector step fails, times out, or is skipped for lack of budget
  (default **6**), the same alert fires under the title `STRAITS · Detectors
  failing`. Mirrors the AIS fields as `consecutiveDetectorFailures`,
  `detectorFailureAlertSent`, `detectorFailureLastNotifyAt`. This closes a gap
  proven by the state a real run reached: the detector step failed on 100% of
  ~30 consecutive runs with nothing counting the streak — `status.warnings` is
  per-run and forgotten the moment the next run overwrites `status.json`.

Both **re-notify** every `OUTAGE_RENOTIFY_HOURS` (default **6**) while their
incident continues, instead of firing once and then going silent for the rest
of a multi-day outage — a heartbeat, not a single edge-triggered shot, but
still never more than one notification per interval per incident.

This exists because of a specific hole: in Aug 2026 the upstream AIS provider
went silent for 30+ hours while every harvest still exited 0 and the menu bar
read `Last run OK`, and the original one-shot alert (since generalized to the
above) would itself have gone silent for the remaining ~29.5 hours of that
same outage. Note the AIS alert says the feed is dark, not whose fault it is —
a dead provider, a revoked key, and a wedged Wi-Fi driver all look identical
from here. Diagnose with `npx tsx --env-file=.env.harvester
scripts/harvester/ais-key-check.mjs`, which subscribes worldwide and exits
non-zero if nothing arrives; a key that is *accepted but silent* (connection
stays open, server still pings) means the provider is down, not your key.

> **Known-bad pattern to avoid.** Until Jul 2026 the sanctions refresh issued one
> INSERT per entry — ~21k round-trips, which at the pooler's ~25ms RTT took ~7
> minutes against a 240s timeout. It was killed mid-transaction every run, so
> `updated_at` never advanced, the 20h freshness gate never closed, and every
> subsequent run retried the same doomed work: a livelock that restarts could not
> fix. It is now chunked into 500-row multi-row upserts (~1.3s). When adding any
> new bulk write, batch it and give it a budget.

> **The same pattern, found again in Aug 2026 — in the detectors.** Every
> detector (`going-dark`, `loitering`, `deviation`, `sts-transfer`, `risk-score`,
> `repeat-going-dark`, `teleport`, `destination-flip`) looped over its candidates
> `await`ing one `upsertAnomaly` per row. With 926 vessels and a measured
> **187ms** pooler round-trip, that is ~153s against the 150s detector budget —
> so the step failed on **100% of runs** and `anomalies` reported `null`
> ("unknown") for weeks while the runs still exited 0. The whole anomaly/risk
> pipeline was dead and nothing escalated it. Fixed by batching every upsert into
> the same 500-row chunked form (`upsertAnomaliesBatch`, `upsertRiskScoresBatch`,
> and a single `unnest`-based `resolveAnomaliesBatch`): **245s → 13s** per
> harvest, detectors completing again.
>
> Two lessons worth more than the fix:
> 1. **Measure before believing a growth story.** The first diagnosis blamed an
>    "unbounded candidate set growing toward the whole vessels table." `vessels`
>    holds 926 rows. The cause was per-round-trip latency, not set size — the
>    arithmetic identified the fix, the narrative did not.
> 2. **The budget mechanism hid it.** A step that fails inside its budget looks
>    like graceful degradation, so a permanently-failing step reads the same as
>    an occasionally-slow one. That is why `consecutiveDetectorFailures` now
>    exists — see "Sustained-failure alerts" above.

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
# AIS_OUTAGE_THRESHOLD=3            # optional, consecutive empty windows before an outage alert
# DETECTOR_FAILURE_THRESHOLD=6      # optional, consecutive detector failures before an alert
# OUTAGE_RENOTIFY_HOURS=6           # optional, re-notify heartbeat while either alert is ongoing
```

`FRED_API_KEY` is genuinely optional: without a key (or with a malformed one —
FRED requires exactly 32 lowercase alphanumerics and rejects anything else with
400) prices come from the **keyless `fredgraph.csv` endpoint**, which serves the
same series. `ALPHA_VANTAGE_API_KEY` is a further fallback, also unset here. If
every source fails (e.g. offline), the harvester records a `prices refresh`
warning and leaves the freshness gate open — it never re-stamps stale DB rows
as fresh, which once hid a misconfigured key for weeks behind a "live" badge.

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

A `●` dot only appears when something needs attention: **orange** = stale >30m,
some step degraded, or status unreadable, **red** = the AIS core failed. When
everything's healthy the plugin outputs nothing and the icon is fully absent
from the menu bar. The dropdown (only reachable while the dot is showing)
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
