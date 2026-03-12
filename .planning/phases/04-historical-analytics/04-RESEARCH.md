# Phase 4: Historical Analytics - Research

**Researched:** 2026-03-12
**Domain:** Time-series data visualization, Recharts charting, TimescaleDB aggregation queries
**Confidence:** HIGH

## Summary

This phase adds a historical analytics view to complement the live dashboard. The primary technical challenges are: (1) efficiently aggregating vessel positions from the TimescaleDB hypertable by day and chokepoint, (2) creating dual-axis charts combining traffic area charts with oil price line overlays using Recharts ComposedChart, and (3) building a new Next.js page route with proper navigation integration.

The project already has all necessary infrastructure: Recharts 3.8.0 is installed, the Sparkline component demonstrates AreaChart patterns, oil prices are stored in the database with 30-day history via `getLatestPrices()`, and chokepoint bounds are defined in `src/lib/geo/chokepoints.ts`. The analytics view extends these patterns to larger full-width charts with selectors.

**Primary recommendation:** Use TimescaleDB `time_bucket()` function for daily aggregation queries, Recharts ComposedChart with dual YAxis (yAxisId) for traffic/price overlay, and Zustand store extension for analytics UI state.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Separate view:** New `/analytics` route (not crammed into dashboard)
- **Navigation:** Tab or link in header to switch between Live Map and Analytics
- **Layout:** Full-width charts with controls, dark theme consistent with dashboard
- **Chart type:** Area charts for traffic volume over time (Recharts, already installed)
- **Grouping options:** By chokepoint (Hormuz, Bab el-Mandeb, Suez) or by route (ME->Asia, ME->Europe)
- **Time ranges:** 7 days, 30 days, 90 days selector
- **Metrics:** Vessel count per day, tankers vs all vessels
- **Data source:** Aggregate query on vessel_positions table grouped by day and chokepoint polygon
- **Oil price overlay:** Secondary Y-axis showing WTI/Brent price alongside traffic volume
- **Visualization:** Line chart overlaid on area chart for visual correlation
- **Route detection:** Use destination country/region from AIS metadata, not complex path analysis
- **Routes:** Middle East -> East Asia, Middle East -> Europe, Middle East -> Americas
- **Read replica pattern:** Use separate connection pool for analytics queries
- **Aggregation:** Pre-compute daily aggregates via cron job or compute on read with caching

### Claude's Discretion
- Exact chart colors and styling
- Loading states for analytics queries
- Empty state when insufficient data
- Exact aggregation query optimization
- Cache duration for analytics data

### Deferred Ideas (OUT OF SCOPE)
- Hourly granularity analytics (v2)
- Export to CSV/PDF (v2)
- Custom date range picker (v2 - preset ranges sufficient)
- Anomaly correlation charts (v2)
- Predictive analytics (out of scope)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HIST-01 | User can view historical analytics with charts, trends, and correlations over time | Recharts ComposedChart with dual YAxis enables traffic area charts with oil price line overlay. TimescaleDB time_bucket() provides efficient daily aggregation. Existing chokepoint bounds enable polygon-based traffic counting. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | 3.8.0 | Data visualization | Already installed, used by Sparkline. ComposedChart enables multi-series charts. |
| date-fns | 4.1.0 | Date manipulation | Already installed. Format dates for chart labels, compute date ranges. |
| Zustand | 5.0.11 | Client state | Already installed. Extend vessel store for analytics selectors. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TimescaleDB | (server) | Time-series aggregation | `time_bucket('1 day', time)` for efficient daily grouping |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Nivo | Nivo has better time-series defaults but larger bundle; Recharts already in project |
| date-fns | dayjs | dayjs is smaller but date-fns already installed and sufficient |
| Manual aggregation | Materialized views | Pre-computed views faster but add schema complexity; on-demand query acceptable for 90-day range |

**No new dependencies needed.** All required libraries are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── (protected)/
│       └── analytics/
│           └── page.tsx           # Analytics page (new)
├── lib/
│   └── db/
│       └── analytics.ts           # Traffic aggregation queries (new)
├── components/
│   ├── charts/
│   │   └── TrafficChart.tsx       # Full-width traffic/price chart (new)
│   └── ui/
│       ├── TimeRangeSelector.tsx  # 7d/30d/90d buttons (new)
│       ├── ChokepointSelector.tsx # Multi-select for chokepoints (new)
│       └── Header.tsx             # Add Analytics navigation tab (modify)
├── stores/
│   └── analytics.ts               # Analytics UI state (new, or extend vessel.ts)
└── types/
    └── analytics.ts               # Analytics types (new)
```

### Pattern 1: Recharts ComposedChart with Dual Y-Axis
**What:** Overlay Area chart (traffic volume) with Line chart (oil price) using two independent Y-axes.
**When to use:** When comparing metrics with different scales/units on same time axis.
**Example:**
```typescript
// Source: Recharts API documentation - YAxis yAxisId
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface DataPoint {
  date: string;           // X-axis: formatted date
  vesselCount: number;    // Left Y-axis: traffic volume
  tankerCount: number;    // Left Y-axis: tanker subset
  oilPrice: number;       // Right Y-axis: oil price
}

<ResponsiveContainer width="100%" height={400}>
  <ComposedChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
    <XAxis dataKey="date" stroke="#9ca3af" />
    <YAxis yAxisId="left" stroke="#9ca3af" label="Vessels" />
    <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" label="USD" />
    <Tooltip />
    <Area
      yAxisId="left"
      type="monotone"
      dataKey="vesselCount"
      fill="#3b82f6"
      fillOpacity={0.3}
      stroke="#3b82f6"
    />
    <Area
      yAxisId="left"
      type="monotone"
      dataKey="tankerCount"
      fill="#f59e0b"
      fillOpacity={0.5}
      stroke="#f59e0b"
    />
    <Line
      yAxisId="right"
      type="monotone"
      dataKey="oilPrice"
      stroke="#22c55e"
      strokeWidth={2}
      dot={false}
    />
  </ComposedChart>
</ResponsiveContainer>
```

### Pattern 2: TimescaleDB time_bucket Aggregation
**What:** Group time-series data into fixed intervals (1 day) for efficient aggregate queries.
**When to use:** Aggregating vessel_positions for daily traffic counts.
**Example:**
```sql
-- Source: TimescaleDB time_bucket documentation
-- Count unique vessels per day per chokepoint
SELECT
  time_bucket('1 day', vp.time) AS bucket_day,
  COUNT(DISTINCT vp.mmsi) AS vessel_count,
  COUNT(DISTINCT vp.mmsi) FILTER (WHERE v.ship_type BETWEEN 80 AND 89) AS tanker_count
FROM vessel_positions vp
LEFT JOIN vessels v ON vp.mmsi = v.mmsi
WHERE vp.time > NOW() - INTERVAL '30 days'
  AND vp.latitude BETWEEN $1 AND $2
  AND vp.longitude BETWEEN $3 AND $4
GROUP BY bucket_day
ORDER BY bucket_day ASC;
```

### Pattern 3: Zustand Store for Analytics State
**What:** Client-side state management for selectors and filters.
**When to use:** Managing timeRange, selectedChokepoints, selectedRoutes across components.
**Example:**
```typescript
// Source: Existing pattern from src/stores/vessel.ts
import { create } from 'zustand';

interface AnalyticsStore {
  timeRange: '7d' | '30d' | '90d';
  selectedChokepoints: string[];
  selectedRoutes: string[];
  setTimeRange: (range: '7d' | '30d' | '90d') => void;
  setSelectedChokepoints: (ids: string[]) => void;
  setSelectedRoutes: (ids: string[]) => void;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  timeRange: '30d',
  selectedChokepoints: ['hormuz', 'babel_mandeb', 'suez'],
  selectedRoutes: [],
  setTimeRange: (timeRange) => set({ timeRange }),
  setSelectedChokepoints: (selectedChokepoints) => set({ selectedChokepoints }),
  setSelectedRoutes: (selectedRoutes) => set({ selectedRoutes }),
}));
```

### Anti-Patterns to Avoid
- **Querying uncompressed full history:** Always filter by time range before aggregation. TimescaleDB compresses old data - query must include time bounds.
- **N+1 API calls:** Don't fetch traffic data for each chokepoint separately. Use single query with GROUP BY chokepoint.
- **Storing derived data in state:** Don't store chart-ready data in Zustand. Let React Query/SWR cache API responses; derive chart format in component.
- **Blocking analytics on live data:** Analytics queries on large time ranges can be slow. Don't execute on main thread during dashboard rendering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range selection | Custom date picker | Simple button group (7d/30d/90d) | CONTEXT.md explicitly defers custom date picker to v2 |
| Time-series aggregation | Manual GROUP BY date() | TimescaleDB time_bucket() | Optimized for hypertables, handles timezones correctly |
| Chart rendering | Custom SVG/Canvas | Recharts ComposedChart | Already installed, handles responsive sizing, tooltips |
| Multi-select dropdown | Custom checkbox list | Simple styled multi-select or button toggles | Sufficient for 3 chokepoints, 3 routes |

**Key insight:** This phase is about combining existing capabilities (Recharts, chokepoints, oil prices) into a new view, not adding new infrastructure.

## Common Pitfalls

### Pitfall 1: TimescaleDB Query Without Time Filter
**What goes wrong:** Query scans entire hypertable (potentially millions of rows), causing timeout or OOM.
**Why it happens:** Forgetting WHERE clause on time column, or passing incorrect interval.
**How to avoid:** Always include `WHERE time > NOW() - INTERVAL 'X days'` with X from selector.
**Warning signs:** Query takes >5 seconds, database connection pool exhausted.

### Pitfall 2: Recharts YAxis Scale Mismatch
**What goes wrong:** Oil price line appears flat or vessel count appears as tiny spike.
**Why it happens:** Default YAxis auto-scaling optimizes for each series independently.
**How to avoid:** Use explicit domain bounds or let Recharts auto-scale independently per yAxisId.
**Warning signs:** One series dominates chart, other series unreadable.

### Pitfall 3: Route Detection Edge Cases
**What goes wrong:** Vessels without destination field counted as "unknown route" or excluded.
**Why it happens:** AIS destination field is often null, malformed, or abbreviations (e.g., "SGP" vs "Singapore").
**How to avoid:** Treat null destination as "Unknown" category. Use loose substring matching for regions. Accept imperfect classification.
**Warning signs:** Large percentage of vessels in "Unknown" category.

### Pitfall 4: Analytics Page Blocking Dashboard
**What goes wrong:** Dashboard loads slowly when analytics queries are running.
**Why it happens:** Shared database connection pool, expensive analytics queries hold connections.
**How to avoid:** Use separate connection pool for analytics (as specified in CONTEXT.md), or implement query timeout.
**Warning signs:** Dashboard freshness indicator shows stale data during analytics usage.

### Pitfall 5: Chart Re-renders on Selector Change
**What goes wrong:** Chart flickers or loses animation on every selector change.
**Why it happens:** React key changes cause unmount/remount, or data prop reference changes unnecessarily.
**How to avoid:** Memoize data transformation with useMemo, stable component keys.
**Warning signs:** Chart animation restarts on every interaction, performance degradation.

## Code Examples

### Traffic Aggregation Query
```typescript
// Source: Pattern from src/lib/geo/chokepoints.ts countVesselsInChokepoint
import { pool } from './index';
import { CHOKEPOINTS, ChokepointBounds } from '../geo/chokepoints';

interface DailyTrafficPoint {
  date: string;           // ISO date string (YYYY-MM-DD)
  vesselCount: number;
  tankerCount: number;
}

export async function getTrafficByChokepoint(
  chokepointId: string,
  days: number
): Promise<DailyTrafficPoint[]> {
  const bounds = CHOKEPOINTS[chokepointId]?.bounds;
  if (!bounds) return [];

  const result = await pool.query<{
    bucket_day: Date;
    vessel_count: number;
    tanker_count: number;
  }>(`
    SELECT
      time_bucket('1 day', vp.time) AS bucket_day,
      COUNT(DISTINCT vp.mmsi)::int AS vessel_count,
      COUNT(DISTINCT vp.mmsi) FILTER (WHERE v.ship_type BETWEEN 80 AND 89)::int AS tanker_count
    FROM vessel_positions vp
    LEFT JOIN vessels v ON vp.mmsi = v.mmsi
    WHERE vp.time > NOW() - $1::interval
      AND vp.latitude BETWEEN $2 AND $3
      AND vp.longitude BETWEEN $4 AND $5
    GROUP BY bucket_day
    ORDER BY bucket_day ASC
  `, [`${days} days`, bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon]);

  return result.rows.map(row => ({
    date: row.bucket_day.toISOString().split('T')[0],
    vesselCount: row.vessel_count,
    tankerCount: row.tanker_count,
  }));
}
```

### Price History for Overlay
```typescript
// Source: Extend pattern from src/lib/db/prices.ts getLatestPrices
export async function getPriceHistory(
  symbol: string,
  days: number
): Promise<{ date: string; price: number }[]> {
  const result = await pool.query<{ date: Date; price: number }>(`
    SELECT
      DATE(fetched_at) as date,
      AVG(price)::numeric(10,2) as price
    FROM oil_prices
    WHERE symbol = $1
      AND fetched_at > NOW() - $2::interval
    GROUP BY DATE(fetched_at)
    ORDER BY date ASC
  `, [symbol, `${days} days`]);

  return result.rows.map(row => ({
    date: row.date.toISOString().split('T')[0],
    price: Number(row.price),
  }));
}
```

### Header Navigation Tab
```typescript
// Source: Extend pattern from src/components/ui/Header.tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// In Header component
const pathname = usePathname();
const isAnalytics = pathname === '/analytics';

// Add to header render
<nav className="flex gap-2">
  <Link
    href="/dashboard"
    className={`px-3 py-1 rounded ${!isAnalytics ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
  >
    Live Map
  </Link>
  <Link
    href="/analytics"
    className={`px-3 py-1 rounded ${isAnalytics ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
  >
    Analytics
  </Link>
</nav>
```

### Route Region Classification
```typescript
// Source: Use destination field from vessels table
const REGION_KEYWORDS: Record<string, string[]> = {
  'east_asia': ['CHINA', 'JAPAN', 'KOREA', 'TAIWAN', 'SGP', 'SINGAPORE', 'HONG KONG'],
  'europe': ['ROTTERDAM', 'ANTWERP', 'UK', 'SPAIN', 'ITALY', 'GREECE', 'TURKEY'],
  'americas': ['US', 'USA', 'HOUSTON', 'LOUISIANA', 'BRAZIL', 'MEXICO'],
};

export function classifyRoute(destination: string | null): string {
  if (!destination) return 'unknown';
  const upper = destination.toUpperCase();
  for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
    if (keywords.some(kw => upper.includes(kw))) return region;
  }
  return 'unknown';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart.js | Recharts | 2020+ | React-native integration, declarative API |
| Manual date grouping | time_bucket() | TimescaleDB 1.0 (2018) | 10x faster aggregation on hypertables |
| Polling for updates | React Query/SWR | 2020+ | Automatic caching, background refresh |

**Deprecated/outdated:**
- Chart.js direct DOM manipulation: Use Recharts declarative JSX instead
- Date.getDay() for grouping: Use TimescaleDB time_bucket() server-side

## Open Questions

1. **Pre-computation vs On-demand**
   - What we know: 90-day queries on vessel_positions may be slow (millions of rows).
   - What's unclear: Actual query performance without production data volume.
   - Recommendation: Start with on-demand queries. Add daily aggregation cron job if performance insufficient.

2. **Route Classification Accuracy**
   - What we know: AIS destination field is free-text, often abbreviated or empty.
   - What's unclear: What percentage of vessels have usable destination data.
   - Recommendation: Display "Unknown" route category prominently. Accept imperfect classification for v1.

3. **Oil Price Correlation Timing**
   - What we know: Oil prices and vessel traffic are logged at different times.
   - What's unclear: Whether to align by day or allow slight misalignment.
   - Recommendation: Aggregate both to daily granularity (midnight UTC). Accept that intraday correlation is lost.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- --run src/lib/db/analytics.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HIST-01 | Traffic aggregation query returns daily counts by chokepoint | unit | `npm test -- --run src/lib/db/analytics.test.ts` | Wave 0 |
| HIST-01 | Price history query returns daily averages | unit | `npm test -- --run src/lib/db/analytics.test.ts` | Wave 0 |
| HIST-01 | Route classification maps destination to region | unit | `npm test -- --run src/lib/db/analytics.test.ts` | Wave 0 |
| HIST-01 | TrafficChart renders with dual Y-axis | integration | `npm test -- --run src/components/charts/TrafficChart.test.tsx` | Wave 0 |
| HIST-01 | API returns combined traffic and price data | unit | `npm test -- --run src/app/api/analytics/route.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --run [relevant test file]`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/db/analytics.test.ts` - covers traffic aggregation, price history, route classification
- [ ] `src/components/charts/TrafficChart.test.tsx` - covers chart rendering with mock data

## Sources

### Primary (HIGH confidence)
- **Codebase Analysis:** Direct examination of `src/components/charts/Sparkline.tsx`, `src/lib/db/prices.ts`, `src/lib/geo/chokepoints.ts`, `src/stores/vessel.ts`
- **Recharts API Documentation:** https://recharts.github.io/en-US/api/ComposedChart - ComposedChart props, YAxis yAxisId for dual axis
- **Recharts Examples:** https://recharts.github.io/en-US/examples - BiaxialLineChart, LineBarAreaComposedChart patterns
- **Database Schema:** `src/lib/db/schema.sql` - vessel_positions hypertable, oil_prices table structure

### Secondary (MEDIUM confidence)
- **TimescaleDB time_bucket:** Based on training knowledge of TimescaleDB hyperfunctions. Syntax: `time_bucket('1 day', time_column)`. Works efficiently on compressed hypertables.

### Tertiary (LOW confidence)
- None - all findings verified against codebase or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and used in project
- Architecture: HIGH - patterns extend existing codebase conventions
- Pitfalls: MEDIUM - based on general time-series and charting experience

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable stack, no breaking changes expected)
