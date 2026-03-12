# Phase 2: Intelligence Layers - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Enrich the live map with contextual intelligence: sanctions flags on vessels, oil price panel, geopolitical news feed, vessel search, and chokepoint monitoring widgets. This phase adds the "why it matters" layer on top of Phase 1's "what's happening" foundation. Users get full situational awareness without leaving the dashboard.

</domain>

<decisions>
## Implementation Decisions

### Sanctions Data Source
- **OFAC SDN List:** U.S. Treasury publishes XML/CSV at https://sanctionslist.ofac.treas.gov/ — free, updated regularly
- **EU Consolidated List:** Available at https://data.europa.eu/data/datasets — free, includes vessels
- **Matching strategy:** Match by IMO number (primary), MMSI as fallback, vessel name as weak signal
- **Storage:** `vessel_sanctions` table — imo, sanctioning_authority (OFAC/EU), list_date, reason, confidence
- **Update frequency:** Daily cron job to fetch and diff sanctions lists
- **Display:** Red badge/icon on sanctioned vessel markers, details in vessel panel

### Oil Price Data Source
- **Primary:** Alpha Vantage API — free tier 25 requests/day, includes WTI (CL) and Brent (BZ)
- **Fallback:** Yahoo Finance API or scraping if Alpha Vantage limits hit
- **Data points:** Current price, daily change (%), 30-day historical for sparkline chart
- **Update frequency:** Every 15 minutes during market hours, cache aggressively
- **Storage:** `oil_prices` table — symbol (WTI/BRENT), price, timestamp
- **Display:** Floating panel showing both prices with mini chart, color-coded change indicator

### News Feed Integration
- **Source:** NewsAPI.org or GDELT for geopolitical headlines
- **Keywords filter:** "oil", "tanker", "Iran", "Strait of Hormuz", "OPEC", "sanctions", "Red Sea", "Houthi", "Saudi Arabia", "UAE", "pipeline"
- **Region filter:** Middle East, Persian Gulf, shipping news
- **Update frequency:** Every 5 minutes
- **Storage:** `news_items` table — title, source, url, published_at, relevance_score
- **Display:** Scrollable list panel, max 10-15 headlines, click to open source
- **Retention:** Keep last 7 days, auto-purge older

### Vessel Search
- **Search fields:** Vessel name (partial match), IMO number (exact), MMSI (exact)
- **UI:** Search input in header, autocomplete dropdown showing matches
- **Behavior:** On select, map flies to vessel position and opens vessel panel
- **Implementation:** API endpoint `/api/vessels/search?q=` querying vessels table with ILIKE

### Chokepoint Monitoring
- **Chokepoints:** Strait of Hormuz, Bab el-Mandeb, Suez Canal
- **Bounding boxes:** Predefined polygon coordinates for each chokepoint
- **Metrics:** Current vessel count (tankers vs all), 24h average, trend indicator
- **Update frequency:** Real-time from position data (count positions within polygon)
- **Display:** Row of compact widgets below header or as floating overlay
- **Click behavior:** Clicking widget zooms map to that chokepoint

### UI Layout Extensions
- **Oil price panel:** Top-right corner, compact horizontal layout, always visible
- **News panel:** Collapsible right sidebar, below vessel panel when vessel selected
- **Chokepoint widgets:** Horizontal bar below header, 3 compact cards
- **Sanctions badge:** Small red dot on vessel marker, "SANCTIONED" label in panel
- **Search:** Integrated into header, replaces or extends existing controls

### Carrying Forward from Phase 1
- Dark theme (#1a1a2e background)
- Bloomberg-terminal information density
- Vessel panel on right side (320px)
- Mobile: bottom sheet pattern
- Data freshness indicator pattern (reuse for stale prices/news)

### Claude's Discretion
- Exact sparkline chart library (recharts, visx, or custom SVG)
- News item card design details
- Chokepoint widget exact styling
- Search autocomplete behavior details
- Animation timing for panel transitions

</decisions>

<specifics>
## Specific Ideas

- Sanctions flags should be immediately visible — users care about Iran-linked vessels
- Oil prices provide context for why tanker movements matter
- News headlines should be scannable, not require reading full articles
- Chokepoint widgets give at-a-glance traffic status for key waterways
- Search is for "where is vessel X?" — quick lookup, not complex queries

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/panels/VesselPanel.tsx` — extend with sanctions section
- `src/components/ui/Header.tsx` — add search input and chokepoint widgets
- `src/components/ui/DataFreshness.tsx` — pattern for stale data indicators
- `src/stores/vessel.ts` — Zustand store pattern for new UI state
- `src/lib/db/vessels.ts` — extend with sanctions join query
- `src/app/api/vessels/route.ts` — extend or add search endpoint

### Established Patterns
- API routes in `src/app/api/` with pool.query
- Zustand stores for UI state
- Dark theme with amber accents
- Side panel for details, floating elements for always-visible data
- TDD with Vitest for utility functions

### Integration Points
- Vessel panel: Add sanctions section when vessel is sanctioned
- Vessel markers: Add sanctions badge (red dot) to GeoJSON properties
- Header: Add search input and chokepoint widget row
- Dashboard layout: Add oil price panel and news sidebar

</code_context>

<deferred>
## Deferred Ideas

- AIS gap detection (going dark) — Phase 3
- Route anomaly detection — Phase 3
- Vessel watchlist with alerts — Phase 3
- Historical analytics charts — Phase 4
- Oil price correlation with traffic — Phase 4

</deferred>

---

*Phase: 02-intelligence-layers*
*Context gathered: 2026-03-12*
