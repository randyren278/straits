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
