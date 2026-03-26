# S01: Staleness Sync & Map Fix

**Goal:** Fix all display staleness inconsistencies and the Mapbox GL null-shipType rendering bug
**Demo:** After this: Map renders all 399 vessels, chokepoints show 7-day counts, zero console warnings

## Tasks
- [x] **T01: Fixed Mapbox null-shipType rendering bug and aligned all display queries to 7-day staleness window** — Fix Mapbox GL circle-color expression to handle null shipType. The case expression checks shipType >= 80 which fails when shipType is null. Wrap with coalesce to provide a fallback value of -1 (no valid ship type).

Also update chokepoints.ts to use VESSEL_STALENESS_INTERVAL instead of CHOKEPOINT_STALENESS_INTERVAL, and update getLatestPositions() to use the staleness constant.

Steps:
1. Edit VesselMap.tsx — wrap shipType checks with ['coalesce', ['get', 'shipType'], -1]
2. Edit src/lib/geo/chokepoints.ts — change CHOKEPOINT_STALENESS_INTERVAL to VESSEL_STALENESS_INTERVAL
3. Edit src/lib/db/positions.ts — import and use VESSEL_STALENESS_INTERVAL in getLatestPositions
4. Update staleness.ts — update CHOKEPOINT_STALENESS_INTERVAL to 7 days or remove if redundant
5. Run rg audit to confirm no remaining hardcoded display intervals
  - Estimate: 20min
  - Files: src/components/map/VesselMap.tsx, src/lib/geo/chokepoints.ts, src/lib/db/positions.ts, src/lib/constants/staleness.ts
  - Verify: rg 'STALENESS' src/ to audit imports; browser console check for zero Mapbox warnings; curl /api/chokepoints to verify non-zero counts
- [x] **T02: Verified all display views use consistent 7-day window, map renders all 399 vessels, zero console warnings** — Verify end-to-end in the browser that all views are consistent.

Steps:
1. Load dashboard — count visible vessels on map
2. Check browser console for zero Mapbox GL warnings
3. Check chokepoint widget shows non-zero counts where vessels exist
4. Load fleet tab — verify anomaly vessels are a subset of map vessels
5. Verify /api/vessels count >= /api/anomalies unique IMO count
  - Estimate: 10min
  - Verify: browser_assert checks pass; API count comparison confirms fleet ⊆ map
