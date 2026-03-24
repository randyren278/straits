# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

(none — all requirements validated by M008/S01)

## Validated

### R001 — 7-day vessel staleness threshold for map and fleet views
- Class: core-capability
- Status: validated
- Description: Vessels not seen in 7 days must not appear on the live map, fleet page, or any current-state vessel list.
- Why it matters: Prevents stale vessels from polluting live views and giving a false picture of current activity.
- Source: user
- Primary owning slice: M008/S01
- Supporting slices: none
- Validation: `sanctions.ts` and `positions.ts` import `VESSEL_STALENESS_INTERVAL` ('7 days') from shared constants. Build passes, all tests pass, `rg` confirms no hardcoded `'48 hours'` or `'1 hour'` in target files.
- Notes: Previously map used 48 hours, positions used 1 hour. Now unified at 7 days.

### R002 — 24-hour chokepoint transit window
- Class: core-capability
- Status: validated
- Description: Chokepoint vessel counts and vessel lists must use a 24-hour position recency window.
- Why it matters: Chokepoints should show today's transits, not vessels from days ago, but 1 hour was too tight.
- Source: user
- Primary owning slice: M008/S01
- Supporting slices: none
- Validation: Both `countVesselsInChokepoint()` and `getVesselsInChokepoint()` in `chokepoints.ts` import `CHOKEPOINT_STALENESS_INTERVAL` ('24 hours'). Build passes, all tests pass.
- Notes: Previously used 1 hour. Now 24 hours per user decision.

### R003 — Anomalies filtered by vessel recency (7 days)
- Class: core-capability
- Status: validated
- Description: The anomalies API and fleet anomaly views must exclude anomalies for vessels not seen in 7 days.
- Why it matters: Showing anomalies for vessels that have long since left the coverage area is misleading.
- Source: user
- Primary owning slice: M008/S01
- Supporting slices: none
- Validation: `anomalies/route.ts` imports `VESSEL_STALENESS_INTERVAL` and uses an EXISTS subquery with IMO→MMSI bridge join. Build passes, all tests pass.
- Notes: EXISTS subquery chosen over IN for performance (no row multiplication).

### R004 — Shared staleness constants
- Class: quality-attribute
- Status: validated
- Description: Staleness thresholds must be defined as shared constants, not hardcoded intervals scattered across individual queries.
- Why it matters: Prevents future drift where different queries use different intervals.
- Source: inferred
- Primary owning slice: M008/S01
- Supporting slices: none
- Validation: `src/lib/constants/staleness.ts` exports 4 constants. 4 consuming files import from it. `rg "STALENESS_INTERVAL" src/` confirms coverage. Missing imports cause build-time TypeScript errors.
- Notes: Module includes warning comments against misuse in detection/analytics contexts.

### R005 — Detection intervals unchanged
- Class: constraint
- Status: validated
- Description: Anomaly detection windows (going-dark 2h, loitering 6h, STS 30min, deviation 1-2h) must not be modified by staleness changes.
- Why it matters: Detection intervals are calibrated for their specific domain; conflating them with display staleness would break detection accuracy.
- Source: inferred
- Primary owning slice: M008/S01
- Supporting slices: none
- Validation: `rg "INTERVAL" src/lib/detection/` confirms all detection intervals unchanged. `rg "STALENESS" src/lib/detection/` returns zero matches.
- Notes: Detection files were explicitly excluded from modification.

### R006 — Analytics historical aggregations unchanged
- Class: constraint
- Status: validated
- Description: Analytics traffic queries (daily vessel counts by chokepoint/route over 7d/30d/90d) must not be modified — they are historical aggregations, not current-state views.
- Why it matters: Historical charts should show what happened on each day, including vessels that are now stale.
- Source: inferred
- Primary owning slice: M008/S01
- Supporting slices: none
- Validation: `rg "STALENESS" src/lib/db/analytics.ts` returns zero matches. Analytics file was not modified.
- Notes: Analytics queries correctly remain unfiltered — they aggregate historical data per user-selected time range.

## Deferred

(none)

## Out of Scope

(none)

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | core-capability | validated | M008/S01 | none | sanctions.ts + positions.ts use 7-day constant |
| R002 | core-capability | validated | M008/S01 | none | chokepoints.ts uses 24-hour constant |
| R003 | core-capability | validated | M008/S01 | none | anomalies/route.ts EXISTS subquery with 7-day constant |
| R004 | quality-attribute | validated | M008/S01 | none | shared constants module + 4 consumers + build-time enforcement |
| R005 | constraint | validated | M008/S01 | none | detection/ has no staleness imports, intervals unchanged |
| R006 | constraint | validated | M008/S01 | none | analytics.ts has no staleness imports, unmodified |

## Coverage Summary

- Active requirements: 0
- Mapped to slices: 0
- Validated: 6
- Unmapped active requirements: 0
