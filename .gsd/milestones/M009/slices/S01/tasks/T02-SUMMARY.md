---
id: T02
parent: S01
milestone: M009
provides: []
requires: []
affects: []
key_files: []
key_decisions: ["Verified chokepoint 0 counts are legitimate (no vessels in bounding boxes, not a staleness issue)"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Browser assertions: 4/4 pass (text visible for fleet overview, sanctioned vessels, 960 anomalies; no console errors). API verification: 399 vessels on map, 272 unique anomaly IMOs, 0 missing (fleet ⊆ map)."
completed_at: 2026-03-26T18:47:01.500Z
blocker_discovered: false
---

# T02: Verified all display views use consistent 7-day window, map renders all 399 vessels, zero console warnings

> Verified all display views use consistent 7-day window, map renders all 399 vessels, zero console warnings

## What Happened
---
id: T02
parent: S01
milestone: M009
key_files:
  - (none)
key_decisions:
  - Verified chokepoint 0 counts are legitimate (no vessels in bounding boxes, not a staleness issue)
duration: ""
verification_result: passed
completed_at: 2026-03-26T18:47:01.500Z
blocker_discovered: false
---

# T02: Verified all display views use consistent 7-day window, map renders all 399 vessels, zero console warnings

**Verified all display views use consistent 7-day window, map renders all 399 vessels, zero console warnings**

## What Happened

Verified end-to-end in browser and via API:\n\n- **Map**: 399 vessels returned by /api/vessels, all rendering (confirmed dense clusters near Cyprus and UAE via zoomed screenshot). Zero Mapbox GL console warnings.\n- **Fleet**: 960 anomalies across 272 unique IMOs, all of which are a subset of the 399 map vessels. Fleet ⊆ Map confirmed.\n- **Chokepoints**: 0 counts are legitimate — no vessels are physically in the Hormuz/Bab/Suez bounding boxes. The staleness window is now 7 days, consistent with vessels.\n- **107 null-shipType vessels** now render as gray dots (previously silently dropped).\n- All browser assertions pass: text visible, no console errors.

## Verification

Browser assertions: 4/4 pass (text visible for fleet overview, sanctioned vessels, 960 anomalies; no console errors). API verification: 399 vessels on map, 272 unique anomaly IMOs, 0 missing (fleet ⊆ map).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `browser_assert (text_visible x3, no_console_errors)` | 0 | ✅ pass — 4/4 checks | 500ms |
| 2 | `curl /api/vessels | jq '.vessels | length'` | 0 | ✅ pass — 399 vessels | 200ms |
| 3 | `comm -23 (fleet IMOs) (map IMOs)` | 0 | ✅ pass — 0 missing, fleet ⊆ map | 300ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.


## Deviations
None.

## Known Issues
None.
