---
estimated_steps: 8
estimated_files: 4
skills_used: []
---

# T01: Fix null shipType expression & align staleness intervals

Fix Mapbox GL circle-color expression to handle null shipType. The case expression checks shipType >= 80 which fails when shipType is null. Wrap with coalesce to provide a fallback value of -1 (no valid ship type).

Also update chokepoints.ts to use VESSEL_STALENESS_INTERVAL instead of CHOKEPOINT_STALENESS_INTERVAL, and update getLatestPositions() to use the staleness constant.

Steps:
1. Edit VesselMap.tsx — wrap shipType checks with ['coalesce', ['get', 'shipType'], -1]
2. Edit src/lib/geo/chokepoints.ts — change CHOKEPOINT_STALENESS_INTERVAL to VESSEL_STALENESS_INTERVAL
3. Edit src/lib/db/positions.ts — import and use VESSEL_STALENESS_INTERVAL in getLatestPositions
4. Update staleness.ts — update CHOKEPOINT_STALENESS_INTERVAL to 7 days or remove if redundant
5. Run rg audit to confirm no remaining hardcoded display intervals

## Inputs

- `src/lib/constants/staleness.ts`
- `src/components/map/VesselMap.tsx`

## Expected Output

- `src/components/map/VesselMap.tsx (fixed expression)`
- `src/lib/geo/chokepoints.ts (7-day window)`
- `src/lib/db/positions.ts (staleness import)`
- `src/lib/constants/staleness.ts (updated)`

## Verification

rg 'STALENESS' src/ to audit imports; browser console check for zero Mapbox warnings; curl /api/chokepoints to verify non-zero counts
