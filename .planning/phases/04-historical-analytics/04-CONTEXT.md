# Phase 4: Historical Analytics - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Build historical analytics view: traffic charts by chokepoint/route over selectable time ranges, oil price overlay for correlation analysis. This is the "look back in time" view complementing the live situational awareness from Phases 1-3. Charts must render from accumulated data without blocking live ingestion.

</domain>

<decisions>
## Implementation Decisions

### Analytics View Structure
- **Separate view:** New `/analytics` route (not crammed into dashboard)
- **Navigation:** Tab or link in header to switch between Live Map and Analytics
- **Layout:** Full-width charts with controls, dark theme consistent with dashboard

### Traffic Charts (HIST-01)
- **Chart type:** Area charts for traffic volume over time (Recharts, already installed)
- **Grouping options:** By chokepoint (Hormuz, Bab el-Mandeb, Suez) or by route (ME→Asia, ME→Europe)
- **Time ranges:** 7 days, 30 days, 90 days selector
- **Metrics:** Vessel count per day, tankers vs all vessels
- **Data source:** Aggregate query on vessel_positions table grouped by day and chokepoint polygon

### Oil Price Correlation
- **Overlay:** Secondary Y-axis showing WTI/Brent price alongside traffic volume
- **Visualization:** Line chart overlaid on area chart for visual correlation
- **Data source:** oil_prices table (already populated from Phase 2)
- **Insight:** Show if traffic spikes correlate with price movements

### Route Detection
- **Routes:** Middle East → East Asia, Middle East → Europe, Middle East → Americas
- **Detection method:** Compare vessel destination ports to route endpoint regions
- **Simplification:** Use destination country/region from AIS metadata, not complex path analysis

### Performance Considerations
- **Read replica pattern:** Use separate connection pool for analytics queries (don't block writes)
- **Aggregation:** Pre-compute daily aggregates via cron job or compute on read with caching
- **Pagination:** Not needed for daily aggregates (max ~90 data points for 90-day view)

### UI Components
- **TimeRangeSelector:** Dropdown or button group for 7d/30d/90d
- **ChokepointSelector:** Multi-select for which chokepoints to show
- **RouteSelector:** Multi-select for which routes to show
- **TrafficChart:** Recharts AreaChart with oil price LineChart overlay
- **AnalyticsPage:** Layout component combining selectors and chart

### Carrying Forward from Prior Phases
- Dark theme (#1a1a2e background)
- Recharts library (already installed)
- Oil prices in database (from Phase 2)
- Chokepoint definitions (from Phase 3)
- Zustand store pattern for UI state

### Claude's Discretion
- Exact chart colors and styling
- Loading states for analytics queries
- Empty state when insufficient data
- Exact aggregation query optimization
- Cache duration for analytics data

</decisions>

<specifics>
## Specific Ideas

- Analytics view is for "what happened over time" — not real-time
- Oil price correlation is the key insight — "did tanker traffic respond to price changes?"
- Keep it simple — daily aggregates, not hourly granularity
- This view becomes more valuable as data accumulates over weeks/months

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/geo/chokepoints.ts` — CHOKEPOINT_BOUNDS for traffic counting
- `src/lib/db/prices.ts` — getLatestPrices, getPriceHistory for oil data
- `src/components/charts/Sparkline.tsx` — Recharts pattern to extend
- `src/stores/vessel.ts` — Zustand store pattern to extend
- `src/components/ui/Header.tsx` — Add analytics navigation

### Established Patterns
- API routes with pool.query for database access
- Zustand for client state management
- Recharts for data visualization
- Dark theme with consistent styling

### Integration Points
- Header: Add Analytics tab/link
- New route: `/analytics` page
- API: `/api/analytics/traffic` and `/api/analytics/correlation`
- Database: Aggregate queries on vessel_positions

</code_context>

<deferred>
## Deferred Ideas

- Hourly granularity analytics — v2 (daily is sufficient for v1)
- Export to CSV/PDF — v2
- Custom date range picker — v2 (preset ranges sufficient)
- Anomaly correlation charts — v2
- Predictive analytics — out of scope

</deferred>

---

*Phase: 04-historical-analytics*
*Context gathered: 2026-03-12*
