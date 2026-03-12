# Feature Research

**Domain:** Oil tanker tracking / maritime geopolitical intelligence dashboard
**Researched:** 2026-03-11
**Confidence:** MEDIUM-HIGH (professional platforms analyzed; project is personal/custom so some competitive context is directional)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any ship-tracking or maritime intelligence product must have. Missing these makes the product feel broken or incomplete to anyone familiar with tools like MarineTraffic, VesselFinder, or Kpler.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Interactive map with vessel positions | Core mental model of maritime tracking — dots on a map | MEDIUM | Leaflet or Mapbox GL; needs tile layer + AIS position overlay |
| Real-time vessel position updates | "Tracking" implies current data, not stale positions | MEDIUM | Poll AIS API every 2-5 min; show last-updated timestamp prominently |
| Vessel identity panel (click-to-inspect) | Every tracking platform shows name, flag, IMO, speed, heading on click | LOW | Render from AIS vessel particulars data |
| Vessel type filtering (tanker focus) | Users need to cut noise — oil tankers only, not cargo or fishing vessels | LOW | Filter by AIS vessel type codes (80-89 = tanker) |
| Last-updated / data freshness indicator | Users need to know if data is stale — critical for trust in near real-time context | LOW | Timestamp per vessel or global refresh indicator |
| Basic text search for a vessel by name/IMO | Every maritime tool offers name/identifier search | LOW | Frontend filter over cached vessel set |
| Vessel track history (recent path) | Understanding where a ship came from is as important as where it is now | MEDIUM | Store and render last N position pings per vessel as polyline |
| Mobile-responsive layout | Small group sharing implies mixed devices; web app must be usable on phone | MEDIUM | Responsive CSS; map may need simplified panel layout on mobile |
| Simple auth / password protection | Project spec calls for friends-only access; bare web access is not acceptable | LOW | Single shared password or simple invite system; no full user management needed |

### Differentiators (Competitive Advantage)

Features that go beyond what general ship-tracking platforms offer — specifically tuned for geopolitical intelligence and the Iran/Middle East context.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sanctions flag overlay | Immediately surface vessels linked to OFAC/EU sanctioned entities (Iran, Russia) — the core intelligence value | MEDIUM | Cross-reference OFAC + EU lists (public downloads); match by IMO/MMSI; show flag on map |
| AIS gap / "going dark" detection | Ships that disable AIS are the most suspicious behavior — core to Iran sanctions evasion | HIGH | Requires tracking expected position vs. last seen; time-gap threshold alerting |
| Route anomaly detection (loitering, unusual path) | Loitering at sea often signals STS transfer; unusual routing avoids inspections | HIGH | Requires baseline route models or simple speed/course change detection |
| Oil price overlay / correlation panel | Pairs vessel flow data with WTI/Brent prices to show supply disruption in context | MEDIUM | Free oil price APIs (EIA, Alpha Vantage, Tiingo); chart alongside tanker volume metrics |
| Geopolitical news feed integration | "Why is this happening?" — contextualizes vessel movements with relevant headlines | MEDIUM | RSS or news API (NewsAPI.org, GDELT) filtered for Middle East + oil keywords |
| Key chokepoint monitoring widgets | Hormuz, Bab el-Mandeb, Suez — dedicated counters/widgets for transit volume at each | MEDIUM | Geofence the straits; count vessels crossing; trend over time |
| Historical analytics view (trends, charts) | Distinguish from real-time tools; show how oil flow changed before/after events | HIGH | Requires historical position storage; time-series queries; charting library |
| Dark fleet / shadow fleet identification | Flag vessels with known dark fleet indicators: flag-hopped, recently IMO-reused, opacity in ownership | HIGH | Requires curated lists (Windward, OFAC dark fleet advisories); manual curation + automated matching |
| Ship-to-ship transfer detection (proximity) | Two tankers anchored close together in open water = likely STS transfer | HIGH | Spatial proximity query over position data; tuned distance/time thresholds |
| Vessel ownership graph | Beneficial ownership chains reveal sanctioned actors behind shell companies | HIGH | Requires ownership data (MarineTraffic API, Equasis); graph visualization (D3 or similar) |
| Custom alert / watchlist | User-defined fleet or vessel watch; notify when vessel enters/exits area or goes dark | MEDIUM | Watchlist stored per session; email/browser push on trigger |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Satellite imagery integration | "See the actual ships" — more evidence for sanctions evasion | Requires SAR/EO satellite data feeds (Maxar, Planet) — enterprise cost, ML processing overhead, months of complexity. Explicitly out of scope for v1. | Trust AIS + behavioral signals for v1; note satellite as v2+ if budget allows |
| Real-time cargo quantity / oil volume estimates | Know exactly how much oil is moving | AIS does not carry cargo data; inference requires proprietary methodologies (Kpler-style). High effort, low reliability for personal project. | Use vessel count as a proxy; link to EIA flow estimates |
| Predictive ETA / route forecasting | "When will this tanker arrive at X?" | Requires historical route modeling per vessel class, weather integration, port congestion data — significant ML/analytics work | Show current destination from AIS and last known heading |
| Global coverage (all 300K+ vessels) | Comprehensive data | Storage, API cost, and rendering performance collapse at global scale. Not the use case. | Middle East + major routes only; explicit geographic bounding box |
| Full user management (accounts, roles, admin) | Seems like a proper app should have this | 3-5x auth complexity for a small-group sharing use case. bcrypt, sessions, email verification — all overhead for ~5 friends. | Single shared password or invite link; revisit if user base grows |
| Automated trading signals | Turn intelligence into action | Regulatory risk; far outside stated scope (awareness, not algo trading). Could create false confidence in incomplete data. | Display is enough; interpretation is up to the user |
| Mobile native app | Better UX on phones | Native iOS/Android adds a separate development track and app store overhead for a personal project | Responsive web is sufficient; PWA if offline capability needed later |
| AIS raw data export / bulk download | Power user data access | API costs scale with data volume; personal project budget doesn't support high-frequency bulk pulls | Provide CSV export of watchlist history only; not global bulk export |

---

## Feature Dependencies

```
[Auth / Password Protection]
    └──required before──> [Any user-facing feature]

[AIS Data Ingestion + Storage]
    └──required before──> [Interactive Map with Positions]
    └──required before──> [Vessel Track History]
    └──required before──> [AIS Gap Detection]
    └──required before──> [Chokepoint Monitoring Widgets]
    └──required before──> [Historical Analytics View]

[Vessel Identity Data (IMO, MMSI, Flag)]
    └──required before──> [Sanctions Flag Overlay]
    └──required before──> [Dark Fleet Identification]

[Vessel Position Time-Series (stored)]
    └──required before──> [Route Anomaly Detection]
    └──required before──> [STS Transfer Detection]
    └──required before──> [Historical Analytics View]

[Sanctions Flag Overlay]
    └──enhances──> [Dark Fleet Identification]

[Oil Price API Integration]
    └──required before──> [Oil Price Overlay / Correlation Panel]

[News API Integration]
    └──required before──> [Geopolitical News Feed]

[Chokepoint Geofences]
    └──required before──> [Chokepoint Monitoring Widgets]
    └──enhances──> [Route Anomaly Detection]
```

### Dependency Notes

- **AIS Data Ingestion requires early commitment**: Everything downstream depends on getting position data flowing and stored. This is the first thing to build.
- **Vessel track history requires storage**: The free-tier AIS APIs (AISHub) provide current positions only; historical tracks need local database accumulation from the start. Starting without storage means you lose that history and can't go back.
- **Sanctions overlay is relatively independent**: Once you have IMO/MMSI data from AIS, you can cross-reference OFAC lists without complex infrastructure. Good early win.
- **AIS gap detection conflicts with API polling approach**: If you poll every 5 min, a 10-min gap is normal. Gap detection requires understanding expected transmission frequency; calibrate thresholds carefully.
- **Dark fleet identification enhances sanctions overlay**: Not required, but significantly more powerful when combined with ownership data.

---

## MVP Definition

### Launch With (v1)

Minimum to make this useful for the stated purpose — watching Iran conflict oil flow disruption.

- [ ] Auth (password protection) — required before anything else is shareable
- [ ] AIS data ingestion for Middle East + major route bounding box — everything depends on this
- [ ] Interactive map with live tanker positions — the core visual
- [ ] Vessel identity panel on click (name, flag, speed, destination, IMO) — basic context
- [ ] Vessel track history (last 24-48 hrs stored locally) — "where did it come from?"
- [ ] Sanctions flag overlay (OFAC + EU lists) — the primary intelligence layer; differentiates from MarineTraffic free tier
- [ ] Oil price panel (WTI/Brent current + 30-day chart) — context for why movements matter
- [ ] Geopolitical news feed (filtered Middle East + oil keywords) — "what is happening?" alongside the map
- [ ] Chokepoint indicators (Hormuz, Bab el-Mandeb, Suez vessel counts) — quick situational awareness widgets

### Add After Validation (v1.x)

Add once core is working and the group is actively using it.

- [ ] AIS gap / going-dark detection — trigger: people ask "why did this vessel disappear?"
- [ ] Route anomaly / loitering detection — trigger: a notable STS event happens and the map doesn't flag it
- [ ] Historical analytics view (charts, trend lines) — trigger: someone wants to see the trend over time, not just now
- [ ] Custom vessel watchlist + alerts — trigger: users want to follow specific ships

### Future Consideration (v2+)

Defer until there's a clear need and budget.

- [ ] Ship-to-ship transfer detection — requires dense historical position data and spatial query tuning; complex
- [ ] Dark fleet beneficial ownership graph — requires ownership data source (Equasis or paid API); complex
- [ ] Vessel voyage prediction / ETA — requires route modeling; significant ML work
- [ ] Satellite imagery integration — enterprise cost; ruled out for personal project scope

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| AIS data ingestion + storage | HIGH | MEDIUM | P1 |
| Interactive map with live positions | HIGH | MEDIUM | P1 |
| Vessel identity panel | HIGH | LOW | P1 |
| Auth / password protection | HIGH | LOW | P1 |
| Vessel track history | HIGH | MEDIUM | P1 |
| Sanctions flag overlay | HIGH | MEDIUM | P1 |
| Oil price panel | HIGH | LOW | P1 |
| News feed integration | MEDIUM | LOW | P1 |
| Chokepoint monitoring widgets | HIGH | MEDIUM | P1 |
| AIS gap detection | HIGH | HIGH | P2 |
| Route anomaly detection | HIGH | HIGH | P2 |
| Historical analytics view | MEDIUM | HIGH | P2 |
| Custom watchlist + alerts | MEDIUM | MEDIUM | P2 |
| STS transfer detection | MEDIUM | HIGH | P3 |
| Ownership graph | LOW | HIGH | P3 |
| Satellite imagery | LOW | VERY HIGH | Out of scope |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | MarineTraffic (free) | Kpler (enterprise) | Our Approach |
|---------|----------------------|--------------------|--------------|
| Live vessel positions | Yes | Yes | Yes — AIS API integration |
| Historical tracks | 24 hrs free, 2 yrs paid | Full history | Store locally from day 1; grows over time |
| Vessel identity | Basic (name, flag, speed) | Full + cargo | AIS particulars; add ownership data in v2 |
| Sanctions flags | No | Yes (compliance product) | Yes — OFAC + EU list cross-reference, built in |
| Geopolitical context | No | Analyst reports (not live) | Yes — news feed alongside map |
| Oil price overlay | No | Yes (Kpler commodity data) | Yes — free oil price API |
| AIS gap detection | No (no alerts on free) | Yes | v1.x feature |
| Route anomaly | No | Yes (behavioral analytics) | v1.x feature |
| STS detection | No | Yes (proprietary) | v2+ |
| Custom areas/alerts | Paid only ($19-129/mo) | Yes | v1.x |
| Historical analytics | Paid only | Yes | v1.x, stored in local DB |
| Focus on Iran/ME | No (global generic) | No (global generic) | Yes — our key differentiator: tuned scope |

**Key insight:** No general-purpose tool combines live AIS + sanctions intelligence + oil price context + geopolitical news in a single focused Middle East dashboard. The niche is real.

---

## Sources

- [MarineTraffic](https://www.marinetraffic.com/) — feature set observed via documentation and comparison articles
- [VesselFinder](https://www.vesselfinder.com/) — feature and pricing comparison
- [MarineTraffic vs VesselFinder comparison](https://maritimepage.com/marinetraffic-vs-vesselfinder/) — MEDIUM confidence, independent comparison
- [Kpler maritime intelligence](https://www.kpler.com/product/maritime) — enterprise feature reference
- [Windward maritime intelligence platform](https://windward.ai/) — dark fleet and anomaly detection capabilities
- [Windward: What is the Dark Fleet](https://windward.ai/blog/what-is-the-dark-fleet/) — dark fleet methodology
- [Windward Q4 2025 Geopolitical Report](https://windward.ai/knowledge-base/top-6-geopolitical-disruptions-in-q4-2025/) — sanctions volume and dark fleet scale
- [Kpler: AIS spoofing sanctions](https://www.kpler.com/blog/ais-spoofing-fast-track-to-sanctions) — AIS manipulation and detection
- [Pole Star Global: Dark Fleet](https://www.polestarglobal.com/resources/knowledge-hub/dark-fleet/) — detection methodology
- [AISHub](https://www.aishub.net/) — free AIS data API
- [Bellingcat Maritime OSINT Toolkit](https://bellingcat.gitbook.io/toolkit/more/all-tools/marinetraffic) — OSINT investigative methodology
- [EIA: Strait of Hormuz](https://www.eia.gov/todayinenergy/detail.php?id=65504) — chokepoint data and significance
- [Kpler: Strait of Hormuz tracking](https://www.kpler.com/blog/strait-of-hormuz-watch-amid-iran-conflict-risk-tracking-crude-flows-interference-and-diversions-in-kpler) — February 2026 chokepoint monitoring

---

*Feature research for: Oil tanker geopolitical intelligence dashboard (Middle East focus)*
*Researched: 2026-03-11*
