---
phase: 06-data-wiring
verified: 2026-03-13T10:37:00Z
status: human_needed
score: 9/9 automated must-haves verified
re_verification: false
human_verification:
  - test: "Run `npm run ingester` and confirm startup log output within 10 seconds"
    expected: "'Starting anomaly detection cron jobs...' and 'Refresh cron jobs scheduled: prices every 6h, news every 30m, sanctions daily' appear in console"
    why_human: "Requires live environment with DATABASE_URL and AISSTREAM_API_KEY set; can't execute ingester in static analysis"
  - test: "After ingester runs for ~30s, check console for eager-fetch log lines"
    expected: "'[STARTUP] Prices fetched: N symbols', '[STARTUP] News fetched: N headlines', '[STARTUP] Sanctions fetched: N entries'"
    why_human: "Requires live API keys (Alpha Vantage, NewsAPI, OpenSanctions) and a running DB"
  - test: "Open http://localhost:3000/dashboard and verify the oil price panel"
    expected: "WTI and Brent values display dollar amounts — not blank, null, or 'No data'"
    why_human: "Visual UI state requiring a populated DB after ingester runs"
  - test: "Open http://localhost:3000/dashboard and verify the news panel"
    expected: "Geopolitical headlines appear — not 'No headlines available'"
    why_human: "Visual UI state requiring a populated DB after ingester runs"
  - test: "Inspect the dashboard header right side for the StatusBar"
    expected: "Three compact indicators labeled AIS, PRICES, NEWS with colored dots are visible after NotificationBell"
    why_human: "Visual rendering; StatusBar starts in null/loading state and only shows live status after /api/status responds"
  - test: "Wait 60 seconds on dashboard and confirm StatusBar updates without page refresh"
    expected: "Dot colors and label colors update to reflect current DB freshness"
    why_human: "Requires observing real-time setInterval polling behavior"
---

# Phase 6: Data Wiring Verification Report

**Phase Goal:** Every data source is connected and delivering real data end-to-end — AIS ingester runs with a single command, prices and news come from live APIs, sanctions flags appear on ingested vessels, anomaly crons fire on schedule, and a system status bar shows the health of each source
**Verified:** 2026-03-13T10:37:00Z
**Status:** human_needed — all automated checks pass; live behavior requires human confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm run ingester` starts the ingester via tsx | VERIFIED | `package.json` scripts.ingester = `tsx src/services/ais-ingester/index.ts`; tsx@^4.7.0 in devDependencies |
| 2 | Oil prices are written to DB via a scheduled refresh job (every 6 hours) | VERIFIED | `refresh-jobs.ts` lines 87-100: `cron.schedule('0 */6 * * *', ...)` calls `fetchOilPrices()` + `insertPrice()` per result |
| 3 | News headlines are written to DB via a scheduled refresh job (every 30 minutes) | VERIFIED | `refresh-jobs.ts` lines 102-115: `cron.schedule('*/30 * * * *', ...)` calls `fetchNews()` + `insertNewsItem()` per result |
| 4 | Sanctions list is written to DB via a refresh job that runs on startup then daily | VERIFIED | `refresh-jobs.ts` lines 117-129: `cron.schedule('0 2 * * *', ...)` with eager fetch on startup; `eagerFetchSanctions()` called at line 85 |
| 5 | Eager startup fetch runs all three fetchers immediately on startRefreshJobs() call | VERIFIED | Lines 81-85 of refresh-jobs.ts call `eagerFetchPrices()`, `eagerFetchNews()`, `eagerFetchSanctions()` before any cron scheduling |
| 6 | startRefreshJobs() is called inside ws.on('open', ...) in index.ts | VERIFIED | index.ts line 198: `startRefreshJobs()` called immediately after `startDetectionJobs()` |
| 7 | GET /api/status returns JSON with ais/prices/news classified as live/degraded/offline | VERIFIED | route.ts: 3 parallel `Promise.all` DB queries + `classify()` function; 8 unit tests pass |
| 8 | StatusBar component polls /api/status and renders three source indicators | VERIFIED | StatusBar.tsx: `fetch('/api/status')` on mount + 60s setInterval; renders Indicator for AIS, Prices, News |
| 9 | StatusBar is rendered in the dashboard Header | VERIFIED | Header.tsx line 77: `<StatusBar />` as last child of right flex row after NotificationBell |

**Score:** 9/9 automated truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/ais-ingester/refresh-jobs.ts` | Background cron jobs for prices/news/sanctions + eager fetch | VERIFIED | 133 lines; exports `startRefreshJobs()`; relative imports only (no @/ alias); all three cron schedules present |
| `src/services/ais-ingester/refresh-jobs.test.ts` | Unit test scaffold for refresh jobs | VERIFIED | 77 lines; 4 passing tests, 3 todo stubs; mocks all external imports |
| `package.json` | Root `ingester` npm script | VERIFIED | `"ingester": "tsx src/services/ais-ingester/index.ts"`; `"ingester:dev"` variant also present; tsx@^4.7.0 in devDependencies |
| `src/services/ais-ingester/package.json` | node-cron dependency | VERIFIED | `"node-cron": "^4.0.0"` in dependencies |
| `src/services/ais-ingester/index.ts` | Calls startRefreshJobs() alongside startDetectionJobs() | VERIFIED | Lines 197-198: both called in `ws.on('open', ...)` handler |
| `src/app/api/status/route.ts` | GET handler with DB freshness logic | VERIFIED | 43 lines; exports `GET` and `classify()`; 3 parallel queries via `Promise.all`; returns `NextResponse.json({ ais, prices, news })` |
| `src/app/api/status/route.test.ts` | Unit tests for status endpoint | VERIFIED | 119 lines; 8 tests covering live/degraded/offline/null and HTTP response shape |
| `src/components/ui/StatusBar.tsx` | Client component polling /api/status | VERIFIED | 76 lines; `'use client'` directive; `useEffect` with `setInterval(fetchStatus, 60*1000)` and `clearInterval` cleanup; renders 3 Indicator children |
| `src/components/ui/Header.tsx` | StatusBar imported and rendered | VERIFIED | Line 16: `import { StatusBar } from './StatusBar'`; line 77: `<StatusBar />` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/ais-ingester/index.ts` | `refresh-jobs.ts` | `startRefreshJobs()` in ws.on('open') | WIRED | Line 22 import; line 198 call |
| `refresh-jobs.ts` | `src/lib/prices/fetcher.ts` | `fetchOilPrices()` relative import | WIRED | Line 18: `import { fetchOilPrices } from '../../lib/prices/fetcher'` |
| `refresh-jobs.ts` | `src/lib/db/prices.ts` | `insertPrice()` relative import | WIRED | Line 19: `import { insertPrice } from '../../lib/db/prices'` |
| `refresh-jobs.ts` | `src/lib/news/fetcher.ts` | `fetchNews()` relative import | WIRED | Line 20: `import { fetchNews } from '../../lib/news/fetcher'` |
| `refresh-jobs.ts` | `src/lib/db/news.ts` | `insertNewsItem()` relative import | WIRED | Line 21: `import { insertNewsItem } from '../../lib/db/news'` |
| `refresh-jobs.ts` | `src/lib/external/opensanctions.ts` | `fetchSanctionsList()` relative import | WIRED | Line 22: `import { fetchSanctionsList } from '../../lib/external/opensanctions'` |
| `refresh-jobs.ts` | `src/lib/db/sanctions.ts` | `upsertSanction()` relative import | WIRED | Line 23: `import { upsertSanction } from '../../lib/db/sanctions'` |
| `StatusBar.tsx` | `/api/status` | `fetch('/api/status')` in useEffect + 60s setInterval | WIRED | Lines 53-54: fetch call; lines 55-57: response read + setStatus(data) |
| `Header.tsx` | `StatusBar.tsx` | Import + rendered in right flex row | WIRED | Line 16 import; line 77 JSX render |
| `route.ts` | PostgreSQL pool | 3 parallel `pool.query()` calls via `Promise.all` | WIRED | Lines 31-34: queries `vessel_positions`, `oil_prices`, `news_items` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WIRE-01 | 06-01 | AIS ingester starts with single npm script, logs connected/failed | SATISFIED | `package.json` scripts.ingester exists; index.ts logs startup status; tsx devDependency present |
| WIRE-02 | 06-01 | Oil price panel displays real WTI and Brent data from Alpha Vantage/FRED | PARTIAL (code complete; live data needs human) | refresh-jobs.ts prices cron + eager fetch wired to `fetchOilPrices()` + `insertPrice()`; UI panel display requires live API run |
| WIRE-03 | 06-01 | News panel displays real geopolitical headlines from NewsAPI | PARTIAL (code complete; live data needs human) | refresh-jobs.ts news cron + eager fetch wired to `fetchNews()` + `insertNewsItem()`; UI panel display requires live API run |
| WIRE-04 | 06-01 | Sanctions matching runs on ingested vessels, flags appear on map | PARTIAL (code complete; live data needs human) | refresh-jobs.ts sanctions cron + eager fetch wired to `fetchSanctionsList()` + `upsertSanction()`; map flag rendering requires live ingester run |
| WIRE-05 | 06-02 | Dashboard shows system status bar indicating live/degraded/offline per source | SATISFIED (automated); NEEDS HUMAN (visual) | /api/status route exists with classify(); StatusBar wired in Header; visual confirmation needs human |
| WIRE-06 | 06-03 | Anomaly detection cron jobs run on schedule and produce real alerts | SATISFIED (code pre-existing + wired) | detection-jobs.ts: 15-min going-dark cron + 30-min route anomaly cron; both called from index.ts ws.on('open'); logs startup confirmation |

**Note on WIRE-06:** Plan 06-01 and 06-03 claim WIRE-06. The detection-jobs.ts implementation predates Phase 6 (carries ANOM-01/ANOM-02 requirements). Phase 6 wired it by ensuring `startDetectionJobs()` is called in the same `ws.on('open')` handler alongside `startRefreshJobs()`. The code is fully present and wired — human verification is needed only to confirm cron log lines appear in a live run.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `refresh-jobs.test.ts` | 74-76 | 3 `it.todo()` stubs for cron timer tests | Info | Intentional per plan — scoped out due to fake-timer complexity; eager-fetch coverage is the critical path |

No blockers or warnings found. All implementation bodies are substantive with full try/catch, real DB writes, and proper cron schedules.

---

## Commit Verification

All implementation commits confirmed in git log:

| Commit | Description |
|--------|-------------|
| `700c31d` | feat(06-01): create refresh-jobs.ts with eager startup fetch and cron schedule |
| `6c64c4d` | feat(06-01): wire startRefreshJobs into ingester and add npm scripts |
| `a381d00` | feat(06-02): add /api/status endpoint with DB freshness classification |
| `de8d320` | feat(06-02): add StatusBar component and integrate into Header |

---

## Human Verification Required

The following items cannot be verified programmatically. They require a running environment with valid API keys and a live database.

### 1. Ingester startup console output (WIRE-01)

**Test:** Run `npm run ingester` from project root
**Expected:** Within 10 seconds — `Starting anomaly detection cron jobs...` and `Refresh cron jobs scheduled: prices every 6h, news every 30m, sanctions daily` visible in console; AISStream connection either confirms or shows API key error
**Why human:** Requires DATABASE_URL and AISSTREAM_API_KEY env vars and a live PostgreSQL instance

### 2. Eager startup data fetch log lines (WIRE-02, WIRE-03, WIRE-04)

**Test:** After ~30 seconds of ingester running, observe console
**Expected:** `[STARTUP] Prices fetched: N symbols`, `[STARTUP] News fetched: N headlines`, `[STARTUP] Sanctions fetched: N entries`
**Why human:** Requires live Alpha Vantage, NewsAPI, and OpenSanctions API keys returning real data

### 3. Oil price panel shows real WTI/Brent values (WIRE-02)

**Test:** Open dashboard after ingester has run; check oil price panel
**Expected:** Dollar amounts for WTI and Brent — not blank, null, or "No data"
**Why human:** Visual UI state; depends on DB being populated by eager fetch

### 4. News panel shows real headlines (WIRE-03)

**Test:** Open dashboard after ingester has run; check news panel
**Expected:** Geopolitical headlines visible — not "No headlines available"
**Why human:** Visual UI state; depends on DB being populated by eager fetch

### 5. StatusBar visible in header (WIRE-05)

**Test:** Open http://localhost:3000/dashboard; inspect header right side after NotificationBell
**Expected:** Three compact dot indicators labeled AIS, PRICES, NEWS with appropriate colors (amber=live, yellow=degraded, red=offline)
**Why human:** Visual rendering; initial null state means dots are gray until /api/status responds

### 6. StatusBar auto-updates every 60 seconds (WIRE-05)

**Test:** Remain on dashboard for 60+ seconds; observe indicator colors
**Expected:** Colors reflect current DB freshness without page refresh
**Why human:** Requires observing real-time polling behavior

### 7. Anomaly detection crons confirmed in ingester console (WIRE-06)

**Test:** In ingester console from test 1, confirm:
**Expected:** `Detection cron jobs scheduled:` with `going_dark: every 15 minutes` and `loitering/speed: every 30 minutes`
**Why human:** Requires live ingester run with active WebSocket connection

---

## Summary

All automated verification passes. Phase 6 delivered its core infrastructure in 4 commits across 2 execution plans:

- **Plan 01** created `refresh-jobs.ts` with eager startup fetches and three cron schedules (prices/6h, news/30m, sanctions/daily), wired `startRefreshJobs()` into the ingester's WebSocket open handler, and added the `npm run ingester` script to the project root.
- **Plan 02** created the `/api/status` endpoint with parallel DB freshness queries and a `classify()` function tested with 8 unit tests, plus a `StatusBar` client component wired into the dashboard header.

The code is substantive, correctly structured, and wired end-to-end. All 12 automated tests pass (plus 3 intentional todos for cron-timer edge cases scoped out by design). WIRE-06 (anomaly detection crons) is satisfied by the pre-existing `detection-jobs.ts` which was already wired into the ingester — Phase 6 confirmed its integration alongside the new refresh jobs.

The 7 items flagged for human verification are all live-environment behaviors (API responses, visual rendering, real-time updates) that cannot be asserted through static code analysis.

---

_Verified: 2026-03-13T10:37:00Z_
_Verifier: Claude (gsd-verifier)_
