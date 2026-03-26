# Knowledge Base

## Cross-route entity selection via pending identifier

**Context:** When navigating between routes where the source page has partial data (e.g. just an IMO number) but the destination needs a full object (e.g. `VesselWithSanctions`), use a pending identifier in the global store.

**Pattern:**
1. Source page calls `store.setTargetId(id)` + `store.setMapCenter(coords)` before `router.push()`
2. Destination page's data-consuming component has a `useEffect` watching `[targetId, dataArray]`
3. When both are available, find the match, call `setSelected(match)`, clear the target to `null`
4. If no match found, `console.warn` (don't silently discard — inspectable failure matters)

**Gotcha:** The effect fires immediately when the component mounts, even before data loads. Guard with `if (!targetId || dataArray.length === 0) return;` to avoid premature failure warnings. The effect re-runs when data arrives, so it self-heals.

**Files:** `src/stores/vessel.ts` (store), `src/components/map/VesselMap.tsx` (consumer), `src/components/fleet/FleetVesselDetail.tsx` (producer)

## Imperative Zustand store access in event handlers

**Pattern:** Use `useVesselStore.getState().someAction()` for imperative store access in event handlers that run outside React's render cycle (e.g. `handleShowOnMap`). This avoids stale closure issues when accessing store actions in callbacks constructed during render.

**Why not hooks:** Inside a `useCallback` or event handler, the hook-based selector (`const action = useVesselStore(s => s.action)`) captures the value at render time. If you need the latest state or action at call time, `getState()` is more reliable.

## Position extraction varies by anomaly type

**Context:** Not all anomaly types carry position data. `going_dark` has `lastPosition`, `loitering` has `centroid`, `speed` has `lastPosition`, `sts_transfer` has `lat/lon`. But `deviation` and `repeat_going_dark` have no single-point position.

**Impact:** Any feature that maps anomalies to coordinates must handle `null` positions. The "Show on Map" button in `FleetVesselDetail` disables itself when `extractPosition()` returns `null`. If new anomaly types are added, update the switch statement in `extractPosition()`.

**File:** `src/components/fleet/FleetVesselDetail.tsx`

## Client-side grouping threshold

**Context:** The `/fleet` page groups anomalies by type entirely on the client after fetching the full `/api/anomalies` payload. This works well for typical fleet sizes (hundreds to low thousands of anomalies).

**Threshold:** If the anomaly dataset grows beyond ~10k entries, move grouping and pagination to the server side. Signs you've hit this: slow initial render on `/fleet`, high memory usage in browser DevTools, or visible UI jank when the page loads.

**File:** `src/app/(protected)/fleet/page.tsx` (`groupByType` function)

## API endpoint enrichment via SQL JOINs

**Pattern:** When a list endpoint needs related data from multiple tables (e.g. anomalies + vessel names + risk scores), enrich at the SQL level with LEFT JOINs rather than making N+1 client-side fetches. The `/api/anomalies` endpoint joins `vessel_anomalies`, `vessels`, and `vessel_risk_scores` in a single query.

**Gotcha:** Any schema changes to the joined tables (`vessels`, `vessel_risk_scores`) must be reflected in the query. If columns are renamed or removed, the endpoint will return nulls or fail silently for those fields.

**File:** `src/app/api/anomalies/route.ts`

## Happy-dom requires explicit cleanup in RTL tests

**Context:** When using `@testing-library/react` with Vitest's `happy-dom` environment, DOM state accumulates across tests within the same file. Unlike `jsdom`, happy-dom doesn't integrate with RTL's automatic cleanup.

**Fix:** Add `afterEach(cleanup)` at the top of each test file, imported from `@testing-library/react`. Without this, queries like `getByRole('button')` will fail with "multiple elements found" because previous test renders persist in the DOM.

**Also:** Use `getByRole` with a `name` filter (e.g. `{ name: /Going Dark anomalies/ }`) to make queries resilient even if cleanup issues resurface — it's good practice regardless.

**File:** `src/components/fleet/__tests__/AnomalyTable.test.tsx` (pattern reference)

## IMO deduplication with highest-risk-score-wins

**Context:** When displaying sanctioned vessels, a single vessel (identified by IMO) may appear multiple times in the anomalies array if it has multiple anomaly types. The UI should show each vessel once with the most relevant (highest risk) data.

**Pattern:** Use a `Map<string, Anomaly>` keyed by IMO. For each sanctioned anomaly, check if the IMO already exists in the map. If it does, keep the entry with the higher `riskScore`. This runs in O(n) time over the anomalies array.

**Where it runs:** Client-side in `FleetPage` before passing data to `SanctionedVessels`. The component itself is a pure display — it receives already-deduplicated data.

**Gotcha:** The deduplication discards anomaly-type-specific detail (e.g. which types triggered for that vessel). If future features need to show "vessel X has going_dark AND loitering," the dedup logic needs to merge rather than pick-one.

**File:** `src/app/(protected)/fleet/page.tsx`

## Tailwind v4 requires static class strings for opacity/brightness tiers

**Context:** When building count-based or intensity-based visual indicators, you might be tempted to dynamically construct Tailwind classes like `` `bg-amber-500/${opacity}` ``. This breaks in Tailwind v4 because the JIT scanner only detects statically-written class strings.

**Pattern:** Define a constant array of tier objects with pre-written class name strings (`'bg-amber-500/5'`, `'bg-amber-500/15'`, etc.) and select the correct tier by count threshold at runtime.

**Rule:** Never concatenate or interpolate Tailwind class names at runtime. Always use complete static string literals that the scanner can find.

## Extract shared display constants to type modules

**Context:** When multiple components need the same display labels or mappings (e.g. anomaly type labels like `going_dark` → `"Going Dark"`), extract them to the shared types module rather than duplicating in each component.

**Pattern:** Display constants like `ANOMALY_TYPE_LABELS` live in `src/types/anomaly.ts`. All components import from there rather than defining local copies.

**Rule:** Before adding a display constant to a component, check the relevant types file first. If it exists there, import it. If it doesn't and might be reused, add it to the types file from the start.

**File:** `src/types/anomaly.ts` (`ANOMALY_TYPE_LABELS`, `ShipCategory`)

## Display staleness vs detection intervals vs analytics windows

**Context:** The codebase has three categories of time-based SQL intervals that serve different purposes and must not be conflated:

1. **Display staleness** — controls which vessels appear in current-state views (map, fleet, chokepoints, anomalies). Defined in `src/lib/constants/staleness.ts`. Vessel display = 7 days, chokepoint display = 24 hours.
2. **Detection intervals** — calibrated windows for anomaly detection algorithms in `src/lib/detection/`. Going-dark (2h), loitering (6h), STS (30min), deviation (1-2h). These are domain-specific and independently tuned.
3. **Analytics windows** — historical aggregation ranges in `src/lib/db/analytics.ts`. User-selected (7d/30d/90d). Must include all vessels that existed during the period, even if now stale.

**Rule:** New display queries should import from `src/lib/constants/staleness.ts`. Never use staleness constants in detection or analytics files. Run `rg "STALENESS_INTERVAL" src/` to audit — any new query file with a hardcoded interval should be conspicuously absent.

**Gotcha:** The staleness constants module has JSDoc warning comments, but the real protection is the `rg` audit pattern — it shows which files consume the constants, making drift visible.

**Files:** `src/lib/constants/staleness.ts` (source of truth), `src/lib/detection/` (do not touch), `src/lib/db/analytics.ts` (do not touch)

## IMO→MMSI bridge join for cross-table vessel correlation

**Context:** `vessel_anomalies` is keyed by IMO, but `vessel_positions` is keyed by MMSI. To correlate anomalies with position recency, you need a bridge join through the `vessels` table: `vessel_anomalies.imo → vessels.imo → vessels.mmsi → vessel_positions.mmsi`.

**Pattern:** Use an EXISTS subquery (not IN) to avoid row multiplication:
```sql
AND EXISTS (
  SELECT 1 FROM vessel_positions vp2
  JOIN vessels v2 ON v2.mmsi = vp2.mmsi
  WHERE v2.imo = va.imo AND v2.imo IS NOT NULL
  AND vp2.time > NOW() - INTERVAL '${VESSEL_STALENESS_INTERVAL}'
)
```

**Gotcha:** Include `AND v2.imo IS NOT NULL` — some vessels have NULL IMO and can't be correlated. These are conservatively excluded.

**File:** `src/app/api/anomalies/route.ts`
