---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/prices/fetcher.ts
autonomous: true
requirements: [WIRE-02]
must_haves:
  truths:
    - "Oil price panel shows last known WTI and BRENT prices when both Alpha Vantage and FRED are unavailable"
    - "Prices are never $0.00 due to API failure if DB has prior data"
  artifacts:
    - path: "src/lib/prices/fetcher.ts"
      provides: "fetchOilPrices with DB last-known fallback"
      contains: "getLatestPrices"
  key_links:
    - from: "src/lib/prices/fetcher.ts"
      to: "src/lib/db/prices.ts"
      via: "import getLatestPrices"
      pattern: "getLatestPrices"
---

<objective>
When both Alpha Vantage and FRED fail, `fetchOilPrices()` currently returns `[]`. The cron job then has nothing to insert, so `getLatestPrices()` returns the stale-but-correct DB rows — but only if they were ever populated. On a cold start (DB empty) or in production with a bad API key, the panel shows nothing.

The real problem: `fetchOilPrices()` returns `[]` on dual-API failure, which the cron job logs silently and the eager startup also silences. Meanwhile `OilPricePanel` renders nothing when `prices` is empty.

Purpose: Show last known prices from DB instead of showing nothing when the live APIs are down.
Output: Modified `fetchOilPrices()` that falls back to DB-persisted prices, and a DB helper that maps stored rows back to `OilPriceData` shape.
</objective>

<execution_context>
@/Users/randyren/.claude/get-shit-done/workflows/execute-plan.md
@/Users/randyren/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Key interfaces
# src/lib/db/prices.ts exports:
#   getLatestPrices(): Promise<{ symbol, price, change, changePercent, history }[]>
#   insertPrice(price: OilPriceData): Promise<void>
#
# src/lib/external/alphavantage.ts exports:
#   interface OilPriceData { symbol: 'WTI'|'BRENT'; current: number; change: number; changePercent: number; history: OilPricePoint[] }
#   interface OilPricePoint { date: Date; price: number }
#
# src/lib/prices/fetcher.ts exports:
#   fetchOilPrices(): Promise<OilPriceData[]>  — current: returns [] on both-API fail
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add DB last-known fallback to fetchOilPrices</name>
  <files>src/lib/prices/fetcher.ts, src/lib/prices/fetcher.test.ts</files>
  <behavior>
    - When both Alpha Vantage and FRED throw, fetchOilPrices queries the DB via getLatestPrices()
    - getLatestPrices rows are mapped to OilPriceData shape: { symbol, current: price, change, changePercent, history: history.map(h => ({ date: new Date(), price: h.value })) }
    - If DB also returns empty array, fetchOilPrices returns []
    - If DB returns rows, fetchOilPrices returns those rows as OilPriceData[] (APIs did not succeed — no insert happens)
    - Existing behavior when APIs succeed is unchanged
  </behavior>
  <action>
    In `src/lib/prices/fetcher.ts`:

    1. Add import: `import { getLatestPrices } from '../db/prices';`

    2. In the outer catch block (after FRED also fails), replace `return []` with:
       ```typescript
       console.warn('Both APIs failed, using last known DB prices');
       const dbRows = await getLatestPrices();
       if (dbRows.length === 0) return [];
       return dbRows.map(row => ({
         symbol: row.symbol as 'WTI' | 'BRENT',
         current: row.price,
         change: row.change,
         changePercent: row.changePercent,
         history: row.history.map(h => ({ date: new Date(), price: h.value })),
       }));
       ```

    The DB fallback only runs when BOTH external APIs throw. It does NOT insert to DB (that would overwrite fresh data with stale data — avoid).

    In `src/lib/prices/fetcher.test.ts`, add a test case:
    - Mock `fetchAlphaVantagePrices` to throw
    - Mock `fetchFREDPrices` to throw
    - Mock `getLatestPrices` to return `[{ symbol: 'WTI', price: 75.5, change: -0.5, changePercent: -0.66, history: [{ value: 75.5 }] }]`
    - Assert `fetchOilPrices()` returns array with `symbol: 'WTI'` and `current: 75.5`
  </action>
  <verify>
    <automated>cd /Users/randyren/Developer/tanker-tracker && npx jest src/lib/prices/fetcher.test.ts --no-coverage 2>&1 | tail -20</automated>
  </verify>
  <done>fetchOilPrices returns last-known DB rows when both APIs fail; existing tests still pass; new test covers DB fallback path</done>
</task>

</tasks>

<verification>
Run: `npx jest src/lib/prices/fetcher.test.ts --no-coverage`
All tests pass, including the new DB fallback case.
</verification>

<success_criteria>
- fetchOilPrices returns populated OilPriceData[] from DB when both external APIs are unavailable
- OilPricePanel shows last-known prices instead of disappearing when APIs are rate-limited or down
- No regression in existing tests
</success_criteria>

<output>
After completion, create `.planning/quick/4-persist-last-known-oil-price-instead-of-/4-SUMMARY.md`
</output>
