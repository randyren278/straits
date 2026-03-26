---
id: M009
title: "7-Day Staleness Sync & Map Rendering Fix"
status: complete
completed_at: 2026-03-26T18:48:06.119Z
key_decisions:
  - Used Mapbox coalesce expression with -1 fallback for null shipType
  - Aligned CHOKEPOINT_STALENESS_INTERVAL to 7 days (was 24 hours)
  - Static import for staleness constant in positions.ts
key_files:
  - src/components/map/VesselMap.tsx
  - src/lib/constants/staleness.ts
  - src/lib/db/positions.ts
lessons_learned:
  - Mapbox GL case expressions fail silently when a branch evaluates to null for a numeric comparison — always use coalesce for nullable properties
  - The 'missing vessels' symptom was a rendering bug, not a data inconsistency — both APIs used the same 7-day window
---

# M009: 7-Day Staleness Sync & Map Rendering Fix

**Fixed Mapbox null-shipType rendering bug that silently hid 107 vessels and aligned all display queries to consistent 7-day staleness window**

## What Happened

Investigated user-reported issue where fleet tab showed hundreds of vessels but the map showed far fewer. Root cause was a Mapbox GL expression evaluation bug: the circle-color case expression checked `['>=', ['get', 'shipType'], 80]` which throws for null shipType values. Mapbox silently drops features that fail expression evaluation, hiding 107 vessels.\n\nFixed by wrapping with `coalesce` fallback. Also aligned chokepoint staleness from 24h to 7d and fixed an unused function's hardcoded interval for consistency.\n\nAll 399 vessels now render on the map. Fleet anomaly IMOs are confirmed as a subset of map vessel IMOs. Zero console warnings.

## Success Criteria Results

- [x] All display queries use VESSEL_STALENESS_INTERVAL — PASS (rg audit: 5 files)\n- [x] Map renders all vessels — PASS (399 vessels, zero expression warnings)\n- [x] Chokepoint counts match geographic bounds — PASS (0 counts legitimate)\n- [x] Zero Mapbox GL warnings — PASS (console clean)\n- [x] Fleet ⊆ Map — PASS (272 anomaly IMOs ⊆ 292 map IMOs)

## Definition of Done Results

- [x] All display queries use staleness constants — confirmed via rg audit\n- [x] Mapbox shipType null handling fixed — coalesce wrapping applied\n- [x] Chokepoint staleness aligned to 7 days — constant updated\n- [x] getLatestPositions uses staleness constant — import added\n- [x] Browser verification passes with zero console warnings — 4/4 assertions pass\n- [x] rg audit clean — no hardcoded display intervals outside detection/analytics

## Requirement Outcomes

MAP-01: Advanced — all 399 vessels now render on map (was dropping 107 with null shipType)\nMAP-07: Advanced — chokepoint staleness aligned to 7 days for consistency\nANOM-01: Confirmed — fleet anomaly IMOs are a proper subset of map vessel IMOs

## Deviations

None.

## Follow-ups

None.
