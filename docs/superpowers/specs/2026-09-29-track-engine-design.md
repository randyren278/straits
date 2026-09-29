# Track engine: cleaning, estimation and evidence scoring

September 29, 2026. Mockup: [Straits Track Engine](https://claude.ai/artifact/H5eN4ec6oDVeo7RRuh1v1T). It runs this design in the browser on 24 hours of real Hormuz data.

## Problem

Vessel motion on the map is erratic, and most contacts never move. Measured on 24 hours of Hormuz data:

- About 95% of Middle East contacts come from the VesselFinder map scrape (`middle-east-fallback`). It carries no speed or course, heading comes in 11.25° steps, and every fix is stamped with **fetch time**, not report time.
- 73% of fixes repeat the previous position. 63% of the real changes are under 100 m (anchor and GPS jitter). 112 implied jumps exceed 30 kn (teleports, including GPS jamming around Hormuz).
- 1,889 of the 2,479 contacts drawn around Hormuz had no fix in 24 hours. Most came from a single wide snapshot at 00:00 UTC on Sep 27. They look like stationary ships but are only stale dots.
- AISStream has no Gulf, Gulf of Oman or Red Sea coverage.
- Destinations are almost absent where it matters: 10 of 597 Hormuz ships (2%), none of them fresh. The scrape carries no destination field.

The rendering made this worse: straight-line interpolation between fetch-time fixes, heading from a single segment, and a 7-day freshness window.

## Goal

Every drawn ship moves only as fast as the evidence allows, and ships with more evidence carry the story. Success criteria:

1. No drawn ship exceeds 28 kn. Jitter under 185 m never renders as motion.
2. Ships with no fix in 24 hours are hidden by default.
3. Estimated positions beat the current "hold last fix" behavior by at least 50% median error in a rolling backtest, or estimation stays off.
4. Every estimated position is visibly marked as estimated, with growing uncertainty, and stops at a fixed horizon.

## Pipeline

The engine runs on the Mac harvester after each harvest. That machine already has the database connection and the cadence, and it adds no Vercel work. It uses pure functions in `src/lib/tracks/`, so tests and the backtest share one implementation.

1. **Clean** (per vessel, last 24 h of raw fixes)
   - Collapse identical consecutive fixes into runs (first seen, last seen).
   - **Report time**: when a position changes, the report happened between the last fetch that showed the old position and this one. Use the midpoint, not fetch time.
   - **Jitter floor**: a move under 0.1 nm counts as dwelling, not motion.
   - **Teleport quarantine**: an implied speed over 35 kn holds the fix aside. If the next fix lands within 1 nm of it, both are accepted as a real relocation after a gap. Otherwise the fix is rejected and counted.
   - **Dwell**: a position repeated for 25 minutes or more means stopped, so a stationary measurement is added. Shorter repeats are treated as "no new report", which prevents stop-go motion for ships that are underway.
2. **Smooth**: a constant-velocity Kalman filter per axis in local nautical miles (process noise 60 nm²/h³, measurement noise 0.02 nm²), with an RTS smoother for history. This produces the speed and course the feed doesn't have. History renders as a cubic Hermite curve through the smoothed knots, so position and velocity are continuous. Trails split wherever a step implies more than about 30 kn.
3. **Classify**: a ship is underway only if its smoothed speed is between 3 and 28 kn, it made at least two real moves (over 0.3 nm) in the last 45 minutes, and its last knot is under 60 minutes old. Everything else is at rest and is never estimated.
4. **Estimate** (underway only): project forward in 2-minute steps from the last smoothed state, stopping at land (0.01° land raster) and 120 minutes past the last real fix. Uncertainty radius = 0.15 nm + backtest error rate × minutes since the fix.
   - **Straight line** (smoothed course and speed): the default.
   - **Learned lanes**: a flow field built from everyone's cleaned tracks (0.05° cells, direction-matched neighbours, 65/35 blend). The INTERTANKO Gulf transit corridors can seed it as a prior.
   - **Destination route**: `searoute-ts` (MIT, Eurostat 2025 marnet) to a destination resolved by `src/lib/geo/ports.ts`. Only for fresh, resolvable destinations. Today those are almost all AISStream ships outside our region.
   - **The backtest decides which estimator is live.** A method is enabled only while it beats the incumbent.
5. **Score evidence** (0–100): fix volume in 24 h (30), recency (25), regularity over the last 3 h (15), consistency, i.e. few rejected fixes (15), identity completeness (15). Tiers: well tracked ≥72, tracked 45–71, sparse <45, stale = no fix in 24 h.
6. **Backtest** (every run): hide the most recent hour, estimate from its start, and score against each real position change in that hour at its midpoint report time. Never score against repeated stale snapshots, because that rewards a frozen dot. Record the results and publish the live method's error on the site.

## Mockup evidence (one run, small sample)

Hiding the last hour and scoring 54 real position updates from 20 underway ships:

| Estimator | Median error |
|---|---|
| Hold last fix (today) | 4.5 nm |
| Straight line from smoothed track | 1.1 nm |
| Learned lanes, 24 h of history | 1.6 nm |

Straight line wins, so lanes stay off. Three underway ships went silent in that hour; estimation is what keeps them on the map. Tiers from the same data: 190 well tracked, 237 tracked, 163 sparse, 1,889 stale.

## Data model

- `vessel_track_state` (one row per MMSI, upserted in a single batch per run): smoothed lat/lon, sog, cog, state, last fix and last move times, evidence score and its components (jsonb), tier, estimator used, estimated path (up to 60 `[minutes, lat, lon]` points), uncertainty rate, fixes rejected in 24 h.
- `vessel_track_knots`: the accepted, smoothed measurements (mmsi, t, lat, lon, vx, vy), 7-day retention. These drive trails and replay instead of raw rows.
- `estimator_backtests`: run time, method, horizon bucket, n, median and p90 error.
- Raw ingest becomes **store-on-change**: an identical fallback position updates `vessel_latest_positions.time` but writes no new `vessel_positions` row. This cuts roughly 70% of raw rows and makes region-wide coverage affordable later.

`/api/vessels?view=map` adds tier, score, state, sog, cog and the estimated path for underway well-tracked and tracked ships. The client animates along that path by wall-clock time and glides to the corrected position when new data lands.

## Rendering

- Well tracked: full brightness, larger glyph, 90-minute smoothed wake, names at close zoom.
- Tracked: normal glyph, 45-minute wake. Sparse: small and dim, no wake. Stale: hidden, available through a filter chip.
- Estimated: hollow chevron, dashed path 30 minutes ahead, uncertainty ring. The contact panel shows the evidence breakdown, the estimate basis in plain words, and which fixes were kept or rejected.

## Phases

| Phase | Deliverable | Gate to ship |
|---|---|---|
| 1 | Clean, smooth, classify, evidence score. Stale hiding and tier styling on the map. | Fixture tests for jitter, quarantine/confirm, dwell, midpoint time. No rendered speed above 28 kn on a replay of the last 24 h. |
| 2 | Straight-line estimation, uncertainty, glide on update, backtest table and on-site error figure. | Rolling backtest: ≥50% lower median error than holding the last fix. |
| 3 | Store-on-change ingest, `vessel_track_knots`, replay from cleaned knots. | Row growth drops by ≥60%. Replay matches the smoothed tracks. |
| 4 | Learned lanes (7-day history plus corridor prior) and destination routing, each behind the backtest gate. | Beats straight line at 30–120 min horizons, or stays off. |

## Risks and non-goals

- The engine does not fix the source. The VesselFinder scrape remains the dependency, and its terms (§9) prohibit automated extraction. Wider coverage is a separate sourcing decision.
- GPS jamming produces plausible but false tracks. Quarantine catches jumps, not steady offsets. Jamming clusters should lower the consistency score.
- If the Mac is offline, estimates run out at the 120-minute horizon and ships freeze with "no data since" rather than drifting on.
- A backtest on one hour and 20 ships is a signal, not proof. Phase 2 records it every run before anything claims accuracy.
