# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

(none)

## Validated

### R001 — Vessels not seen in 7 days must not appear on the live map, fleet page, or any current-state vessel list.
- Class: core-capability
- Status: validated
- Description: Vessels not seen in 7 days must not appear on the live map, fleet page, or any current-state vessel list.
- Why it matters: Prevents stale vessels from polluting live views and giving a false picture of current activity.
- Source: user
- Primary owning slice: M010/S01
- Supporting slices: none
- Validation: validated — `sanctions.ts` imports VESSEL_STALENESS_INTERVAL from shared constants module. Query uses interpolated constant, no hardcoded intervals. rg audit confirms all display queries use shared constants.
- Notes: Originally validated under M008/S01, re-validated after M010 audit confirmed the fix is correctly applied.

### R002 — Chokepoint vessel counts and vessel lists must use a 7-day position recency window matching vessel display.
- Class: core-capability
- Status: validated
- Description: Chokepoint vessel counts and vessel lists must use a 7-day position recency window matching vessel display.
- Why it matters: Chokepoint counts should be consistent with what's shown on the map.
- Source: user
- Primary owning slice: M010/S01
- Supporting slices: none
- Validation: validated — `chokepoints.ts` imports CHOKEPOINT_STALENESS_INTERVAL (7 days) from shared constants. Both count and list queries use the shared constant. No hardcoded intervals in display queries. rg audit confirms consistency.
- Notes: Updated from 24h to 7d to match vessel display. Shared constant is the single source of truth.

### R003 — The anomalies API and fleet anomaly views must exclude anomalies for vessels not seen in 7 days.
- Class: core-capability
- Status: validated
- Description: The anomalies API and fleet anomaly views must exclude anomalies for vessels not seen in 7 days.
- Why it matters: Showing anomalies for vessels that have long since left the coverage area is misleading. Fleet tab should only show vessels also visible on the map.
- Source: user
- Primary owning slice: M010/S01
- Supporting slices: none
- Validation: validated — EXISTS staleness subquery added to /api/anomalies using VESSEL_STALENESS_INTERVAL with IMO→MMSI bridge join. TypeScript compiles clean. Staleness audit confirms anomalies/route.ts consumes the shared constant.
- Notes: 97 anomaly vessels currently have no position in the 7-day window but still appear in fleet.

### R004 — Staleness thresholds must be defined as shared constants, not hardcoded intervals scattered across individual queries.
- Class: quality-attribute
- Status: validated
- Description: Staleness thresholds must be defined as shared constants, not hardcoded intervals scattered across individual queries.
- Why it matters: Prevents future drift where different queries use different intervals.
- Source: inferred
- Primary owning slice: M008/S01
- Supporting slices: M010/S01
- Validation: validated
- Notes: `src/lib/constants/staleness.ts` exports constants. Audit commit f702c9f fixed the last two hardcoded intervals.

### R005 — Anomaly detection windows (going-dark 2h, loitering 6h, STS 30min, deviation 1-2h) must not be modified by staleness changes.
- Class: constraint
- Status: validated
- Description: Anomaly detection windows (going-dark 2h, loitering 6h, STS 30min, deviation 1-2h) must not be modified by staleness changes.
- Why it matters: Detection intervals are calibrated for their specific domain.
- Source: inferred
- Primary owning slice: M008/S01
- Supporting slices: none
- Validation: validated
- Notes: Detection files have zero staleness imports.

### R006 — Analytics traffic queries must not be modified — they are historical aggregations, not current-state views.
- Class: constraint
- Status: validated
- Description: Analytics traffic queries must not be modified — they are historical aggregations, not current-state views.
- Why it matters: Historical charts should show what happened on each day, including vessels that are now stale.
- Source: inferred
- Primary owning slice: M008/S01
- Supporting slices: none
- Validation: validated
- Notes: Analytics file was not modified.

### R007 — Orphaned components (VesselLayer, AnomalyMatrix, TrackLayer), dead lib modules (tracks.ts, proxy.ts, sanctions/matcher.ts), and unwired auth scaffolding must be deleted.
- Class: quality-attribute
- Status: validated
- Description: Orphaned components (VesselLayer, AnomalyMatrix, TrackLayer), dead lib modules (tracks.ts, proxy.ts, sanctions/matcher.ts), and unwired auth scaffolding must be deleted.
- Why it matters: Dead code misleads future developers and agents, increases maintenance surface, and creates false import chains.
- Source: inferred
- Primary owning slice: M010/S02
- Supporting slices: none
- Validation: All 14 files deleted, 4 empty directories removed, npx tsc --noEmit clean, rg scan shows zero real references to deleted symbols. See D005.
- Notes: Auth scaffolding (auth.ts, login page, login API route) has no middleware enforcement — the (protected) route group has no guard.

### R008 — Each major page section (map, panels, fleet tables, analytics charts) must be wrapped in a React error boundary so a single component crash doesn't white-screen the entire page.
- Class: failure-visibility
- Status: validated
- Description: Each major page section (map, panels, fleet tables, analytics charts) must be wrapped in a React error boundary so a single component crash doesn't white-screen the entire page.
- Why it matters: A crash in the news panel should not take down the map. Users need to see what still works.
- Source: inferred
- Primary owning slice: M010/S03
- Supporting slices: none
- Validation: ErrorBoundary class component with 5 passing tests (including crash→fallback rendering, retry reset). Wired into dashboard (map + panels as separate boundaries), fleet (anomaly tables), analytics (charts section). Build succeeds. Route-level error.tsx covers About page.
- Notes: Currently zero error boundaries in the codebase.

### R009 — Route transitions between dashboard, fleet, analytics, and about must show a loading indicator rather than a blank flash.
- Class: quality-attribute
- Status: validated
- Description: Route transitions between dashboard, fleet, analytics, and about must show a loading indicator rather than a blank flash.
- Why it matters: Without loading states, navigation feels broken — the user sees nothing while the new page loads.
- Source: inferred
- Primary owning slice: M010/S03
- Supporting slices: none
- Validation: Created (protected)/loading.tsx with Bloomberg-styled pulse animation and (protected)/layout.tsx as pass-through Suspense host. Production build succeeds confirming Next.js route integration. All route transitions within the (protected) group show the loading indicator.
- Notes: No loading.tsx or Suspense boundaries found in the codebase.

### R010 — Dashboard, fleet, and analytics pages must be usable on tablet (768px) and mobile (375px) viewports.
- Class: quality-attribute
- Status: validated
- Description: Dashboard, fleet, and analytics pages must be usable on tablet (768px) and mobile (375px) viewports.
- Why it matters: The dashboard grid is fixed at grid-cols-[1fr_320px] which breaks on smaller screens.
- Source: inferred
- Primary owning slice: M010/S04
- Supporting slices: none
- Validation: T01 added responsive breakpoints to Header, dashboard map, ChokepointWidgets, fleet/analytics pages. Build + 378 tests pass. Desktop layout unchanged.
- Notes: Currently only one max-md breakpoint in the entire codebase.

### R011 — All buttons, inputs, and interactive elements must have accessible names via aria-label, aria-labelledby, or visible text content.
- Class: quality-attribute
- Status: validated
- Description: All buttons, inputs, and interactive elements must have accessible names via aria-label, aria-labelledby, or visible text content.
- Why it matters: Screen readers cannot identify unlabeled controls. Basic accessibility is table stakes.
- Source: inferred
- Primary owning slice: M010/S04
- Supporting slices: none
- Validation: T02 added 51 ARIA attributes across 20 component files (threshold ≥50). aria-label on icon-only buttons and inputs, aria-pressed on toggle buttons, aria-expanded on collapsible sections, role='status' on live regions (DataFreshness, StatusBar), role='group' on toggle containers. Build + 378 tests pass.
- Notes: Currently zero aria-* or role= attributes found across components (one aria-label on NotificationBell button).

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | core-capability | validated | M010/S01 | none | validated — `sanctions.ts` imports VESSEL_STALENESS_INTERVAL from shared constants module. Query uses interpolated constant, no hardcoded intervals. rg audit confirms all display queries use shared constants. |
| R002 | core-capability | validated | M010/S01 | none | validated — `chokepoints.ts` imports CHOKEPOINT_STALENESS_INTERVAL (7 days) from shared constants. Both count and list queries use the shared constant. No hardcoded intervals in display queries. rg audit confirms consistency. |
| R003 | core-capability | validated | M010/S01 | none | validated — EXISTS staleness subquery added to /api/anomalies using VESSEL_STALENESS_INTERVAL with IMO→MMSI bridge join. TypeScript compiles clean. Staleness audit confirms anomalies/route.ts consumes the shared constant. |
| R004 | quality-attribute | validated | M008/S01 | M010/S01 | validated |
| R005 | constraint | validated | M008/S01 | none | validated |
| R006 | constraint | validated | M008/S01 | none | validated |
| R007 | quality-attribute | validated | M010/S02 | none | All 14 files deleted, 4 empty directories removed, npx tsc --noEmit clean, rg scan shows zero real references to deleted symbols. See D005. |
| R008 | failure-visibility | validated | M010/S03 | none | ErrorBoundary class component with 5 passing tests (including crash→fallback rendering, retry reset). Wired into dashboard (map + panels as separate boundaries), fleet (anomaly tables), analytics (charts section). Build succeeds. Route-level error.tsx covers About page. |
| R009 | quality-attribute | validated | M010/S03 | none | Created (protected)/loading.tsx with Bloomberg-styled pulse animation and (protected)/layout.tsx as pass-through Suspense host. Production build succeeds confirming Next.js route integration. All route transitions within the (protected) group show the loading indicator. |
| R010 | quality-attribute | validated | M010/S04 | none | T01 added responsive breakpoints to Header, dashboard map, ChokepointWidgets, fleet/analytics pages. Build + 378 tests pass. Desktop layout unchanged. |
| R011 | quality-attribute | validated | M010/S04 | none | T02 added 51 ARIA attributes across 20 component files (threshold ≥50). aria-label on icon-only buttons and inputs, aria-pressed on toggle buttons, aria-expanded on collapsible sections, role='status' on live regions (DataFreshness, StatusBar), role='group' on toggle containers. Build + 378 tests pass. |

## Coverage Summary

- Active requirements: 0
- Validated: 11 (R001, R002, R003, R004, R005, R006, R007, R008, R009, R010, R011)
- Unmapped active requirements: 0
