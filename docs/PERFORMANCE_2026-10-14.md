# Performance measurements — 2026-10-14

The clearest gap was work after data arrived: 1.5-second chart entrances, repeated reads on screen visits, and map trails and forecast paths rebuilt every frame while invisible at wide zoom. The changes remove that work, defer the vessel dossier until selection, prepare static destinations on hover/focus, and prevent sideways scrolling on phone Analytics.

These measurements were collected locally on `canary`, based on `c77c098`, before committing and pushing the changes. They do not establish deployed performance. No production database migration was performed.

The final browser comparison used production builds, fresh Umbra/WebKit scratch profiles, a 1280×900 viewport, and five runs per arm. Runs alternated baseline/candidate order. Both arms received the same 200 ms pointer-intent lead. Chart timings end when every plotted area is visible and its entrance clip is gone; URL changes and empty chart containers do not count as completion. The intent lead is also included in a separate raw timing to expose work done before clicking.

| Observable result | Baseline | Candidate | Interpretation |
| --- | ---: | ---: | --- |
| First Analytics charts fully visible, median | 2,179 ms | 419 ms | Large improvement from removing entrances and preparing static route code. |
| Revisited Analytics fully visible, median | 1,774 ms | 299 ms | Recent content reuses cached responses and renders immediately. |
| 90-day charts fully visible, median | 1,866 ms | 499 ms | Historical content appears without the entrance delay. |
| Return to recent 30-day range, median | 1,799 ms | 333 ms | Zero repeated content requests within the cache window. |
| Recent Analytics revisit requests | 9 | 0 | Includes shared header pollers and chart content. |
| Repeated Fleet next/previous page requests | 1 per action | 0 after first retrieval | Same 15-row pages, with a bounded cache. |
| Main-thread startup JavaScript, decoded bytes | 1,662,951 | approximately 1,624,300 | About 39 KB less; workers are excluded from this count. |
| Wide-zoom frame construction, median | 5.74 ms | 0.63 ms | 89% less CPU work at zoom 5; see the narrower boundary below. |
| Phone Analytics document width at 390 px | 786 px | 390 px | Sideways page scrolling removed; all quality text retained. |

Browser ranges in the alternating comparison were 1,984–2,211 ms for baseline first Analytics paint and 386–439 ms for the scoped candidate. Static-route intent prefetch was also tested independently: 678 ms median before, 419 ms after, with the same lead and chart settings. Broad prefetching of dynamic canary workspaces showed a regression and was rejected. Those links retain `prefetch={false}`.

Startup wall time is inconclusive. Shell readiness was 145 ms on the original baseline versus 147 ms in the final scoped phase. Map readiness medians were 565 ms versus 636 ms; an earlier candidate comparison was 530 ms. Stage runs changed direction and varied substantially. The smaller startup payload is demonstrated; these measurements establish no consistent startup time improvement. A single live-canary diagnostic took 5.51 s to render vessels, with shell initialization at 2.19 s and the vessel request lasting 3.18 s. Its cached `Server-Timing` reported a 240 ms database span, while another cached HTTP read took 1.20 s overall. Remote network and server behavior still need post-deployment measurement.

General scrolling FPS is also inconclusive. Umbra's invisible WebKit ran near 30 Hz: browser scroll p95 intervals stayed around 34–35 ms, with zero intervals above 50 ms in the final alternating samples. This is not a real-phone FPS or INP result. Native wheel input verified vertical scrolling and the removal of horizontal overflow. The phone document became slightly taller when its complete quality explanation wrapped.

Each change was measured before and after:

| Change | Evidence | Decision |
| --- | --- | --- |
| One map-source update per input change | Original fails the data-before-map regression with two submissions; candidate passes with one. Startup medians were noisy. | Keep the demonstrated work reduction; claim no isolated startup speedup. |
| Public JSON response cache and poller freshness | Recent Analytics visits: 9 requests → 0. Chart containers still took around 250–270 ms before accounting for animation. Expiry, independent cancellation, retry, filter keys, and 64-entry eviction tests pass. | Keep for reduced requests and transfer; local cache-only elapsed-time improvement is inconclusive. |
| Disable chart entrance animations | Five before/after runs: first full paint 2,273 → 725 ms; revisit 1,800 → 333 ms. Series data, controls, tooltips, and legends remain. | Keep. |
| Skip map detail below its visibility threshold | Observed workload: 2,935 vessel records, 1,347 track payloads, 137 matching moving glyphs. Twenty alternating samples per arm, three frames per sample, three warmups. Zoom-5 p50 5.74 → 0.63 ms; p95 7.14 → 1.33 ms. | Keep. Zooms 7.5 and 10 show no material speedup. |
| Load dossier code only after selection | Startup script payload falls by about 39 KB. Native search, selection, desktop dossier, and phone expansion work. | Keep for smaller startup work; time benefit remains inconclusive. |
| Prefetch static routes on intent | Five alternating runs against the prior build: Analytics full paint 678 → 419 ms. Main startup requests are unchanged. | Keep only for Map, Analytics, Fleet, and Manual. |
| Wrap full quality badges on phones | Original and candidate-before-fix both overflow at 786 px. Fixed page is 390 px; native horizontal wheel input leaves `scrollX=0`. | Keep as a scrolling correction. |

The CPU benchmark runs the actual `buildFrame` and `Nowcaster` code in Node, with a common Mercator projection callback. It measures frame construction rather than canvas painting, WebGL, or whole-page FPS. Visible output is compared against the baseline at each tested zoom, normalizing only detail the original renderer already hides. Moving-glyph counts and selected positions are preserved. A Node CPU profile and every raw timing sample are retained.

The local database is a separate `straits_perf_20261014` snapshot on localhost:5433, copied from the local mirror (approximately 270,825 raw positions). It adds synthetic 90-day presence, price, anomaly, and encounter fixtures. Time-based SQL predicates still use wall-clock time. The timed UI comparisons initially had no track-engine output; the CPU comparison uses a captured observed track response. Observed tracks and derived replay histories were then installed into this disposable snapshot for native canvas/dossier verification. The fixture is not a live-feed health test or a production permissions test.

Screen checks covered Map, Analytics, Fleet, Manual, Investigations, Coverage, Parallel Seas, Following, encounter index, and a vessel case. Additional native phone checks covered a locally created immutable story and its embed. `/login` redirects to the dashboard under the current open-demo posture. Following used an empty browser-local list. Full desktop/phone screenshots and geometry checks are retained: one expanded dossier, a painted motion overlay, 15 Fleet rows, a visible pager above the phone navigation, no horizontal page overflow after the badge fix, and no browser console errors in the checked paths.

Validation passed: lint, type checking, 1,021 tests with one skipped file and nine todo tests, the eight affected quality-component tests after the phone correction, and separate canary and production builds. The final smoke journey is tied to the final canary build ID. The Playwright verification scripts were not run; browser checks used Umbra as required by `AGENTS.md`. GitHub CI, CodeQL, real-device testing, and deployed candidate checks were not run.

Raw evidence is local and untracked in `artifacts/performance/2026-10-14/`: phase `*-ui.json` files, `paired-*` and `scoped-*` comparisons, CPU samples/profiles, the database plan, build/check logs, native screenshots, and geometry receipts. Early discarded harness attempts used a hidden scratch tab or incorrect selectors; successful runs use active session tabs and populated-content assertions. No failures or outliers from successful samples were discarded.

Reproduce the browser journey against a running production build:

```bash
BASE_URL=http://localhost:3102 LABEL=candidate RUNS=5 \
  MEASURE_PAINT=1 INCLUDE_CANARY=1 INTENT_MS=200 \
  node scripts/benchmark-ui.mjs
```

For alternating runs, provide `TARGETS` as a JSON array of `{ "label", "base", "root" }` objects. `root` supplies the `.next/BUILD_ID` receipt. Both servers must use the same database, dependencies, and canary flags. Run benchmarks without builds or tests competing for CPU. Main-thread script bytes are decoded sizes from the browser resource entries, not compressed network transfer.

Recreate a detached baseline with `git worktree add --detach /tmp/straits-perf-baseline-c77c098 c77c098` and provide its dependencies before the CPU comparison:

```bash
OBSERVED_DIR=artifacts/performance/2026-10-14 \
  npx tsx scripts/benchmark-motion.ts
```

Without `OBSERVED_DIR`, the CPU command uses a deterministic synthetic stress workload. Its results must be labeled separately. Temporary browser profiles and comparison servers were stopped after verification; the fixture database and evidence were retained for reruns.
