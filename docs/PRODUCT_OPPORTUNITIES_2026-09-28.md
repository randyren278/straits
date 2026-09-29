# Where Straits can stand out

September 28, 2026. Complements the [performance audit](PERFORMANCE_AUDIT_2026-09-28.md) and preserves the existing [Eureka roadmap](../eureka.md). The ideas below are proposals, not features claimed to exist or validated customer demand.

## The direction

**Make a change in the sea understandable in one minute, then let someone inspect the evidence.**

The black-and-amber identity is already distinctive. The next improvement is editorial hierarchy: one compelling change, a map view that makes it legible, and a clear route into its history. Adding ten simultaneously visible panels would worsen both first load and comprehension.

The live desktop view currently opens with thousands of positions and a long automatically selected proximity group. That feels active, but the visitor has to discover what matters. A stronger opening would present a short, dated regional situation card, three meaningful changes, and a clear “replay the evidence” action. Keep the map immediately usable beneath it.

## What has already shipped

The current source includes Current Watch, vessel dossiers, evidence details, track history, associates, alert/watchlist workflows, shareable map investigations, export, regional observation quality, Suez crossing classification, and durable daily Suez aggregates. The September 14 roadmap predates some of these additions. Proposals should extend them rather than reintroduce them as new features.

Still open in the inspected source: persistent editorial Case Files; durable voyage tracks and crossing history beyond Suez; event lifecycle timestamps that distinguish a first observation from a detector reevaluation; a public narrative combining multiple evidence types. The subsequent performance implementation added compact daily observed-contact facts for regional charts, but they are not voyage tracks or completed transits. Anomaly upserts still replace `detected_at`, so meaningful “new since your last visit” needs that underlying distinction.

## Three experiences to build first

### 1. Case Files: the feature someone sends to a friend

Open a short question such as “Why did waiting time increase here?” It begins with an annotated map and three timestamped observations. Scrubbing a timeline moves the map, relevant vessels, and evidence together. The conclusion states what was observed, plausible explanations, and missing evidence.

Build one carefully authored case before automating case generation. Give it a stable public URL, cover image, frozen supporting observations, sources, correction history, and a concise share preview. Existing dossier and investigation-link components provide much of the navigation foundation; the missing piece is a persistent argument with retained evidence.

**Why it stands out:** the dashboard becomes a place to learn something specific, rather than a screen full of dots. Sharing a case can bring someone directly to a meaningful view.

**Data requirement:** preserve a bounded evidence bundle beyond raw-position pruning. Separate `observed_at`, `first_detected_at`, `last_evaluated_at`, and `material_change_at`. New evaluation is not automatically a new event.

**Performance rule:** render the case text and a lightweight map preview first; load replay tracks when replay opens. Success is a reader reaching supporting evidence and understanding the claim, not merely clicking a colorful card.

### 2. Chokepoint Pulse: moving, waiting, and missing

Extend the existing Suez work into a consistent regional instrument. Show completed crossings in each direction, observed waiting vessels, incomplete tracks, and coverage alongside each other. Add a 24-hour timeline and a comparison against comparable historical periods once enough observations exist.

Start with Suez because it already has gates and durable counts. Add Hormuz only after defining and validating direction/gate semantics. Keep “observed inside the zone” separate from “completed passage.” Display queue duration as a lower bound when a vessel was already present when observation began; intermittent sampling cannot produce exact arrival times.

**Why it stands out:** someone can distinguish a busy anchorage from a functioning trade lane and a real slowdown from a collection gap.

**Data requirement:** persistent crossings, entry/exit evidence, sampling quality, and historical aggregates. Seven days of raw data cannot support an honest seasonal baseline.

**Performance rule:** small precomputed series and counts; detailed tracks only on demand. Compare external aggregate context with IMF PortWatch where coverage and definitions align. PortWatch is a public platform for monitoring and simulating maritime trade disruptions; an external series should be labeled with its own methodology and update time. [IMF source](https://www.imf.org/en/news/articles/2023/11/13/pr23390-imf-university-oxford-launch-portwatch-platform-monitor-simulate-trade-disruptions)

### 3. Situation Replay: show context around the change

Let a visitor select a region and a time window, then see vessel movement alongside dated maritime incident reports and weather/ocean conditions. Clicking an advisory reveals its issuing organization, exact publication time, affected area, subsequent revisions, and link to the original.

Begin with manually curated UKMTO advisories and one weather variable, such as wave height. Do not promise a supported UKMTO API without finding one. Their public incident/advisory pages are a source for attributed links; automated ingestion still needs a reliable format and appropriate reuse terms. [UKMTO](https://www.ukmto.org/recent-incidents)

Copernicus Marine documents programmatic data access and WMTS map tiles, making ocean-condition overlays technically plausible. Choose a product, inspect its spatial/temporal resolution, access requirements, license, and update delay before integrating. [Copernicus access documentation](https://help.marine.copernicus.eu/en/articles/4794731-programmatic-access-services-to-copernicus-marine-data)

**Why it stands out:** the map can help a visitor investigate *why* a pattern changed. Temporal proximity between weather, a report, and a diversion remains context, not proof of causation.

**Performance rule:** request only the selected layer/time window. Default the dashboard to the current vessel snapshot, with replay as an intentional action.

## More things worth tracking

| Idea | What the user sees | Inputs / first experiment | Limits to make visible | Priority |
|---|---|---|---|---|
| Port and anchorage queues | “Observed waiting ≥6h; queue larger than usual” with distribution, not just a count | Geofences, successive fixes, speed/status; pilot one anchorage | Observation starts after true arrival; coverage gaps; stopped does not always mean queued | High |
| Corridor diversion share | Share of observed voyages taking an alternate corridor and added distance | Durable tracks, voyage segmentation, route definitions; begin with confirmed route sequences | Partial tracks and sampling bias; additional time needs speed assumptions | High after history |
| Vessel identity timeline | Name, flag, MMSI, owner/operator changes with dated sources | Snapshot existing metadata on change; add ownership only from licensed, attributable sources | A change is an observation, not evidence of wrongdoing; identity resolution uncertainty | Medium |
| Interference episodes | Several implausible jumps grouped into one regional episode | Existing teleport signals, shared time/area, coverage evidence | AIS alone cannot reliably attribute intent or identify the interference source | Medium |
| Encounter network over time | Which vessels repeatedly meet, where, and with what evidence quality | Existing rendezvous ledger and associates; episode deduplication | Proximity is not confirmed cargo transfer; unreliable positions must affect confidence | Medium |
| Vessel class exposure | Where verified tanker/LNG/container classes concentrate near a disruption | Validated vessel class metadata plus geographic exposure | AIS class is broad; missing type is unknown; do not infer barrels or cargo ownership from dots | Medium |
| Regional market context | Dated oil-price movement beside crossing/queue changes | Existing prices, daily aggregates, source timestamps | Daily data and correlation do not establish causation or a trading signal | Medium |
| Maritime incident archive | Searchable, linked official advisories with superseded versions preserved | Manually ingest a small set before automating | Advisory time differs from event time; reports can be revised | Medium |
| Environmental corroboration | Selected case view with ocean conditions or dated satellite imagery | One imagery/condition source and a single historical case | Clouds, revisit time, detection uncertainty, licensing | Later |
| Scenario explorer | Adjustable closure duration/speed assumptions and estimated extra distance/time | Explicit route geometry and transparent arithmetic | Label as a hypothetical model; avoid fabricated real cargo or cost precision | Later |

Global Fishing Watch's Events API offers port visits, loitering, AIS gaps, and specified encounter categories. It could corroborate historical cases, subject to token access, licensing, matching, coverage, and latency checks. Its published encounter categories do not establish universal tanker-to-tanker STS coverage; use it for what the dataset actually supports. [Events API](https://globalfishingwatch.org/our-apis/documentation/docs/v3/events)

## Make the interface feel alive without making it heavier

1. **One “Now” strip:** a dated regional sentence, observation quality, and the most consequential material change. Avoid anonymous alert-count inflation.
2. **A restrained replay control:** time ticks, a clear LIVE/REPLAY state, and selected vessel trails. Never let a historical view appear live.
3. **Age as a visual dimension:** keep identity/risk encoding, but make older fixes visibly quieter. Existing freshness fading is a foundation; expose a simple age control and its effect on counts.
4. **A purposeful first camera:** preserve shared links and returning-user intent. Otherwise use a cached regional overview or featured case. Do not wait on fresh SQL to choose a camera.
5. **Editorial map annotations:** short labels explaining a queue, crossing, or documented incident, shown only at the relevant scale. A bounded story overlay is more legible than every possible data layer.
6. **Evidence cards worth sharing:** a static image, date range, one claim, one uncertainty, and a permalink. Rendered server-side or during publication so sharing does not require a fully booted WebGL app.
7. **A return visit that means something:** show changes since the last *material* event, group detector repetitions, and provide one-click replay.
8. **A calm loading experience:** useful regional context and controls first, lightweight skeletons with reserved geometry, then map detail. A dramatic acquisition animation must not add artificial delay.

Treat these as extensions of the current terminal identity. Use subtle motion to indicate new evidence, not constant pulsing. Respect reduced motion, preserve keyboard use, and keep optional imagery, charts, and historical tracks out of the first-load budget.

## Sequence and proof

| Release | Deliverable | Evidence that it is useful |
|---|---|---|
| Fast Straits | Performance stages 1–2 and RUM | Faster real-user map readiness, fewer startup requests, lower abandon-before-ready rate |
| One excellent investigation | One Case File with retained evidence and a stable share URL | Readers open the evidence and can correctly explain the finding and its uncertainty |
| A reason to return | Suez Pulse plus material-change digest | Returning readers inspect genuinely changed observations; crossing history survives pruning |
| Context with restraint | One official-advisory layer and one ocean-condition layer | Users can relate context to a case without confusing correlation with proof |
| A broader observatory | Validated gates for another corridor, port queues, identity history | Coverage and false-positive review support expanding the claims |

Defer a general AI chat sidebar until cases and evidence retrieval are dependable. A useful later assistant would answer bounded questions with exact observation windows and source links, and explain when data is insufficient. It should not invent reasons for vessel behavior.

Before commercializing data-derived features, verify source permissions against the intended use. OpenSanctions distinguishes API usage, internal use, and redistribution licenses; its downloadable noncommercial availability is not blanket permission to resell an enriched service. [Licensing](https://www.opensanctions.org/licensing/)

The strongest combined bet is **fast map + one shareable Case File + trustworthy Chokepoint Pulse**. It uses the system's existing strengths, gives visitors a story to follow, and makes the infrastructure work serve a clear product outcome.
