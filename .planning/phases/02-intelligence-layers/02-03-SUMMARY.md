---
phase: 02-intelligence-layers
plan: 03
subsystem: api, ui
tags: [alpha-vantage, fred, newsapi, recharts, oil-prices, news-feed, sparkline]

# Dependency graph
requires:
  - phase: 02-01
    provides: oil_prices and news_items database schema
  - phase: 01-05
    provides: dashboard page layout and panel positioning
provides:
  - Oil price fetchers (Alpha Vantage primary, FRED fallback)
  - NewsAPI fetcher with keyword-based relevance scoring
  - Prices and news database CRUD operations
  - /api/prices and /api/news REST endpoints
  - OilPricePanel component with sparklines
  - NewsPanel collapsible sidebar component
  - Sparkline chart component using recharts
affects: [02-04, 02-05, dashboard, data-refresh-jobs]

# Tech tracking
tech-stack:
  added: [lucide-react]
  patterns: [API fallback pattern, keyword relevance scoring, sparkline visualization]

key-files:
  created:
    - src/lib/external/alphavantage.ts
    - src/lib/external/fred.ts
    - src/lib/external/newsapi.ts
    - src/lib/db/prices.ts
    - src/lib/db/news.ts
    - src/app/api/prices/route.ts
    - src/app/api/news/route.ts
    - src/components/charts/Sparkline.tsx
    - src/components/panels/OilPricePanel.tsx
    - src/components/panels/NewsPanel.tsx
  modified:
    - src/lib/prices/fetcher.ts
    - src/lib/news/fetcher.ts
    - src/app/(protected)/dashboard/page.tsx

key-decisions:
  - "Alpha Vantage primary with FRED fallback for oil price redundancy"
  - "Keyword-based relevance scoring for news filtering"
  - "60-second refresh for prices, 5-minute refresh for news"
  - "Sparkline uses recharts AreaChart for minimal footprint"

patterns-established:
  - "API fallback pattern: try primary, catch and fallback, catch and return empty"
  - "Relevance scoring: count keyword matches for priority ordering"
  - "Panel positioning: absolute top-right with z-index layering"

requirements-completed: [INTL-02, INTL-03]

# Metrics
duration: 6min
completed: 2026-03-12
---

# Phase 02 Plan 03: Oil Prices and News Panels Summary

**Oil price panel with WTI/Brent sparklines from Alpha Vantage (FRED fallback) and collapsible news feed with keyword-filtered headlines from NewsAPI**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-12T05:46:26Z
- **Completed:** 2026-03-12T05:51:55Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments
- Alpha Vantage + FRED dual-source oil price fetching with automatic fallback
- NewsAPI headline fetching with keyword relevance scoring (16 keywords)
- Sparkline chart component rendering 30-day price history
- Floating OilPricePanel showing WTI/Brent with color-coded changes
- Collapsible NewsPanel with scrollable headline list

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement oil price fetchers (Alpha Vantage + FRED fallback)** - `8517306` (feat)
2. **Task 2: Implement news fetcher and database storage** - `032eb19` (feat)
3. **Task 3: Create API routes and UI panels for prices and news** - `c614bdd` (feat)

## Files Created/Modified
- `src/lib/external/alphavantage.ts` - Alpha Vantage WTI/Brent price fetcher
- `src/lib/external/fred.ts` - FRED API fallback fetcher
- `src/lib/external/newsapi.ts` - NewsAPI headline fetcher with relevance scoring
- `src/lib/db/prices.ts` - Oil prices CRUD (insertPrice, getLatestPrices)
- `src/lib/db/news.ts` - News CRUD (insertNewsItem, getLatestNews, purgeOldNews)
- `src/lib/prices/fetcher.ts` - Orchestrating fetcher with fallback pattern
- `src/lib/news/fetcher.ts` - News fetcher wrapper
- `src/app/api/prices/route.ts` - GET /api/prices endpoint
- `src/app/api/news/route.ts` - GET /api/news endpoint
- `src/components/charts/Sparkline.tsx` - Recharts-based sparkline component
- `src/components/panels/OilPricePanel.tsx` - Floating price display panel
- `src/components/panels/NewsPanel.tsx` - Collapsible news sidebar
- `src/app/(protected)/dashboard/page.tsx` - Updated to include new panels

## Decisions Made
- Alpha Vantage as primary source (free tier with WTI/BRENT endpoints)
- FRED as fallback using DCOILWTICO and DCOILBRENTEU series
- 60-second polling interval for prices (balance freshness vs rate limits)
- 5-minute polling interval for news (headlines don't change rapidly)
- 16 keywords for relevance filtering including oil, tanker, Iran, OPEC, sanctions, Red Sea, Houthi

## Deviations from Plan

None - plan executed exactly as written.

## Discovered Issues (Out of Scope)

Pre-existing TypeScript error in `src/components/panels/VesselPanel.tsx:105` blocks production builds. This error existed before this plan's execution (introduced in 02-02). Logged to `deferred-items.md` for later resolution.

## User Setup Required

**External services require API keys.** Add to `.env`:
```
ALPHA_VANTAGE_API_KEY=your_key_here
FRED_API_KEY=your_key_here  # Optional, required for fallback
NEWSAPI_KEY=your_key_here
```

API key sources:
- Alpha Vantage: https://www.alphavantage.co/support/#api-key (free tier)
- FRED: https://fred.stlouisfed.org/docs/api/api_key.html (free tier)
- NewsAPI: https://newsapi.org/register (free tier for development)

## Next Phase Readiness
- Oil prices API ready for scheduled refresh jobs
- News API ready for scheduled fetch and database storage
- UI panels integrated and ready for visual testing
- Requires cron job setup in 02-05 to populate database with real data

## Self-Check: PASSED

All created files verified:
- src/lib/external/alphavantage.ts
- src/lib/external/fred.ts
- src/lib/external/newsapi.ts
- src/lib/db/prices.ts
- src/lib/db/news.ts
- src/app/api/prices/route.ts
- src/app/api/news/route.ts
- src/components/charts/Sparkline.tsx
- src/components/panels/OilPricePanel.tsx
- src/components/panels/NewsPanel.tsx

All commits verified: 8517306, 032eb19, c614bdd

---
*Phase: 02-intelligence-layers*
*Completed: 2026-03-12*
