# Phase 2: Intelligence Layers - Research

**Researched:** 2026-03-12
**Domain:** Sanctions Data, Oil Prices API, News Feeds, Vessel Search, Chokepoint Monitoring
**Confidence:** HIGH

## Summary

This phase enriches the live map with contextual intelligence layers: sanctions flags on vessels, oil price panels, geopolitical news feeds, vessel search, and chokepoint monitoring widgets. The core challenge is integrating multiple external data sources (OFAC/EU sanctions lists, Alpha Vantage/FRED for prices, NewsAPI/GDELT for news) while maintaining the Bloomberg-terminal aesthetic established in Phase 1.

The technical stack is well-defined: OpenSanctions provides a maritime-focused CSV export with IMO-based vessel lookups, Alpha Vantage offers WTI/Brent crude prices on a free tier (25 requests/day), and NewsAPI provides headline filtering with keyword support. All sources support JSON/CSV responses that integrate cleanly with the existing Next.js API routes and PostgreSQL storage pattern. Recharts is the standard choice for sparkline charts in React, providing lightweight area/line charts without heavy dependencies.

**Primary recommendation:** Use OpenSanctions bulk CSV for sanctions (daily cron), Alpha Vantage with FRED fallback for oil prices (15-min polling), and NewsAPI for headlines (5-min polling). Store all external data in PostgreSQL tables with freshness timestamps. Extend existing Zustand store pattern for UI state.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Sanctions Data Source:** OFAC SDN List (U.S. Treasury) and EU Consolidated List. Match by IMO number (primary), MMSI as fallback, vessel name as weak signal. Daily cron job to fetch and diff sanctions lists. Store in `vessel_sanctions` table.
- **Oil Price Data Source:** Alpha Vantage API (free tier 25 requests/day) for WTI and Brent. Yahoo Finance as fallback. Update every 15 minutes during market hours. Store in `oil_prices` table.
- **News Feed Integration:** NewsAPI.org or GDELT for geopolitical headlines. Filter by keywords (oil, tanker, Iran, Strait of Hormuz, OPEC, sanctions, Red Sea, Houthi, Saudi Arabia, UAE, pipeline). Update every 5 minutes, retain 7 days.
- **Vessel Search:** Search by vessel name (partial match), IMO (exact), MMSI (exact). Autocomplete dropdown, fly to vessel on select.
- **Chokepoint Monitoring:** Strait of Hormuz, Bab el-Mandeb, Suez Canal. Predefined bounding box polygons. Show current vessel count, 24h average, trend indicator.
- **UI Layout:** Oil price panel top-right, news panel collapsible right sidebar, chokepoint widgets horizontal bar below header, sanctions badge red dot on markers.

### Claude's Discretion
- Exact sparkline chart library (recharts, visx, or custom SVG)
- News item card design details
- Chokepoint widget exact styling
- Search autocomplete behavior details
- Animation timing for panel transitions

### Deferred Ideas (OUT OF SCOPE)
- AIS gap detection (going dark) - Phase 3
- Route anomaly detection - Phase 3
- Vessel watchlist with alerts - Phase 3
- Historical analytics charts - Phase 4
- Oil price correlation with traffic - Phase 4

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTL-01 | User can see sanctions flags on vessels linked to OFAC or EU sanctioned entities | OpenSanctions maritime CSV with IMO matching; `vessel_sanctions` table schema; red badge UI pattern |
| INTL-02 | User can view oil price panel showing WTI/Brent current prices and 30-day chart | Alpha Vantage commodity endpoints; Recharts sparkline; `oil_prices` table with 15-min polling |
| INTL-03 | User can view geopolitical news feed filtered for Middle East and oil keywords | NewsAPI /top-headlines endpoint; keyword filtering; `news_items` table; 5-min polling |
| MAP-06 | User can search vessels by name or IMO number | PostgreSQL ILIKE query; `/api/vessels/search` endpoint; autocomplete UI pattern |
| MAP-07 | User can view chokepoint monitoring widgets for Hormuz, Bab el-Mandeb, and Suez | Bounding box polygons; PostGIS point-in-polygon; real-time count from positions table |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^2.13 | Sparkline charts for oil prices | React-native, lightweight, composable, TypeScript support |
| date-fns | ^4.1 (existing) | Date formatting and manipulation | Already in project, tree-shakeable |
| zustand | ^5.0 (existing) | UI state management | Already in project, extend for new panels |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-cron | ^3.0 | Schedule sanctions/price updates | Daily sanctions sync, 15-min price fetch |
| papaparse | ^5.4 | Parse OpenSanctions CSV | Bulk sanctions data import |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | visx | visx more flexible but higher learning curve; recharts simpler for basic sparklines |
| recharts | custom SVG | Custom SVG lighter but more code for responsive handling |
| NewsAPI | GDELT | GDELT more comprehensive but no free tier rate limits documented; NewsAPI clearer pricing |
| Alpha Vantage | FRED only | FRED has no rate limits but data may be slightly delayed |

**Installation:**
```bash
npm install recharts node-cron papaparse
npm install -D @types/papaparse
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── api/
│       ├── vessels/
│       │   ├── route.ts       # (existing) extend with sanctions join
│       │   └── search/
│       │       └── route.ts   # NEW: vessel search endpoint
│       ├── prices/
│       │   └── route.ts       # NEW: oil prices endpoint
│       ├── news/
│       │   └── route.ts       # NEW: news feed endpoint
│       └── chokepoints/
│           └── route.ts       # NEW: chokepoint stats endpoint
├── components/
│   ├── panels/
│   │   ├── VesselPanel.tsx    # (existing) extend with sanctions section
│   │   ├── OilPricePanel.tsx  # NEW: floating price widget
│   │   └── NewsPanel.tsx      # NEW: collapsible news sidebar
│   ├── ui/
│   │   ├── Header.tsx         # (existing) extend with search + chokepoints
│   │   ├── SearchInput.tsx    # NEW: autocomplete search
│   │   └── ChokepointWidget.tsx # NEW: single chokepoint card
│   └── charts/
│       └── Sparkline.tsx      # NEW: reusable sparkline component
├── lib/
│   ├── db/
│   │   ├── schema.sql         # (existing) extend with new tables
│   │   ├── sanctions.ts       # NEW: sanctions CRUD
│   │   ├── prices.ts          # NEW: oil prices CRUD
│   │   └── news.ts            # NEW: news items CRUD
│   ├── external/
│   │   ├── opensanctions.ts   # NEW: fetch/parse sanctions CSV
│   │   ├── alphavantage.ts    # NEW: fetch oil prices
│   │   ├── fred.ts            # NEW: FRED API fallback
│   │   └── newsapi.ts         # NEW: fetch news headlines
│   └── geo/
│       └── chokepoints.ts     # NEW: bounding boxes, point-in-polygon
├── services/
│   └── cron/
│       └── index.ts           # NEW: scheduled jobs (sanctions, prices, news)
└── stores/
    └── vessel.ts              # (existing) extend with search state, panels
```

### Pattern 1: External Data Fetcher with Caching
**What:** Fetch external API data, store in database, serve from cache
**When to use:** Oil prices, news, sanctions - any external data with rate limits
**Example:**
```typescript
// src/lib/external/alphavantage.ts
interface OilPrice {
  symbol: 'WTI' | 'BRENT';
  price: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

export async function fetchOilPrices(): Promise<OilPrice[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  // WTI Crude
  const wtiRes = await fetch(
    `https://www.alphavantage.co/query?function=WTI&interval=daily&apikey=${apiKey}`
  );
  const wtiData = await wtiRes.json();

  // Brent Crude
  const brentRes = await fetch(
    `https://www.alphavantage.co/query?function=BRENT&interval=daily&apikey=${apiKey}`
  );
  const brentData = await brentRes.json();

  return [
    parseAlphaVantageResponse(wtiData, 'WTI'),
    parseAlphaVantageResponse(brentData, 'BRENT'),
  ];
}
```

### Pattern 2: Sanctions Matching by IMO
**What:** Join vessel data with sanctions list on IMO number
**When to use:** Displaying sanctions status on vessel markers and panels
**Example:**
```typescript
// src/lib/db/vessels.ts (extended)
export async function getVesselsWithSanctions(tankersOnly: boolean) {
  const sql = `
    SELECT v.*,
           s.sanctioning_authority,
           s.list_date,
           s.reason,
           CASE WHEN s.imo IS NOT NULL THEN true ELSE false END as is_sanctioned
    FROM vessels v
    LEFT JOIN vessel_sanctions s ON v.imo = s.imo
    ${tankersOnly ? 'WHERE v.ship_type BETWEEN 80 AND 89' : ''}
    ORDER BY v.last_seen DESC
  `;
  return pool.query(sql);
}
```

### Pattern 3: Chokepoint Point-in-Polygon
**What:** Count vessels within predefined bounding boxes
**When to use:** Real-time chokepoint traffic monitoring
**Example:**
```typescript
// src/lib/geo/chokepoints.ts
export const CHOKEPOINTS = {
  hormuz: {
    name: 'Strait of Hormuz',
    bounds: {
      minLat: 26.0, maxLat: 27.0,
      minLon: 55.5, maxLon: 57.0,
    },
  },
  babel_mandeb: {
    name: 'Bab el-Mandeb',
    bounds: {
      minLat: 12.4, maxLat: 13.0,
      minLon: 43.0, maxLon: 43.7,
    },
  },
  suez: {
    name: 'Suez Canal',
    bounds: {
      minLat: 29.8, maxLat: 31.3,
      minLon: 32.2, maxLon: 32.6,
    },
  },
};

export function isInChokepoint(lat: number, lon: number, bounds: typeof CHOKEPOINTS.hormuz.bounds) {
  return lat >= bounds.minLat && lat <= bounds.maxLat &&
         lon >= bounds.minLon && lon <= bounds.maxLon;
}
```

### Anti-Patterns to Avoid
- **Fetching external APIs on every request:** Store in DB, serve from cache. Alpha Vantage has 25 req/day limit.
- **String-matching vessel names for sanctions:** Use IMO number as primary key, names have spelling variations.
- **Real-time external API calls in UI components:** Defeats caching, causes rate limits, introduces latency.
- **Storing full article content:** Only store title, source, URL, timestamp - link to original.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom regex parser | papaparse | Edge cases (quoted fields, unicode, escapes) |
| Sparkline charts | Custom canvas/SVG | recharts | Responsive handling, tooltips, accessibility |
| Cron scheduling | setInterval in Node | node-cron | Handles server restarts, timezone, cron syntax |
| Date formatting | Manual string concat | date-fns | i18n, relative times, timezone handling |
| Point-in-polygon | Custom math | PostGIS or simple bounds check | For rectangles, bounds check is fine; complex polygons need PostGIS |

**Key insight:** External data integration has many edge cases (rate limits, timeouts, malformed responses, API changes). Use battle-tested libraries and defensive coding.

## Common Pitfalls

### Pitfall 1: Alpha Vantage Rate Limit Exhaustion
**What goes wrong:** 25 requests/day exhausted by mid-day, no price updates
**Why it happens:** Too-frequent polling, fetching WTI+Brent separately counts as 2 requests
**How to avoid:** Poll every 15 minutes (max 96/day if 24h, but markets are ~6.5h so ~26/day is tight). Use FRED as automatic fallback. Cache aggressively.
**Warning signs:** API returns "Thank you for using Alpha Vantage! Our standard API call frequency is..."

### Pitfall 2: NewsAPI Free Tier Production Restriction
**What goes wrong:** API works in dev, fails in production
**Why it happens:** NewsAPI Developer plan explicitly forbids production use, requires $449/month Business plan
**How to avoid:** Use GDELT (no rate limits, free) or accept development-only news. Alternatively, self-host news aggregation.
**Warning signs:** "API key restrictions" errors in production logs

### Pitfall 3: Sanctions Data Staleness
**What goes wrong:** New sanctions not reflected, removed sanctions still shown
**Why it happens:** Cron job fails silently, diff logic buggy, no freshness indicator
**How to avoid:** Log cron results, show "last updated" timestamp, alert on stale data (>48h old)
**Warning signs:** Users report sanctioned vessels not flagged, or removed sanctions still showing

### Pitfall 4: IMO Number Format Mismatches
**What goes wrong:** Sanctions lookup misses vessels despite IMO existing in both
**Why it happens:** Leading zeros stripped, "IMO" prefix included/excluded inconsistently
**How to avoid:** Normalize IMO to 7 digits without prefix: `imo.replace(/^IMO\s*/i, '').padStart(7, '0')`
**Warning signs:** 0% sanctions matches when list is non-empty

### Pitfall 5: Chokepoint Bounding Box Too Small
**What goes wrong:** Vessels transiting chokepoint not counted
**Why it happens:** Bounding box drawn too tight, doesn't account for shipping lanes
**How to avoid:** Use generous bounds, test with real position data, verify counts against known traffic
**Warning signs:** "0 vessels" in Hormuz when clearly tankers are there

## Code Examples

Verified patterns for this phase:

### Database Schema Extensions
```sql
-- src/lib/db/schema.sql (add after existing tables)

-- Vessel sanctions data (INTL-01)
CREATE TABLE IF NOT EXISTS vessel_sanctions (
  imo VARCHAR(10) PRIMARY KEY,
  sanctioning_authority VARCHAR(10) NOT NULL,  -- 'OFAC' or 'EU'
  list_date DATE,
  reason TEXT,
  confidence VARCHAR(10) DEFAULT 'HIGH',  -- HIGH (IMO match), MEDIUM (MMSI), LOW (name)
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Oil price history (INTL-02)
CREATE TABLE IF NOT EXISTS oil_prices (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,  -- 'WTI' or 'BRENT'
  price DECIMAL(10, 2) NOT NULL,
  change DECIMAL(10, 2),
  change_percent DECIMAL(5, 2),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oil_prices_symbol_time ON oil_prices(symbol, fetched_at DESC);

-- News items (INTL-03)
CREATE TABLE IF NOT EXISTS news_items (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  source VARCHAR(100),
  url TEXT NOT NULL UNIQUE,
  published_at TIMESTAMPTZ,
  relevance_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_news_items_time ON news_items(published_at DESC);
```

### Vessel Search API
```typescript
// src/app/api/vessels/search/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Search by IMO (exact), MMSI (exact), or name (partial)
  const result = await pool.query(`
    SELECT v.imo, v.mmsi, v.name, v.flag, v.ship_type as "shipType",
           p.latitude, p.longitude
    FROM vessels v
    LEFT JOIN LATERAL (
      SELECT latitude, longitude FROM vessel_positions
      WHERE mmsi = v.mmsi ORDER BY time DESC LIMIT 1
    ) p ON true
    WHERE v.imo = $1
       OR v.mmsi = $1
       OR v.name ILIKE $2
    LIMIT 10
  `, [q, `%${q}%`]);

  return NextResponse.json({ results: result.rows });
}
```

### Recharts Sparkline Component
```typescript
// src/components/charts/Sparkline.tsx
'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: { value: number }[];
  color?: string;
  height?: number;
}

export function Sparkline({ data, color = '#f59e0b', height = 40 }: SparklineProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.2}
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### Oil Price Panel Component
```typescript
// src/components/panels/OilPricePanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { Sparkline } from '../charts/Sparkline';

interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  history: { value: number }[];
}

export function OilPricePanel() {
  const [prices, setPrices] = useState<PriceData[]>([]);

  useEffect(() => {
    const fetchPrices = async () => {
      const res = await fetch('/api/prices');
      const data = await res.json();
      setPrices(data.prices);
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // Refresh UI every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-16 right-4 bg-[#16162a] border border-gray-800 rounded-lg p-3 z-20">
      <div className="flex gap-4">
        {prices.map((p) => (
          <div key={p.symbol} className="flex flex-col">
            <span className="text-xs text-gray-400">{p.symbol}</span>
            <span className="text-lg font-mono text-white">${p.price.toFixed(2)}</span>
            <span className={`text-xs ${p.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {p.change >= 0 ? '+' : ''}{p.changePercent.toFixed(2)}%
            </span>
            <Sparkline data={p.history} color={p.change >= 0 ? '#4ade80' : '#f87171'} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Sanctions Badge on Vessel Marker
```typescript
// GeoJSON feature property extension for vessel markers
interface VesselFeatureProperties {
  imo: string;
  name: string;
  isSanctioned: boolean;
  sanctioningAuthority?: 'OFAC' | 'EU';
}

// In VesselLayer.tsx paint configuration:
// Add red circle behind sanctioned vessels
'circle-color': [
  'case',
  ['get', 'isSanctioned'], '#ef4444',  // Red for sanctioned
  '#f59e0b'  // Amber for normal
],
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MarineTraffic API for sanctions | OpenSanctions free dataset | 2023+ | Free, open-source, IMO-indexed |
| jQuery/D3 charts | React chart libraries (recharts, visx) | 2020+ | Component-based, TypeScript, SSR compatible |
| REST polling for real-time | Still REST for this use case | - | WebSocket overkill for 15-min price updates |
| Manual cron via crontab | node-cron in-process | 2018+ | Single deployment, no system cron needed |

**Deprecated/outdated:**
- Yahoo Finance API: Frequently blocked, unofficial, unreliable
- Google Finance API: Discontinued 2012
- Alpha Vantage batch endpoints: Never had good commodity coverage

## Open Questions

1. **NewsAPI Production Viability**
   - What we know: Free tier is development-only, Business is $449/month
   - What's unclear: Whether GDELT provides adequate coverage for this use case
   - Recommendation: Start with NewsAPI in dev, evaluate GDELT as production alternative, or accept news feature as dev-only

2. **Sanctions List Update Timing**
   - What we know: OFAC updates "regularly", OpenSanctions publishes daily
   - What's unclear: Exact time of day updates are published
   - Recommendation: Run cron at 2 AM UTC to catch overnight updates, show "last updated" timestamp

3. **Chokepoint Exact Coordinates**
   - What we know: General geographic areas
   - What's unclear: Precise shipping lane boundaries
   - Recommendation: Start with generous bounding boxes, refine based on actual position data patterns

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTL-01 | Sanctions flags display on sanctioned vessels | unit | `npm test -- --run src/lib/db/sanctions.test.ts` | Wave 0 |
| INTL-01 | IMO normalization handles formats | unit | `npm test -- --run src/lib/external/opensanctions.test.ts` | Wave 0 |
| INTL-02 | Oil prices fetched and cached | unit | `npm test -- --run src/lib/external/alphavantage.test.ts` | Wave 0 |
| INTL-02 | Sparkline renders with price history | unit | `npm test -- --run src/components/charts/Sparkline.test.tsx` | Wave 0 |
| INTL-03 | News items filtered by keywords | unit | `npm test -- --run src/lib/external/newsapi.test.ts` | Wave 0 |
| MAP-06 | Vessel search by IMO/MMSI/name | unit | `npm test -- --run src/lib/db/search.test.ts` | Wave 0 |
| MAP-07 | Chokepoint point-in-polygon detection | unit | `npm test -- --run src/lib/geo/chokepoints.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/db/sanctions.test.ts` - covers INTL-01 sanctions CRUD
- [ ] `src/lib/external/opensanctions.test.ts` - covers sanctions CSV parsing
- [ ] `src/lib/external/alphavantage.test.ts` - covers INTL-02 price fetching
- [ ] `src/components/charts/Sparkline.test.tsx` - covers INTL-02 chart rendering
- [ ] `src/lib/external/newsapi.test.ts` - covers INTL-03 news fetching
- [ ] `src/lib/db/search.test.ts` - covers MAP-06 vessel search
- [ ] `src/lib/geo/chokepoints.test.ts` - covers MAP-07 chokepoint detection

## Sources

### Primary (HIGH confidence)
- OpenSanctions Documentation (https://www.opensanctions.org/docs/) - bulk data formats, maritime CSV availability
- OpenSanctions Bulk Formats (https://www.opensanctions.org/docs/bulk/formats/) - confirmed maritime-related CSV export
- Alpha Vantage Premium Page (https://www.alphavantage.co/premium/) - confirmed 25 requests/day free tier
- FRED API Documentation (https://fred.stlouisfed.org/docs/api/fred/series_observations.html) - series observations endpoint, JSON format
- NewsAPI Top Headlines Docs (https://newsapi.org/docs/endpoints/top-headlines) - endpoint parameters, response format
- NewsAPI Pricing (https://newsapi.org/pricing) - confirmed 100 req/day free tier, dev-only restriction

### Secondary (MEDIUM confidence)
- GDELT DOC 2.0 API (https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) - query parameters, filtering options
- Existing project codebase - Zustand store pattern, API route pattern, Vitest setup

### Tertiary (LOW confidence)
- Chokepoint coordinates - based on general geographic knowledge, needs validation with real position data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - recharts is the de facto React charting library, well-documented
- Architecture: HIGH - extends existing project patterns (API routes, Zustand, PostgreSQL)
- External APIs: MEDIUM - rate limits verified but production viability of NewsAPI unclear
- Chokepoint coords: LOW - general estimates, need refinement with real data
- Pitfalls: HIGH - common issues well-documented in API documentation

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (30 days - APIs are stable)
