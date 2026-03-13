# Phase 6: Data Wiring - Research

**Researched:** 2026-03-13
**Domain:** Data pipeline integration — AIS ingester startup, price/news/sanctions background refresh, system status bar
**Confidence:** HIGH (codebase directly inspected)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WIRE-01 | AIS ingester can be started with a single npm script command and logs startup status (connected / failed) to console | Ingester `index.ts` fully implemented; missing `npm run ingester` script in root `package.json` and uninstalled ingester-local deps |
| WIRE-02 | Oil price panel displays real WTI and Brent data fetched from Alpha Vantage with FRED as fallback | `fetchOilPrices()` exists and is correct; `insertPrice()` exists; **no caller writes prices to DB** — the gap |
| WIRE-03 | News panel displays real geopolitical headlines fetched from NewsAPI | `fetchNews()` exists; `insertNewsItem()` exists; **no caller writes news to DB** — the gap |
| WIRE-04 | Sanctions matching runs on ingested vessels and flags appear on sanctioned ships in the map | `fetchSanctionsList()` and `upsertSanction()` exist; `getVesselsWithSanctions()` JOIN is live; **no caller populates `vessel_sanctions` table** — the gap |
| WIRE-05 | Dashboard shows a system status bar indicating live/degraded/offline state for each data source (AIS, prices, news) | Status bar component does not exist; `/api/status` route does not exist — net new work |
| WIRE-06 | Anomaly detection cron jobs run on schedule and produce real alerts for watched vessels | Cron jobs coded in `detection-jobs.ts` and started from ingester `ws.on('open')` — fully wired; runs when ingester runs |
</phase_requirements>

---

## Summary

Phase 6 is primarily a **wiring and plumbing phase** — the building blocks all exist but the connections between them are incomplete. The external API fetchers (`fetchOilPrices`, `fetchNews`, `fetchSanctionsList`) are fully implemented and tested, the DB write functions (`insertPrice`, `insertNewsItem`, `upsertSanction`) are fully implemented, and the API read routes serve data from those tables. The missing piece in every case is the **background refresh loop that calls fetch → write on a schedule**.

The AIS ingester (`src/services/ais-ingester/index.ts`) is complete as a standalone Node.js service with WebSocket handling, GPS filtering, DB writes, and cron job startup — but there is no `npm run ingester` script in the root `package.json`, and the ingester's own `package.json` is missing `node-cron` in its dependencies (though `tsx` is listed for dev). The AIS env var `AISSTREAM_API_KEY` is already set in `.env.local` along with `ALPHA_VANTAGE_API_KEY`, `FRED_API_KEY`, and `NEWSAPI_KEY`.

The system status bar (WIRE-05) is net-new: no component, no API route. It requires a `/api/status` endpoint that probes each source and a `StatusBar` UI component in the dashboard header or layout.

**Primary recommendation:** Add three background refresh schedulers (prices, news, sanctions) — either as Next.js Route Handlers with `revalidate` + a cron trigger approach, or as additional jobs in the AIS ingester process. Then add a root `npm run ingester` script, fix the ingester's `package.json` deps, and build the status bar component backed by a `/api/status` probe endpoint.

---

## Current State Audit

### What is fully wired
| Component | File | Status |
|-----------|------|--------|
| AIS WebSocket ingester | `src/services/ais-ingester/index.ts` | Complete — connects, filters, writes positions |
| Anomaly detection crons | `src/services/ais-ingester/detection-jobs.ts` | Complete — fires on `ws.on('open')`, 15/30min schedules |
| Vessels API | `src/app/api/vessels/route.ts` | Reads DB with LEFT JOIN sanctions — works when data exists |
| Sanctions JOIN query | `src/lib/db/sanctions.ts` `getVesselsWithSanctions()` | Complete — flags show when `vessel_sanctions` is populated |
| Alpha Vantage fetcher | `src/lib/external/alphavantage.ts` | Complete — fetches WTI + BRENT |
| FRED fallback fetcher | `src/lib/external/fred.ts` | Complete — no API key required |
| NewsAPI fetcher | `src/lib/external/newsapi.ts` | Complete — keyword filtered, relevance scored |
| OpenSanctions fetcher | `src/lib/external/opensanctions.ts` | Complete — fetches + parses CSV |
| Prices DB CRUD | `src/lib/db/prices.ts` | Complete — `insertPrice` + `getLatestPrices` |
| News DB CRUD | `src/lib/db/news.ts` | Complete — `insertNewsItem` + `getLatestNews` |
| Sanctions DB CRUD | `src/lib/db/sanctions.ts` | Complete — `upsertSanction` + `getSanction` |
| Prices API route | `src/app/api/prices/route.ts` | Reads DB — returns empty array until DB is populated |
| News API route | `src/app/api/news/route.ts` | Reads DB — returns empty array until DB is populated |
| OilPricePanel | `src/components/panels/OilPricePanel.tsx` | Polls `/api/prices` every 60s — renders nothing when empty |
| NewsPanel | `src/components/panels/NewsPanel.tsx` | Polls `/api/news` every 5min — shows "No headlines available" |

### What is NOT wired (the gaps)
| Gap | Description | Impact |
|-----|-------------|--------|
| No prices background refresh | `fetchOilPrices()` + `insertPrice()` never called in production | Prices DB stays empty; panel shows nothing |
| No news background refresh | `fetchNews()` + `insertNewsItem()` never called in production | News DB stays empty; panel shows "No headlines available" |
| No sanctions seeder | `fetchSanctionsList()` + `upsertSanction()` never called in production | `vessel_sanctions` table empty; no red flags on map |
| No root ingester script | Root `package.json` has no `ingester` or `start:ingester` script | Can't start with single command from project root |
| Ingester missing deps | `node-cron` not in `src/services/ais-ingester/package.json` | `npm install` in ingester dir won't install it |
| No status bar | No `StatusBar` component, no `/api/status` route | WIRE-05 entirely absent |

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `node-cron` | 4.x | Schedule background refresh jobs | In root `node_modules`, not in ingester `package.json` |
| `pg` | 8.x | PostgreSQL pool for DB writes | Installed everywhere |
| `dotenv` | 16.x | Load env vars in ingester | In ingester `package.json` |
| `tsx` | 4.x | Run TypeScript directly (dev mode) | In ingester `devDependencies` only |

### For background refresh approach
Two viable approaches — the decision affects architecture:

**Option A: Refresh jobs inside the AIS ingester process**
Add price, news, and sanctions refresh crons to `detection-jobs.ts` (or a sibling `refresh-jobs.ts`). Single Node process handles all background work.
- Pro: One process to manage, env vars already loaded
- Pro: Consistent with existing cron pattern
- Con: Ingester must be running for prices/news to refresh

**Option B: Next.js Route Handler with external cron trigger**
Add `/api/refresh/prices`, `/api/refresh/news`, `/api/refresh/sanctions` routes that call fetch → insert. Trigger via a simple cron (e.g., `vercel.json` cron, or self-ping from ingester).
- Pro: Can refresh prices/news even without AIS connection
- Con: More routes; Vercel serverless requires external cron trigger

**Recommendation: Option A** — add refresh jobs to the ingester. All env vars already present, pattern is established, and for a personal app the ingester is always running alongside Next.js.

### For system status bar
| Approach | Description |
|----------|-------------|
| `/api/status` probe endpoint | Route handler that checks DB freshness + tries a lightweight API ping |
| `StatusBar` React component | Client component polling `/api/status` every 30-60s |

---

## Architecture Patterns

### Pattern 1: Refresh Job in Ingester (add to detection-jobs.ts or new file)

```typescript
// Source: existing pattern in src/services/ais-ingester/detection-jobs.ts
// Add prices refresh — every 60 minutes (Alpha Vantage free tier: 25 req/day)
cron.schedule('0 * * * *', async () => {
  const prices = await fetchOilPrices();
  for (const price of prices) {
    await insertPrice(price);
  }
});

// Add news refresh — every 30 minutes (NewsAPI free: 100 req/day)
cron.schedule('*/30 * * * *', async () => {
  const headlines = await fetchNews();
  for (const item of headlines) {
    await insertNewsItem({ ...item });
  }
});

// Add sanctions refresh — every 24 hours (large CSV, infrequent changes)
cron.schedule('0 2 * * *', async () => {
  const sanctions = await fetchSanctionsList();
  for (const entry of sanctions) {
    await upsertSanction(entry);
  }
});
```

**Rate limit budget (free tiers):**
- Alpha Vantage: 25 req/day → refresh every 60min = 48 req/day (EXCEEDS free tier for 2 symbols)
  - Fix: refresh every 6 hours = 8 req/day, or use FRED primary
  - Safer: try Alpha Vantage, always fall back to FRED (FRED is free, no daily limit)
- NewsAPI: 100 req/day → refresh every 30min = 48 req/day (within limit)
- OpenSanctions CSV: no stated limit, large file (~MB) → refresh once/day is correct

**Alpha Vantage rate limit reality check:** Free tier allows 25 req/day and 5 req/min. WTI + BRENT = 2 requests per refresh. Refreshing every 6 hours = 8 requests/day (safe). Refreshing every hour = 48 (unsafe). **Recommend: 6-hour interval, or rely on FRED as primary (no rate limit).**

### Pattern 2: Root npm Script for Ingester (WIRE-01)

The ingester's `dev` script is `tsx watch index.ts`. For a single-command launch from project root:

```json
// Root package.json addition
"scripts": {
  "ingester": "tsx src/services/ais-ingester/index.ts",
  "ingester:dev": "tsx watch src/services/ais-ingester/index.ts"
}
```

The root `node_modules` already has `tsx` available (as devDependency via `@vitejs/plugin-react` chain? — check). Actually `tsx` is NOT in root `package.json`. Must either add `tsx` to root devDependencies OR use `ts-node` OR compile first.

**Simpler approach:** Add `tsx` to root `devDependencies`, then the ingester script works cleanly. Or use `npx tsx` without installing.

**Recommendation:** Add `tsx` to root `devDependencies` and add `"ingester": "tsx src/services/ais-ingester/index.ts"` to root `package.json` scripts. Also add `node-cron` to the ingester's own `package.json` so standalone deploys work.

### Pattern 3: Status Bar — `/api/status` + `StatusBar` Component

```typescript
// /api/status/route.ts
// Returns { ais: 'live'|'degraded'|'offline', prices: 'live'|'degraded'|'offline', news: 'live'|'degraded'|'offline' }
// AIS: check max(time) from vessel_positions — live if < 5min ago
// Prices: check max(fetched_at) from oil_prices — live if < 2hr ago, degraded if < 24hr
// News: check max(created_at) from news_items — live if < 1hr ago, degraded if < 12hr
```

DB freshness checks are reliable, fast, and don't exhaust API rate limits. No external pings needed.

```typescript
// StatusBar component placement: in layout.tsx header bar
// Polls /api/status every 60s
// Per-source indicator: colored dot + label ("AIS LIVE", "PRICES DEGRADED", "NEWS OFFLINE")
// Terminal aesthetic: amber = live, yellow = degraded, red = offline
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom `setTimeout` loops | `node-cron` (already installed) | Handles timezone, missed fires, DST edge cases |
| Rate limit retry | Manual sleep loops | Existing try/catch with FRED fallback | Already implemented in `fetchOilPrices()` |
| CSV parsing | Manual string split | `papaparse` (already installed) | Handles quoting, encoding, large files |
| API status health check | External ping to APIs | DB freshness query | Avoids rate limit consumption; more reliable |

---

## Common Pitfalls

### Pitfall 1: Alpha Vantage Rate Limit Exhaustion
**What goes wrong:** Refreshing prices every 60 minutes calls 2 endpoints × 24 = 48 requests/day, exceeding the 25 req/day free tier. The API returns a `Note` field (not HTTP error) when rate-limited — the existing parser checks for this and throws, triggering FRED fallback.
**How to avoid:** Set price refresh interval to every 6 hours (8 req/day). Alternatively, use FRED as the primary source since it has no stated daily limit. The existing `fetchOilPrices()` fallback chain handles this automatically.
**Warning signs:** `Alpha Vantage rate limit:` in ingester console logs.

### Pitfall 2: Import Path Resolution in Standalone Ingester
**What goes wrong:** `detection-jobs.ts` imports from `../../lib/detection/going-dark` and `../../lib/db/alerts`. When running via `tsx src/services/ais-ingester/index.ts` from the project root, relative paths resolve to `src/lib/detection/going-dark` — this works correctly. But `src/lib/db/sanctions.ts` uses `@/types/vessel` which would fail if the ingester's own tsconfig doesn't include the `@/*` path alias.
**Current state:** `detection-jobs.ts` imports do NOT use `@/` aliases — they use relative `../../` paths. `going-dark.ts` imports `pool` from `../db` (relative) and `Confidence` from `../../types/anomaly` (relative). Clean.
**Watch for:** Any new imports added to the refresh jobs that use `@/` alias. Use relative paths in ingester-adjacent files.

### Pitfall 3: Ingester `package.json` Missing `node-cron`
**What goes wrong:** The standalone ingester `package.json` doesn't list `node-cron`. Running `npm install` inside `src/services/ais-ingester/` and then starting the service will fail with module not found.
**How to avoid:** Add `node-cron` to the ingester's `package.json` dependencies. When running from project root with `tsx`, it uses the root `node_modules` where `node-cron` IS installed — so root-based startup works, but standalone deployment (Railway/Render) will break without the fix.

### Pitfall 4: Sanctions Table Empty vs. Table Missing
**What goes wrong:** The `getVesselsWithSanctions()` query uses LEFT JOIN — so if `vessel_sanctions` is empty (no seeder has run), all vessels return with `isSanctioned: false`. This is correct behavior, not a bug. The UI already handles this. But a first-time seeder run on a large OpenSanctions CSV takes time (thousands of upserts).
**How to avoid:** Run the sanctions seeder once on startup (not just on a cron) to populate immediately. Then refresh daily.

### Pitfall 5: Status Bar Shows "Offline" on First Start
**What goes wrong:** Before prices/news refresh crons have fired, the DB tables are empty. A DB-freshness-based status check will return "offline" for prices and news immediately after deployment — even though the APIs are working.
**How to avoid:** Trigger prices, news, AND sanctions refresh immediately on ingester startup (not just on first cron fire). Add an initial eager fetch before starting the scheduled intervals.

### Pitfall 6: `OilPricePanel` Shows Nothing (Silent Empty State)
**What goes wrong:** `OilPricePanel` renders `null` when `prices.length === 0`. The panel disappears silently. Until the DB has data, users see a blank area with no explanation.
**How to avoid:** This is acceptable behavior once the ingester is wired. Add a loading/waiting state if desired, but the requirement only asks for real data to appear — not for graceful empty states.

---

## Code Examples

### Adding refresh to detection-jobs.ts (new exports)

```typescript
// Source: pattern from existing detection-jobs.ts in src/services/ais-ingester/
// Add to imports at top:
import { fetchOilPrices } from '../../lib/prices/fetcher';
import { insertPrice } from '../../lib/db/prices';
import { fetchNews } from '../../lib/news/fetcher';
import { insertNewsItem } from '../../lib/db/news';
import { fetchSanctionsList } from '../../lib/external/opensanctions';
import { upsertSanction } from '../../lib/db/sanctions';
```

### /api/status route pattern

```typescript
// GET /api/status — checks DB freshness for each source
// Returns within ~100ms (3 COUNT/MAX queries in parallel)
const [aisResult, pricesResult, newsResult] = await Promise.all([
  pool.query(`SELECT MAX(time) as last_update FROM vessel_positions`),
  pool.query(`SELECT MAX(fetched_at) as last_update FROM oil_prices`),
  pool.query(`SELECT MAX(created_at) as last_update FROM news_items`),
]);
```

### Root package.json script addition

```json
"ingester": "tsx src/services/ais-ingester/index.ts",
"ingester:dev": "tsx watch src/services/ais-ingester/index.ts"
```

### StatusBar component structure

```tsx
// src/components/ui/StatusBar.tsx
// Polls /api/status every 60 seconds
// Three indicators: AIS, PRICES, NEWS
// States: live (amber dot), degraded (yellow dot), offline (red dot)
// Placement: header bar, right side, after nav links
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| API routes call external APIs on every request | Background refresh writes to DB; routes read from DB | Prevents rate limit exhaustion; faster response times |
| External API health check via live ping | DB freshness timestamp check | No rate limit cost; works offline |

---

## Open Questions

1. **Where to add the refresh cron jobs?**
   - What we know: Can go in `detection-jobs.ts` (extend existing pattern) or a new `refresh-jobs.ts` file
   - Recommendation: New `refresh-jobs.ts` file called from ingester `ws.on('open')` alongside `startDetectionJobs()` — keeps concerns separated

2. **Alpha Vantage vs. FRED as effective primary for prices**
   - What we know: FRED has no stated daily limit; Alpha Vantage free tier is 25 req/day; existing code already tries AV first and falls back to FRED on error
   - Recommendation: Keep existing fallback chain but set refresh interval to 6 hours to stay within AV limits. FRED will serve when AV rate limit is hit.

3. **Status bar placement in UI**
   - What we know: Dashboard uses CSS Grid with a header bar; header is in `src/app/(protected)/page.tsx` or layout
   - Recommendation: Place StatusBar in the main dashboard header row (right side), not on the analytics page — keeps it visible on the primary live view

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIRE-01 | Ingester starts and logs "Connected" or startup failure | smoke/manual | Run `npm run ingester` manually, observe console | N/A (runtime) |
| WIRE-02 | `fetchOilPrices` writes to DB; prices API returns real data | unit | `npm test -- --run src/lib/prices/fetcher.test.ts` | Exists — tests fetcher logic |
| WIRE-03 | `fetchNews` writes to DB; news API returns real headlines | unit | `npm test -- --run src/lib/news/fetcher.test.ts` | Exists — tests fetcher logic |
| WIRE-04 | `fetchSanctionsList` populates DB; vessels show sanctions flag | unit | `npm test -- --run src/lib/external/opensanctions.test.ts` | Exists — tests CSV parsing |
| WIRE-05 | `/api/status` returns correct state based on DB freshness | unit | `npm test -- --run src/app/api/status/route.test.ts` | ❌ Wave 0 |
| WIRE-06 | Cron jobs fire on schedule and generate alerts | unit | `npm test -- --run src/services/ais-ingester/detection-jobs.test.ts` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `src/app/api/status/route.test.ts` — covers WIRE-05 (status endpoint returns correct states)
- [ ] `src/services/ais-ingester/detection-jobs.test.ts` — covers WIRE-06 (cron job scheduling wired)
- [ ] `src/services/ais-ingester/refresh-jobs.test.ts` — covers WIRE-02/03/04 (refresh jobs call correct functions)

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/services/ais-ingester/index.ts`, `detection-jobs.ts`, `package.json`
- Direct codebase inspection: `src/lib/external/alphavantage.ts`, `fred.ts`, `newsapi.ts`, `opensanctions.ts`
- Direct codebase inspection: `src/lib/db/prices.ts`, `news.ts`, `sanctions.ts`
- Direct codebase inspection: `src/app/api/prices/route.ts`, `news/route.ts`, `vessels/route.ts`
- Direct codebase inspection: `.env.local` — all 4 external API keys confirmed present
- Direct codebase inspection: root `package.json` — no ingester script present

### Secondary (MEDIUM confidence)
- Alpha Vantage free tier limits: 25 requests/day, 5 requests/minute (per API docs, consistent with `Note` field handling in `alphavantage.ts`)
- FRED API: no stated daily limit, public data
- NewsAPI free tier: 100 requests/day (per newsapi.org)

---

## Metadata

**Confidence breakdown:**
- Current state audit: HIGH — directly read every relevant file
- Standard stack: HIGH — already installed, no new libraries needed except `tsx` in root
- Architecture: HIGH — follows existing patterns in codebase
- API rate limits: MEDIUM — from API documentation, verified by code's existing handling
- Pitfalls: HIGH — identified from direct code inspection

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain; API rate limits unlikely to change)
