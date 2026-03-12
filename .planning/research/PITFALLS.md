# Pitfalls Research

**Domain:** Maritime tracking / tanker geopolitical intelligence dashboard
**Researched:** 2026-03-11
**Confidence:** HIGH (AIS data behavior, map rendering) / MEDIUM (sanctions integration, news APIs)

---

## Critical Pitfalls

### Pitfall 1: Treating AIS Gaps as "Going Dark" Events

**What goes wrong:**
You build anomaly detection that flags any vessel with an AIS gap as suspicious. Your dashboard constantly fires false "going dark" alerts for vessels in open ocean, in congested ports, or experiencing normal radio interference. Users lose trust in the alert system within days.

**Why it happens:**
AIS was designed for collision avoidance, not intelligence gathering. Gaps in AIS transmission are *normal* — satellite AIS has lower update frequency in open ocean (every few minutes to hours), terrestrial AIS has dead zones, weather causes interference, and port congestion causes signal collision. Developers assume continuous coverage that doesn't exist.

**How to avoid:**
Require multiple corroborating signals before flagging a gap as intentional:
1. Gap duration must exceed expected terrestrial/satellite coverage gap for that sea area
2. Last known position was in a sanctions-sensitive zone or known dark ship corridor
3. Cross-reference with satellite AIS data vs. terrestrial AIS discrepancy
4. Flag as "suspected" not "confirmed dark" — confidence scoring, not binary alerts

Distinguish between gap *types*: coverage gap (last position near shore, then open ocean), signal gap (last position in dense port, known congestion zone), and suspicious gap (normal coverage area, abrupt stop).

**Warning signs:**
- Alert volume is very high shortly after launch
- Alerts firing for vessels in open Pacific or Indian Ocean
- No filtering by sea area coverage quality
- Binary "dark / not dark" logic with no confidence score

**Phase to address:** AIS data pipeline phase (before route anomaly features are built)

---

### Pitfall 2: AIS API Credit Burn from Polling All Vessels

**What goes wrong:**
You design a polling loop that requests positions for every tracked vessel every few minutes. At MarineTraffic API pricing, each position request costs credits. Tracking 200 vessels with 5-minute polling burns credits 288 times per day per vessel — you hit your monthly limit within days and the project becomes financially unviable.

**Why it happens:**
Developers prototype with a small vessel list, confirm it works, then expand scope without recalculating API costs. MarineTraffic and similar providers charge per API call or per vessel-credit, not flat monthly rates for high-frequency tracking. The pricing pages obscure this until you read the fine print carefully.

**How to avoid:**
Use a streaming WebSocket API (aisstream.io is free, provides real-time global AIS stream by bounding box) rather than polling. Instead of requesting positions, *receive* all positions broadcast within your geographic bounding box. This:
- Eliminates per-request credit costs
- Gives genuinely real-time updates (not polling lag)
- Scales to any number of vessels in the box at no extra cost

Reserve REST API calls (expensive) for vessel metadata lookup, historical tracks, and one-time enrichment — not position polling.

**Warning signs:**
- Prototype uses REST API for position updates on a loop
- No credit usage projections done before finalizing architecture
- "I'll figure out pricing later" deferred to after implementation

**Phase to address:** Architecture phase / data pipeline design (before writing any polling code)

---

### Pitfall 3: MMSI Collision and Vessel Identity Confusion

**What goes wrong:**
Your dashboard shows a vessel jumping between two locations 500km apart, or you see the same tanker appearing to be in two places simultaneously. Worse, you flag a legitimate vessel as sanctioned because its MMSI was previously used by a different ship.

**Why it happens:**
MMSI numbers (the 9-digit vessel identifier in AIS) are reused, spoofed, cloned, and misconfigured at scale. Common issues:
- Vessels enter only the first 3 digits (country code) followed by zeros
- Sanctioned operators clone the MMSI of a legitimate vessel
- Ships re-register under new flags and get new MMSIs, breaking vessel history
- GPS jamming in the Middle East (documented: 1,100+ vessels affected in the Gulf, 2025) causes position "jumps" averaging 6,300 km — a single vessel appears to teleport

**How to avoid:**
- Never use MMSI as a primary vessel identity key — use IMO number where available (more stable, assigned once at build)
- Implement sanity checks: flag positions where speed-over-ground implied by two consecutive positions is physically impossible (>50 knots for a laden tanker)
- Store vessel identity as a composite: IMO + name + flag + MMSI, with change-tracking
- Treat MMSI-only vessels (no IMO) with lower confidence scores
- Filter GPS jump artifacts: if consecutive positions imply >30 knots for a vessel type that maxes at 15 knots, discard or flag the anomalous point

**Warning signs:**
- Position history shows vessels "teleporting" between distant locations
- Single MMSI appearing at two simultaneous positions
- Vessel identity matching logic based solely on MMSI

**Phase to address:** Data ingestion / normalization phase (foundational, must be correct before building anything on top)

---

### Pitfall 4: Map Performance Collapse with Live Vessel Updates

**What goes wrong:**
The map works perfectly with 50 vessels in dev. At 500+ vessels with continuous position updates, the browser tab freezes or crashes. Animating vessel icons, drawing route trails, and re-rendering on each position update overwhelms the DOM or Canvas renderer.

**Why it happens:**
Developers reach for Leaflet (familiar, easy) without understanding its SVG/Canvas performance ceiling. Leaflet re-renders markers inefficiently for large datasets. Adding route polylines for 500 vessels multiplies geometry objects. Triggering a full re-render on every WebSocket message (potentially 300 messages/second for a global bounding box) is catastrophic.

**How to avoid:**
- Use deck.gl with Mapbox GL JS (WebGL-based, GPU-accelerated) — handles millions of points without DOM overhead
- Use the ScatterplotLayer or IconLayer in deck.gl for vessel positions — these batch-render thousands of points in a single GPU draw call
- Never create a DOM element per vessel — use canvas/WebGL layers only
- Implement update throttling: coalesce incoming WebSocket position updates into batched state updates at 1-second intervals max, not per-message
- Store only the *latest* position per vessel in the render state — not every update
- For route trails, limit to last N positions (configurable) and cull old points

**Warning signs:**
- Using Leaflet L.marker() per vessel
- Calling map.setData() or setState() on every WebSocket message
- "It works fine in dev" with <50 test vessels

**Phase to address:** Map rendering / frontend architecture phase

---

### Pitfall 5: Sanctions Matching Produces Either Too Many or Zero Useful Flags

**What goes wrong:**
You implement exact-string matching against the OFAC SDN list and get zero matches because vessel names have slight spelling variations, abbreviations, or flag country differences. Or you use fuzzy matching with low threshold and every second vessel triggers a sanctions flag, drowning out real alerts.

**Why it happens:**
The OFAC SDN list uses the vessel name and IMO number as identifiers, but shadow fleet operators deliberately use slightly altered names, flag under obscure registries, and layer ownership through shell companies. Exact matching misses all evasion. Overly aggressive fuzzy matching creates false positives that erode trust.

**How to avoid:**
- Primary match on IMO number (stable, unique) — never rely on vessel name alone
- Secondary match on MMSI cross-referenced against SDN MMSI field where present
- Supplement OFAC SDN with OFAC's Non-SDN Consolidated List and EU sanctions list
- Fuzzy name matching is for *discovery candidates* only, not confirmed flags — require IMO confirmation to escalate to a real alert
- Distinguish flag levels: "IMO match = HIGH confidence sanctioned", "name fuzzy match only = LOW confidence, needs review"
- OFAC publishes a machine-readable XML/CSV — consume this directly rather than scraping the web search tool

**Warning signs:**
- Sanctions matching uses only vessel name string comparison
- No IMO-based matching in the design
- OFAC list loaded once at startup with no refresh schedule

**Phase to address:** Sanctions enrichment phase

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Polling REST API instead of WebSocket stream | Simpler initial code | API credit exhaustion, higher latency, can't scale | Never for position updates; acceptable for metadata enrichment |
| Using Leaflet for all map rendering | Fast to prototype | Freezes at 200+ live vessels with updates | Only for a static screenshot demo |
| Loading full OFAC SDN list into memory on each check | No cache complexity | Repeated file I/O, slow sanctions checks | Acceptable at MVP if checked on demand, not every update |
| Storing raw AIS messages without normalization | Preserve all data | Unusable for queries, storage explosion | Never — normalize on ingest |
| Single bounding box for entire Middle East + all routes | Simple subscription | Massive message volume (10k+ vessels), overwhelms processing | Acceptable only with aggressive client-side filtering |
| Hard-coding vessel filter list | Quick to ship | Manual maintenance burden, list goes stale | Acceptable for MVP if documented as tech debt |
| No vessel position sanity checking | Simpler pipeline | Teleporting vessels, phantom positions corrupt all derived analytics | Never — implement from day one |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| aisstream.io WebSocket | Forgetting to send subscription message within 3 seconds of connection — server closes connection silently | Send subscription immediately in `onopen` handler, before any other logic |
| aisstream.io WebSocket | Incrementally adding bounding boxes by resending partial subscriptions — this *replaces* not *merges* | Always send the full complete list of bounding boxes in every subscription message |
| aisstream.io WebSocket | Subscribing to the full world bounding box (300 msg/sec average) without filtering — overwhelms the app | Subscribe to specific bounding boxes: Strait of Hormuz, Red Sea, Suez corridor, key route waypoints only |
| MarineTraffic REST API | Not understanding that "vessel position" calls cost per-vessel per-call and "extended" responses cost more credits | Read the credit consumption table before building any polling logic |
| OFAC SDN List | Polling the OFAC search web UI (terms of service violation, brittle) | Use the official machine-readable SDN XML file published at sanctionslist.ofac.treas.gov |
| OFAC SDN List | Assuming the list updates infrequently — can change any day | Subscribe to OFAC's email notification service; pull the XML on a daily schedule minimum |
| Oil price APIs (FRED, EIA) | Missing that free tier APIs have daily request limits | Cache fetched prices aggressively — oil prices don't change more than daily for WTI/Brent benchmarks |
| News APIs | Syndicated content causes duplicate articles appearing seconds apart | Implement deduplication by URL canonicalization + title similarity hash; set minimum 10-min TTL per source |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering a Leaflet marker per vessel | Page freeze at ~200 vessels | Switch to deck.gl WebGL layer | At 150-300 vessels with live updates |
| Re-rendering map on every WebSocket message | CPU pegged at 100%, dropped frames | Throttle to max 1 state update/second; batch position updates | At ~50 simultaneous position update messages |
| Storing full AIS position history without TTL | Database storage explosion | Keep rolling 30-day window; archive older data; use time-series partitioning | At ~3 months of storage for 500+ vessels |
| Drawing complete route polylines for all visible vessels | GPU memory exhaustion | Limit route trail to last 20 points per vessel; only draw for selected/hovered vessel by default | At 300+ vessels with full trail rendering |
| Querying vessel positions without spatial index | Map load latency 5-10s | PostGIS with spatial index on position column from day one | At 100k+ stored position records |
| Full OFAC list re-parse on every vessel check | Sanctions check latency >1s | Load and index SDN list into memory on startup, check against in-memory index | Acceptable at <100 vessels, breaks at scale |
| Fetching news headlines on every dashboard refresh | News API rate limit hit within hours | Cache news results with minimum 5-minute TTL; use stale-while-revalidate pattern | At >10 concurrent users refreshing |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing AIS API keys in frontend JavaScript | Keys scraped, used by others, you get billed | All API calls server-side only; keys in environment variables, never in client bundle |
| Simple password protection via frontend JS only | Password trivially bypassed by disabling JS | Server-side auth middleware on all API routes; HTTP Basic Auth or JWT at the API layer |
| No rate limiting on your own backend API | Friends accidentally hammer your backend; bots scrape vessel data | Implement per-IP rate limiting (e.g., express-rate-limit) on all API endpoints |
| Committing API keys to git | Keys exposed in repo history permanently | Use .env files from day zero; add .env to .gitignore before first commit; rotate any key ever committed |
| Treating AIS position data as legally sensitive | None (it's publicly broadcast) — but over-engineering "privacy" features wastes time | AIS is public domain; no special handling needed. Focus security effort on API keys and auth instead |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing all 2,000+ vessels in the Middle East + routes simultaneously | Visual noise, no signal; map is illegible | Default to showing only tanker class vessels (vessel type filter); progressive disclosure for other types |
| Displaying raw AIS timestamps in UTC without context | Users constantly doing time zone math | Show relative time ("updated 3m ago") alongside local/user timezone conversion |
| Map tooltip with raw AIS fields (MMSI, SOG, COG) | Technical jargon alienates non-expert friends | Translate: "Speed: 12 knots", "Heading: NNE", "Last seen: 4 minutes ago" |
| Alert panel that accumulates all anomalies without clearing | Users miss new alerts in noise | Implement alert severity tiers and auto-dismiss low-confidence alerts after 24h |
| Trying to show oil price chart, news feed, sanctions list, and map simultaneously at full fidelity | Dashboard is overwhelming, no clear focus | Provide a "situation" mode (map primary) and "analysis" mode (charts primary); users switch intentionally |
| No indication when data is stale (e.g., AIS stream disconnected) | Users make decisions on old data without knowing it | Prominent "last data update" timestamp with color-coded staleness indicator; show "STREAM DISCONNECTED" banner |
| Vessel trails that obscure the map when zoomed out | Route spaghetti covers geographic context | Only draw trails when zoomed in past a threshold; show dots/icons only at zoom-out levels |

---

## "Looks Done But Isn't" Checklist

- [ ] **AIS stream connection:** Does the app gracefully reconnect after WebSocket disconnection? WebSocket drops are not exceptions — they are routine. Verify automatic reconnect with exponential backoff.
- [ ] **Vessel position freshness:** Is there a clear "data as of X minutes ago" indicator per vessel? A vessel's last position may be 4 hours old if it was in open ocean. Verify last-update timestamp is displayed, not just position.
- [ ] **Sanctions list freshness:** Is the OFAC/EU list refreshed on a schedule? A list loaded at startup becomes stale within days of deployment. Verify scheduled refresh is implemented.
- [ ] **Going dark detection:** Does the anomaly system filter known coverage gap zones from alerts? Verify that a vessel going into open ocean does not trigger a dark vessel alert.
- [ ] **Bounding box coverage:** Does your AIS subscription cover the full intended geographic scope? Strait of Hormuz, Bab el-Mandeb, Suez Canal northern approaches, and Gulf of Oman are all distinct bounding boxes. Verify each is explicitly included.
- [ ] **GPS jamming handling:** Does the app detect and handle position jump artifacts? In the current Iran conflict context, GPS jamming is widespread. Verify impossible speed-over-ground triggers a position discard, not a route anomaly alert.
- [ ] **Password protection:** Is the auth enforced server-side? Load the dashboard URL directly in an incognito browser without logging in. Verify that the API endpoints return 401, not just the frontend route.
- [ ] **Map render at scale:** Test with realistic vessel count (filter to tanker class, Middle East bounding box = 400-800 vessels). Verify browser performance is acceptable before claiming map feature is "done."

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| API credit exhaustion from polling | MEDIUM | Immediately switch to WebSocket stream; audit all REST calls and eliminate position polling; implement credit monitoring alert |
| Wrong database schema for time-series positions | HIGH | Schema migration with data transformation; may require full re-ingestion; very expensive if caught after months of data accumulation — fix in design phase |
| Leaflet performance collapse at scale | MEDIUM | Swap map library to deck.gl + Mapbox GL; significant frontend rewrite but contained to the map component |
| Sanctions matching producing zero useful results | LOW | Augment matching logic to include IMO-primary matching; doesn't require data reingestion |
| AIS stream subscription covering wrong bounding boxes | LOW | Update subscription message and reconnect; immediately live |
| No position sanity checking (teleporting vessels) | HIGH | Requires retroactive data cleanup; all historical analytics derived from corrupt positions are invalid; must re-ingest from API |
| API keys committed to git | HIGH | Rotate all exposed keys immediately; rewrite git history or accept the exposure; audit for any unauthorized usage |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| AIS gap → false "going dark" alerts | AIS data pipeline + anomaly detection design | Test: vessel in open Pacific triggers zero dark alert |
| API credit burn from position polling | Architecture / data source selection (Phase 1) | Verify WebSocket stream used for positions, REST only for metadata |
| MMSI collision / vessel identity | Data normalization layer (Phase 1-2) | Test: inject a known GPS-jamming artifact position; verify it's discarded not displayed |
| Map performance collapse | Frontend / map rendering phase | Benchmark: 500 vessels, 1-second update cycle; verify <100ms render time |
| Sanctions matching failures | Enrichment / sanctions phase | Test: known OFAC-listed vessel by IMO; verify it flags correctly |
| Stale OFAC list | Sanctions phase | Verify scheduled refresh job exists and runs; check list age in dashboard debug view |
| Missing auth on API routes | Auth phase | Verify all /api/* routes return 401 without valid session from incognito browser |
| Stale data shown without indicator | UI phase | Verify data freshness timestamp visible; disconnect stream and confirm staleness indicator activates |
| No WebSocket reconnection | Data pipeline / infrastructure phase | Kill the stream process; verify dashboard reconnects automatically within 30 seconds |

---

## Sources

- [AIS Tracking Challenges — Global Fishing Watch](https://globalfishingwatch.org/data/ais-tracking-vessels/)
- [Understanding AIS Data — Searoutes Developer Docs](https://developer.searoutes.com/docs/vessel-tracking-and-ais-data)
- [AIS Blind Spots: Illicit Trade or Glitch? — Lloyd's List Intelligence](https://www.lloydslistintelligence.com/thought-leadership/blogs/ais-blind-spots-illicit-trade-or-technical-glitch)
- [Going Dark Is So 2019 — Windward AI](https://windward.ai/blog/going-dark-is-so-2019/) (covers modern evasion tactics beyond simple transponder shutoff)
- [GPS Jamming Disrupts 1,100+ Ships in the Middle East — Windward AI](https://windward.ai/blog/gps-jamming-disrupts-1100-ships-in-the-middle-east-gulf/)
- [Kpler Marine: Real-Time AIS Data for Dark Fleet Movements — SatNews (2026-03-02)](https://satnews.com/2026/03/02/kpler-marine-leverages-real-time-ais-data-to-map-dark-fleet-movements-amid-u-s-iran-conflict/)
- [aisstream.io WebSocket API Documentation](https://aisstream.io/documentation)
- [Top 10 Maritime API Questions — SeaVantage](https://www.seavantage.com/blog/top-10-most-common-maritime-api-question)
- [OFAC Sanctions List Service — Treasury.gov](https://ofac.treasury.gov/sanctions-list-service)
- [OFAC Compliance Communiqué — October 2024](https://ofac.treasury.gov/media/933556/download?inline=)
- [Large Scale Geospatial Visualization with deck.gl — DEV Community](https://dev.to/localeai/large-scale-geospatial-visualization-with-deck-gl-mapbox-gl-and-vue-js-54im)
- [Working with Large GeoJSON Sources in Mapbox GL JS — Mapbox Docs](https://docs.mapbox.com/help/troubleshooting/working-with-large-geojson-data/)
- [Iranian Shadow Fleet — Wikipedia](https://en.wikipedia.org/wiki/Iranian_shadow_fleet)
- [The Problem of Ships Going Dark — Lockton](https://global.lockton.com/gb/en/news-insights/the-problem-of-ships-going-dark)

---
*Pitfalls research for: maritime tracking / tanker geopolitical intelligence dashboard*
*Researched: 2026-03-11*
