---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/services/ais-ingester/index.ts
  - src/lib/geo/chokepoints-constants.ts
  - src/lib/geo/chokepoints.test.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "AISStream WebSocket subscription explicitly covers Strait of Hormuz (Persian Gulf)"
    - "AISStream WebSocket subscription explicitly covers Bab-el-Mandeb (Red Sea / Gulf of Aden)"
    - "AISStream WebSocket subscription explicitly covers Suez Canal"
    - "Chokepoint detection bounds are wide enough to catch vessels transiting each strait"
  artifacts:
    - path: "src/services/ais-ingester/index.ts"
      provides: "WebSocket subscription with correct multi-region bounding boxes"
    - path: "src/lib/geo/chokepoints-constants.ts"
      provides: "Wider chokepoint detection bounds"
  key_links:
    - from: "src/services/ais-ingester/index.ts"
      to: "wss://stream.aisstream.io/v0/stream"
      via: "BoundingBoxes in subscription payload"
      pattern: "BoundingBoxes"
    - from: "src/lib/geo/chokepoints-constants.ts"
      to: "src/lib/geo/chokepoints.ts"
      via: "CHOKEPOINTS constant import"
      pattern: "CHOKEPOINTS"
---

<objective>
Fix two distinct systems that use geographic bounding boxes to cover the three critical maritime chokepoints: (1) the AISStream WebSocket subscription that determines which ship data is RECEIVED, and (2) the chokepoint detection bounds that determine which ships are COUNTED at each chokepoint.

Purpose: The user reports only seeing ships near Cyprus, indicating the Persian Gulf, Red Sea, and Suez region are likely not being covered reliably. Using explicit per-region bounding boxes instead of one large catch-all box ensures all three chokepoints receive data.

Output: Updated ingester subscription with four explicit bounding boxes; wider chokepoint counting bounds with updated tests.
</objective>

<execution_context>
@/Users/randyren/.claude/get-shit-done/workflows/execute-plan.md
@/Users/randyren/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/services/ais-ingester/index.ts
@src/lib/geo/chokepoints-constants.ts
@src/lib/geo/chokepoints.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix AISStream WebSocket subscription bounding boxes</name>
  <files>src/services/ais-ingester/index.ts</files>
  <action>
Replace the single catch-all `BoundingBoxes` entry in the `subscription` object (lines 82-88) with four explicit per-region boxes. AISStream format is `[[lat_min, lon_min], [lat_max, lon_max]]`.

Replace:
```ts
BoundingBoxes: [
  [[10, 30], [35, 80]], // Middle East + Indian Ocean routes
],
```

With:
```ts
BoundingBoxes: [
  // Strait of Hormuz + Persian Gulf entrance
  [[23.5, 55.5], [27.0, 57.5]],
  // Bab-el-Mandeb (Red Sea / Gulf of Aden)
  [[11.0, 42.5], [13.5, 45.0]],
  // Suez Canal (Red Sea to Mediterranean)
  [[29.5, 31.5], [32.5, 33.0]],
  // Eastern Mediterranean / Cyprus area
  [[33.0, 28.0], [37.0, 37.0]],
],
```

Update the comment above the subscription object accordingly.
  </action>
  <verify>
    <automated>grep -A 8 "BoundingBoxes" /Users/randyren/Developer/tanker-tracker/src/services/ais-ingester/index.ts</automated>
  </verify>
  <done>BoundingBoxes contains four entries covering Hormuz, Bab-el-Mandeb, Suez, and Eastern Med. No single catch-all box remains.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Widen chokepoint detection bounds and update tests</name>
  <files>src/lib/geo/chokepoints-constants.ts, src/lib/geo/chokepoints.test.ts</files>
  <behavior>
    - Hormuz: isInChokepoint(25.0, 56.5, hormuz.bounds) returns true (was outside old bounds minLat=26)
    - Hormuz: isInChokepoint(26.5, 56.0, hormuz.bounds) still returns true
    - Bab-el-Mandeb: isInChokepoint(11.5, 43.5, babel_mandeb.bounds) returns true (wider lon)
    - Bab-el-Mandeb: isInChokepoint(12.5, 44.5, babel_mandeb.bounds) returns true (wider lon)
    - Suez: isInChokepoint(30.0, 32.8, suez.bounds) returns true (wider lon)
    - All bounds still satisfy minLat < maxLat and minLon < maxLon
  </behavior>
  <action>
First update the bounds in `chokepoints-constants.ts`:

```ts
export const CHOKEPOINTS: Record<string, Chokepoint> = {
  hormuz: {
    id: 'hormuz',
    name: 'Strait of Hormuz',
    bounds: { minLat: 23.5, maxLat: 27.0, minLon: 55.5, maxLon: 57.5 },
  },
  babel_mandeb: {
    id: 'babel_mandeb',
    name: 'Bab el-Mandeb',
    bounds: { minLat: 11.0, maxLat: 13.5, minLon: 42.5, maxLon: 45.0 },
  },
  suez: {
    id: 'suez',
    name: 'Suez Canal',
    bounds: { minLat: 29.5, maxLat: 32.5, minLon: 31.5, maxLon: 33.0 },
  },
};
```

Then update `chokepoints.test.ts` to use coordinate points that are inside the NEW bounds (some old test points may now be in the interior of the expanded regions — update any that test OLD boundary conditions against removed edge points, and add new tests covering the expanded areas per the behavior block above).

Key test changes needed:
- The test "returns false for point outside Hormuz bounds" uses `isInChokepoint(25.0, 56.0, ...)` — 25.0 lat is NOW inside the new Hormuz bounds (minLat=23.5). Update this test to use a coordinate that is genuinely outside the new bounds, e.g., `isInChokepoint(22.0, 56.0, ...)` which is south of 23.5.
- Add a test: `isInChokepoint(11.5, 43.5, CHOKEPOINTS.babel_mandeb.bounds)` returns true.
- Add a test: `isInChokepoint(30.0, 32.8, CHOKEPOINTS.suez.bounds)` returns true.
  </action>
  <verify>
    <automated>cd /Users/randyren/Developer/tanker-tracker && npx vitest run src/lib/geo/chokepoints.test.ts</automated>
  </verify>
  <done>All chokepoint tests pass. Bounds cover the full strait transit corridors matching the WebSocket subscription boxes.</done>
</task>

</tasks>

<verification>
Run the full test suite to confirm no regressions:

```bash
cd /Users/randyren/Developer/tanker-tracker && npx vitest run
```

Confirm the ingester subscription has four bounding boxes:

```bash
grep -A 10 "BoundingBoxes" /Users/randyren/Developer/tanker-tracker/src/services/ais-ingester/index.ts
```

The four boxes should align exactly with the chokepoint constants (same coordinate ranges).
</verification>

<success_criteria>
- AISStream subscription has 4 explicit BoundingBoxes (Hormuz, Bab-el-Mandeb, Suez, Eastern Med)
- Chokepoint detection bounds are wider, matching the subscription boxes
- All vitest tests pass with no failures
- The Hormuz subscription box and chokepoints-constants bounds use the same coordinate ranges
</success_criteria>

<output>
After completion, create `.planning/quick/5-fix-aisstream-bounding-boxes-for-strait-/5-SUMMARY.md` with what was changed and the final coordinate values used.
</output>
