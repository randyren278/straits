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

1. No drawn ship exceeds 28 kn. Jitter under 185 m never renders as motion. No history curve or estimate crosses land.
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
   - **On land**: a fix more than one grid cell (about 1 nm) inland is rejected as likely GPS interference. Ships at berth sit within a cell of water, so they survive.
2. **Smooth**: a constant-velocity Kalman filter per axis in local nautical miles (process noise 60 nm²/h³, measurement noise 0.02 nm²), with an RTS smoother for history. This produces the speed and course the feed doesn't have. History renders as a cubic Hermite curve through the smoothed knots, so position and velocity are continuous. Trails split wherever a step implies more than about 30 kn. **Any segment whose curve touches land away from its endpoints is replaced by a sea route** (see the router below). In the mockup, 95 history gaps were rerouted this way, for example ships that vanish off Ras al Khaimah and reappear on the Gulf of Oman side.
3. **Classify**: a ship is underway only if its smoothed speed is between 3 and 28 kn, it made at least two real moves (over 0.3 nm) in the last 45 minutes, and its last knot is under 60 minutes old. Everything else is at rest and is never estimated.
4. **Estimate** (underway only): project forward in 2-minute steps from the last smoothed state, up to 120 minutes past the last real fix. Uncertainty radius = 0.15 nm + backtest error rate × minutes since the fix.
   - **Sea router**: an A* search on a 0.02° water grid built from the land raster. Coastal cells cost 2.5×, and cells with learned traffic density cost less (`1 / (1 + 0.6·ln(1 + density))`). A string-pulling pass removes the grid zig-zag but keeps straights under 6 nm so lane bends survive, followed by Chaikin corner-cutting that is kept only while every segment stays in water.
   - **Straight, rerouted around land** (default): follow the smoothed course while the water ahead is open. About 20 minutes before that course would meet land, hand over to the sea router toward the most lane-like open water ahead. Plain straight-line estimation is never shipped, because it strands ships at the coast.
   - **Sea route throughout**: route from the first minute. It scored worse in the mockup, since ships in open water hold their course over this horizon.
   - **Learned lanes** feed the router's cost surface, not a separate estimator. The INTERTANKO Gulf transit corridors can seed the density as a prior.
   - **Destination route**: `searoute-ts` (MIT, Eurostat 2025 marnet) to a destination resolved by `src/lib/geo/ports.ts`. Only for fresh, resolvable destinations. Today those are almost all AISStream ships outside our region.
   - **The backtest decides which estimator is live.** A method is enabled only while it beats the incumbent.
5. **Carry every estimable ship to the current time.** A ship is estimable when its smoothed speed is 1–28 kn and it made a real move (over 0.3 nm) in the 90 minutes before its last fix. It doesn't need to be well tracked. Its estimate runs from its last real fix to now, for at most 6 hours, with uncertainty growing all the while.
   - **New data restarts the estimate.** Each arrival of new data is an *epoch*: re-clean and re-smooth with everything known at that moment, then estimate again from the new last state. To avoid a jump, the drawn position eases from the old estimate onto the new one over 8 map-minutes.
   - In the mockup: 79 ships are carried forward to "now" on estimate, 36 of them with no data for over an hour. The following hour of real data produced 396 re-estimates. Across 103 real updates from 36 estimable ships, the median error was 1.6 nm, against 4.0 nm for holding the last fix.
6. **Score evidence** (0–100): fix volume in 24 h (30), recency (25), regularity over the last 3 h (15), consistency, i.e. few rejected fixes (15), identity completeness (15). Tiers: well tracked ≥72, tracked 45–71, sparse <45, stale = no fix in 24 h.
7. **Backtest** (every run): hide the most recent hour, estimate from its start, and score against each real position change in that hour at its midpoint report time. Never score against repeated stale snapshots, because that rewards a frozen dot. Record the results and publish the live method's error on the site.

## Mockup evidence (one run, small sample)

Hiding the last hour and scoring 54 real position updates from 20 underway ships:

| Estimator | Median error |
|---|---|
| Hold last fix (today) | 4.5 nm |
| Straight line, runs aground | 1.08 nm |
| Sea route throughout | 2.20 nm |
| **Straight, rerouted around land** (shipped) | **1.10 nm** |

The rerouted estimator keeps straight-line accuracy (within 2%). Every sampled estimate point was in water, and history points came out 99.9% in water (the remainder hug the coast near ports). Three underway ships went silent in that hour; estimation is what keeps them on the map. Tiers from the same data: 185 well tracked, 234 tracked, 160 sparse, 1,900 stale.

## Data model

- `vessel_track_state` (one row per MMSI, upserted in a single batch per run): smoothed lat/lon, sog, cog, state, last fix and last move times, evidence score and its components (jsonb), tier, estimator used, estimated path (up to 60 `[minutes, lat, lon]` points), uncertainty rate, fixes rejected in 24 h.
- `vessel_track_knots`: the accepted, smoothed measurements (mmsi, t, lat, lon, vx, vy), 7-day retention. These drive trails and replay instead of raw rows.
- `estimator_backtests`: run time, method, horizon bucket, n, median and p90 error.
- Raw ingest becomes **store-on-change**: an identical fallback position updates `vessel_latest_positions.time` but writes no new `vessel_positions` row. This cuts roughly 70% of raw rows and makes region-wide coverage affordable later.

`/api/vessels?view=map` adds tier, score, state, sog, cog and the estimated path for underway well-tracked and tracked ships. The client animates along that path by wall-clock time and glides to the corrected position when new data lands.

## Rendering

A council of four research agents (reference products, motion design, dark cartography, rendering technique) converged on the patterns below. All of them are built in the mockup, and it holds 60 fps on Canvas 2D. WebGL/deck.gl isn't needed at this scale; revisit past about 5,000 animated vessels.

- **Baked basemap**, redrawn only when the camera changes: a shallow-water hint and a sea-side coast halo drawn as stacked wide, low-alpha strokes (clipped to water, fading out at close zoom), faint noise texture, land with an inner shadow, and a hierarchy of labels (italic spaced seas, then countries, then ports with a land-coloured halo). No `shadowBlur` anywhere.
- **Comet tails** using the TripsLayer model: alpha falls with data-time age, `0.8·(1−age)^1.8` in 8 buckets, width tapers from 1.9 to 0.5 px, and trails split at coverage gaps. Only moving ships get tails.
- **Observed vs estimated grammar**: solid for observed history, dashed for the estimate with an 8 px/s dash creep, a widening uncertainty cone that fades toward the horizon, and a hollow chevron while estimated.
- **Density at wide zoom** (ships at rest only; underway and flagged ships are never aggregated). The additive glow was rejected because it blows out to yellow and hides the ships. The replacement uses normal compositing and a muted ramp, keeping amber for tracks, and cross-fades to individual dots as you zoom in. The mockup has all three options behind a switch:
  - **Count circles** (Mapbox/supercluster style; the default): radius `clamp(6 + 2.2·√n, 8, 24)` px, slate fill, and a stroke that warms from grey to ochre at 10 and 60 ships. The count is printed from 5 ships up.
  - **Grid** (Global Fishing Watch style): world-anchored cells sized to 18–36 px, a five-step slate→ochre ramp (1/3/10/25/60 ships), counts printed from 10 ships up.
  - **Dots plus anchorage outlines**: 2 px dots with a dashed hull and a label such as "OFF FUJAIRAH · 315 AT ANCHOR".
- An estimated ship is drawn as a hollow chevron that fades in three steps with time since its last real fix. Stretches a ship covered on estimate alone get a faint ghost trail, not a wake.
- **Arrival pings**: a ring that grows from 3 to 16 px over 800 ms when a real fix lands during playback, staggered per ship so the map breathes instead of pulsing in unison.
- **Camera**: the van Wijk & Nuij zoom-out-and-in flight (ρ = 1.41) with Material 3 emphasized easing, 500–1,400 ms.
- **Selection**: staged. The ring contracts at 0 ms, context dims at 250 ms, history draws on at 350 ms, the cone at 850 ms, and the panel slides in at 520 ms.
- **Playback** eases in over about 400 ms.
- **Reduced motion** drops the flights, creep, breathing and pings.

- Tier styling (unchanged): well tracked at full brightness, larger glyph, 90-minute smoothed wake, names at close zoom.
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
