# Straits performance implementation checkpoint

September 29, 2026. This records the implementation following the [baseline audit](PERFORMANCE_AUDIT_2026-09-28.md). The four migrations were applied to production and the code released as `f79c661` the same day; [live results](#live-release-results) follow the local record.

## Implemented

- The dashboard shell no longer waits for four database count queries to pick a map camera. It starts at Hormuz unless an investigation link requests another view.
- Shared, visibility-aware polling avoids duplicate startup reads. Desktop opens with nine API calls and phone with six, versus 17 in the live baseline. Unopened chokepoint lists issue no request; opening a list still fetches it. Public summaries have bounded CDN cache headers; watchlist and alerts remain private.
- A `vessel_latest_positions` read table, insert trigger, and repeatable backfill now serve fleet positions and current chokepoint views without scanning raw history. Both Timescale and plain PostgreSQL schemas include the same model. Apply [the migration](../scripts/migrations/20260929_vessel_latest_positions.sql) **before** deploying application code that reads it.
- A compact `vessel_daily_presence` table records each observed MMSI once per UTC day and region. Traffic, coverage, and SPC charts now read these durable facts instead of seven-day raw history. The [daily-presence migration](../scripts/migrations/20260929_vessel_daily_presence.sql) backfills whatever raw history still exists; already-pruned days cannot be recovered. The Mac harvester retains 120 days of facts.
- MapLibre initializes overlays when the style is ready and reveals after a frame with the vessel source loaded. It no longer waits for unrelated basemap tiles and glyphs to become idle. Hidden tabs pause vessel polling and abort the current request. Worker assets use a versioned URL with immutable browser caching.
- The map requests a compact `view=map` vessel response that removes duplicated position identity. The default `/api/vessels` response remains compatible with existing consumers; deep-linked map selections reconstruct the expected vessel shape, including the separately stored `lastSeen` timestamp. On the 5,140-contact fixture the compressed vessel response fell from about 98 KB to 71 KB.
- The AIS outage explanation now floats below the map filters instead of expanding the header after `/api/status` resolves. This preserves the map layout when the Mac or upstream feed goes offline.
- The oil-price sparkline is a small SVG, keeping Recharts out of the dashboard's initial JavaScript graph. The STS detector now compares contacts in neighboring geographic cells, excludes duplicate identities for one MMSI, and reads current fixes from the latest table.
- Primary navigation links no longer preload the Analytics, Fleet, and Manual routes merely because their links are visible. Their static route data and the Analytics Recharts bundle had been competing with the map's first load; links still navigate normally when selected.
- The fleet anomaly API's active-contact check also reads the latest table. Its built local route returned 200 and 24 fixture anomalies.
- Returning dashboard visitors request only active anomaly IMO/timestamp pairs newer than their previous visit. The API filters those on the server; the fleet's full anomaly response remains unchanged.
- Fleet tab counts and the first 15 rows arrive in one summary response. Changing tabs, sorting, and paging fetches only a 15-row slice. Sanctioned hulls are deduplicated before paging, keeping the highest-risk active event per IMO; the default full anomaly API remains available to existing callers.
- A sampled first-party telemetry path now records LCP, INP, CLS, shell readiness, snapshot receipt, map-style readiness, vessel-render readiness, and initial map/data failures. The payload uses a random sample ID and coarse route/device/connection categories; it excludes IP addresses, query strings, vessel searches, and watchlists. A read-only seven-day report groups samples by build and category, with a minimum of 100 samples per group before assessment. The Mac harvester prunes samples after 30 days. Apply [the telemetry migration](../scripts/migrations/20260929_performance_samples.sql) before deploying the endpoint.
- The fleet, chokepoint, and Current Watch hot reads now emit structured pool-acquisition/query timing for slow requests and a small sample of healthy requests, without SQL text or parameters. Those API responses also expose `Server-Timing` for database/composition and serialization stages. Current Watch event lookups use `vessel_latest_positions` rather than searching raw position history for each event.
- Current Watch now builds the same regional traffic/coverage facts with one 48-hour count query, one seven-day coverage query, and one durable daily-SPC query instead of separate queries per chokepoint. Along with its unchanged event query, a cache regeneration uses four database requests rather than fourteen. The same 5,140-contact fixture produced byte-for-byte identical watch items before and after the change; local elapsed time was 162ms versus 150ms in one run, not a production latency claim.
- Vercel functions are configured for `pdx1` in `vercel.json`, colocated with the verified `us-west-2` Supabase Straits project instead of the inspected `iad1` default. The setting takes effect only after deployment and needs a live request-ID check.
- The Vercel database pool is capped at five connections per instance while the standalone/local worker keeps a separate budget of 20. Scheduled worker jobs now use renewable database leases instead of session advisory locks, which are unsafe through the production transaction pooler.

## Evidence and limits

| Check | Observed result |
|---|---|
| Local 140-contact phone lab before map render change | 11.05s map-ready signal |
| Earlier local 5,140-contact phone lab, gzip proxy modelling Vercel JSON compression | 5.81–5.95s map-ready; 4.82–5.08s LCP; six initial APIs; 0.001 maximum-window CLS |
| Same lab after compact map transport, before outage-banner correction | 5.79–5.84s map-ready; compressed vessel request about 71 KB and 0.92s versus about 98 KB and 1.18s before. The fixture had aged into an AIS-offline state, and the expanding banner caused 0.129 CLS. |
| Same AIS-offline fixture after floating banner, two fresh-context phone runs | 5.65–5.74s map-ready; 4.17–4.18s LCP; 0.00093 CLS. The banner still explains the outage without moving the map. This is a local layout check, not a field-vitals result. |
| Local 5,140-contact desktop lab | 2.04s map-ready; nine initial APIs |
| Local 276,260-row history, 5,140 latest contacts | Latest-fix identity/coordinates match the historical distinct-on query; enriched fleet 13.7ms and one chokepoint count 9.1ms in `EXPLAIN ANALYZE` |
| Disposable PostgreSQL 17 with 2,812,600 raw positions (10× history), 5,140 latest contacts | Latest-fix identity/coordinates still match exactly (zero differences). Old latest-per-MMSI plan: 886ms and 556k buffer hits; latest-table scan: 1.0ms. End-to-end local fleet/counts/daily reads: 43/4/36ms respectively. Fixture removed after measurement. |
| STS candidate SELECT at 5,000 contacts | 6.36s all-pairs versus 79ms cell-bounded on the same local fixture |
| Local mixed-route burst, one server and one disposable DB | 50 simultaneous requests: p95 1.33s, zero errors; this is not a production capacity rating |
| Final built local mixed-route ramp, disposable DB | 1/5/10/25/50 concurrent requests all returned 200; at 50, p95 was 697ms with zero errors. This short burst has no dwell time or concurrent ingestion and is not a soak or production capacity rating. |
| Same local ramp with Vercel's five-connection web-pool setting | 1/5/10/25/50 requests all returned 200; at 50, p95 was 594ms with zero errors on a warm local fixture. Structured logs exposed pool waits up to about 406ms and an observed waiting queue; scaling depends on public cache hits and the production pooler. This does not model multiple serverless instances or Supabase network latency. |
| Portable schema and trigger on disposable PostgreSQL 17 | 1,260 seeded positions, 140 latest contacts; out-of-order, source/data ties, departed zone, and adjacent STS cells passed |
| Daily presence on Timescale and PostgreSQL 17 | Raw-to-fact regional/day count parity; same-day deduplication, multiple regions, and survival after raw-position deletion passed |
| Hormuz daily-count query on the same 276k-row local fixture | 393ms over raw history versus 3.1ms over daily presence; both are local `EXPLAIN ANALYZE` samples |
| Daily-presence storage on that fixture | 30,228 facts use 3.0 MiB including indexes (about 102 bytes/fact); actual 120-day production storage still needs observation |
| Disposable PostgreSQL 17 trigger overhead, transactional inserts rolled back | At 410 positions, 9–17ms with latest-position trigger alone versus 18–22ms with daily presence; at 5,000, 86–94ms versus 180–195ms. This is local DB execution, not Supabase pooler latency. |
| Concurrent job lease calls on local Timescale and PostgreSQL 17 | Second claimant skipped, first released, next claimant acquired; an expired owner was recovered |
| Fleet paging on a disposable 46-row loitering tab | 81/81 desktop/mobile browser checks passed, including global sort, page changes, dossier collapse, and mobile height. Counts and all 15-row pages matched the full response with no missing or repeated IDs; the 40 temporary anomalies were then removed. Summary/page SQL returned 200 on Timescale and plain PostgreSQL 17. |
| Sampled first-party telemetry, local Chrome + disposable DB | A sampled visit wrote LCP, INP, CLS, shell-ready, and map-ready rows through the endpoint; the aggregated read-only report returned p50/p75/p95. Test rows were deleted afterward. The migration applied idempotently on Timescale and PostgreSQL 17. No production field sample exists yet. |
| Final sampled map-stage path, local Chrome + disposable DB | A fresh visit wrote `SHELL_READY`, `MAP_STYLE_READY`, `SNAPSHOT_RECEIVED`, and `MAP_READY` through the built endpoint. Those test rows were removed from the disposable DB. |
| Phone lab after telemetry integration, two fresh-context runs | 5.69–5.72s map-ready; 4.20s LCP; 0.00093 CLS; about 1.09 MB captured encoded page-target responses. The instrumentation added about 4.4 KB to the prior offline-banner run, with no material map-ready change. |
| Early vessel-fetch preload experiment, paired two-run phone lab | Baseline 5.67–5.69s map-ready and 4.19–4.20s LCP; preload 6.01–6.05s map-ready and 4.55–4.56s LCP. The early 71 KB transfer contended with critical scripts under the 1.6 Mbps profile. The preload was removed. |
| Navigation-prefetch correction, five fresh-context phone runs | 4.84–4.91s map-ready, 3.35–3.39s LCP, 0.00093 CLS; 35 page-target requests and about 929 KB encoded versus 47 and about 1.09 MB immediately before. The ~123 KB Analytics chart chunk and four route prefetches disappeared from first load. The proposed ≤5s phone lab map-ready target now passes on this local fixture. |
| Navigation-prefetch correction, two local desktop runs | 0.47–0.50s map-ready and 39 page-target requests. This is a warm local server, not a like-for-like comparison with the remote live baseline. Browser click-through to Analytics, Fleet, Manual, and back to a rendered map passed on phone and desktop without page errors. |
| Built local hot API timing on 5,140 contacts | `/api/vessels?view=map`: 40.9ms DB and 17.0ms serialization; `/api/chokepoints`: 4.6ms DB and 0.2ms serialization; `/api/watch`: 167.4ms composition and 0.9ms serialization. These are single local samples, not tail latencies. Watch items matched the prior response aside from the naturally advancing `traffic.at` timestamp. |
| Existing Mac LaunchAgent, read-only check | Last run exited 0; status recorded 410 positions, zero consecutive feed/detector failures, and no warnings at the check time |
| Production DB preflight, read-only transaction | 275,516 estimated raw positions; 76.2 MB position relation, 148.0 MB database; `vessel_latest_positions`, `vessel_daily_presence`, and `job_leases` are absent, while `pipeline_runs` exists. No production writes were made. |

Browser screenshots and raw traces are under [local performance artifacts](../artifacts/performance/). The gzip proxy compresses only the vessel JSON; it does not reproduce Vercel cold starts, Supabase latency, CDN cache state, or field devices. The live baseline measured 9.66–10.33s mobile map readiness and 5.00–5.94s LCP. Comparing the two suggests improvement in map readiness, but only a post-deploy run and field data can establish the actual user gain. The 5-second mobile lab map-ready target is now met across five local runs; the 2.5-second field p75 LCP target is **not yet demonstrated**.

The browser loading regression check passed delayed-data render on phone and desktop. A local dashboard network check saw exactly one request for each expected startup endpoint and zero unopened vessel lists. The broader layout script had two analytics mobile-nav failures; the same failures occur on the pre-change live site, outside this dashboard change.

Final `npm run ci` after the navigation-prefetch change passed: ESLint, TypeScript, 791 passing tests (nine todo, one skipped file), and the optimized Next.js production build. `npm audit --omit=dev --audit-level=high` found zero vulnerabilities. The dashboard is statically rendered. Fresh Timescale and PostgreSQL 17 schemas applied cleanly; the revised telemetry migration also reran successfully on both disposable engines. The built 90-day traffic and correlation APIs returned the expected local fixture data and coverage. `git diff --check` passed. The phone lab traces and screenshots are in `artifacts/performance/final-mobile/`, `artifacts/performance/compact-map-final-mobile/`, `artifacts/performance/offline-banner-overlay/`, `artifacts/performance/rum-mobile/`, and `artifacts/performance/nav-no-prefetch/`; the loading regression script confirmed rendered markers on both phone and desktop. Local fleet layout passed 79/79 on the normal fixture and 81/81 with multiple pages. The broader dashboard layout script passed 112/114; its two mobile analytics-nav failures reproduce on the pre-change live site.

## Live release results

Released September 29, 2026 (19:05 UTC): the four migrations were applied to production over the session pooler in dependency order, then `f79c661` was pushed and deployed (`dpl_3BT9hnKWVX6KzC5PbfXy1LGzUHxv`, region `pdx1`). The Mac harvester was already running this working tree, so its prune step had been failing on the missing `vessel_daily_presence` table until the migration landed; applying the migrations first closed that.

- **Read-model parity:** production `vessel_latest_positions` matched the old latest-fix selection exactly — 5,173 contacts, 0 mismatches on time/latitude/longitude. The daily-presence backfill wrote 17,668 facts. New tables have RLS on and no `anon`/`authenticated` grants (`pg_class.relacl`). Both trigger functions pin `search_path = public`, clearing the advisor's mutable-search-path warning.
- **Live first load (three runs each, same lab profiles as the audit):**

| Profile | Audit baseline (live) | After release (live) |
|---|---|---|
| Phone LCP | 5.0–5.9s | 4.10–4.12s |
| Phone map-ready | 9.7–10.3s | 5.61–6.14s |
| Desktop LCP | 1.7–2.9s | 0.52–0.84s |
| Desktop map-ready | 2.0–2.1s cached; 6.5s miss | 0.67–1.14s |
| HTML complete | ~7s stream | 0.25–0.28s (static prerender) |

- **Caching:** `/dashboard`, `/fleet`, and `/analytics` are served as static prerenders. Repeat requests to vessels, chokepoints, prices, news, and watch return `x-vercel-cache: HIT` in 0.10–0.28s; watchlist and alerts stay uncached.
- **Browser checks against production:** vessel-loading 5/5, fleet layout 117/117 (tabs, sort, paging, dossiers), dashboard layout 112/116. The four dashboard failures are all on mobile `/analytics` — the bottom nav sits below the fold and the Suez crossing-day chips are 25px tall. Neither the analytics page nor `CrossingsChart` changed in this release (the only shared change is `prefetch={false}` on nav links), so they predate it. A scripted click-through confirmed the Hormuz list fetches only when opened, search selects a vessel, the `?vessel=` deep link restores the full contact panel on a cold load, telemetry posts return 204, and there were no page errors.

### Still open

| Item | State |
|---|---|
| Phone map-ready ≤5s | **Not met on production** (5.6–6.1s). The live map payload is 5,173 real contacts, ~181 KB gzipped (the local fixture's was ~71 KB); on the 1.6 Mbps profile the transfer alone is ~2s. Dropping nulls and rounding coordinates would save only ~13%. Closing the gap needs viewport-scoped or binary delivery. |
| Field percentiles | Telemetry is live and writing; read `scripts/report-performance.mjs` once each group has ≥100 samples. |
| Capacity soak | Not run. There is no staging environment, and a 30-minute ramp against production should be a deliberate decision. CDN HITs now absorb the public read load. |
| Mac sleep/outage drill | Not run; collection stays on the Mac by requirement. |
| Mobile `/analytics` nav + crossing-chip tap targets | Pre-existing; unrelated to this release. |
