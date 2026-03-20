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
