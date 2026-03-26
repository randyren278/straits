# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R001 — Vessels not seen in 7 days must not appear on the live map, fleet page, or any current-state vessel list.
- Class: core-capability
- Status: active
- Description: Vessels not seen in 7 days must not appear on the live map, fleet page, or any current-state vessel list.
- Why it matters: Prevents stale vessels from polluting live views and giving a false picture of current activity.
- Source: user
- Primary owning slice: M010/S01
- Supporting slices: none
- Validation: partial — `sanctions.ts` fixed in audit commit (was hardcoded '48 hours'), needs re-validation
- Notes: Previously validated under M008/S01 but audit found the fix was never actually applied to the SQL string.

### R002 — Chokepoint vessel counts and vessel lists must use a 7-day position recency window matching vessel display.
- Class: core-capability
- Status: active
- Description: Chokepoint vessel counts and vessel lists must use a 7-day position recency window matching vessel display.
- Why it matters: Chokepoint counts should be consistent with what's shown on the map.
- Source: user
- Primary owning slice: M010/S01
- Supporting slices: none
- Validation: partial — `chokepoints.ts` fixed in audit commit (was hardcoded '1 hour'), needs re-validation
- Notes: Previously validated under M008/S01 but audit found the fix was never actually applied. Updated from 24h to 7d to match vessel display.

### R010 — Dashboard, fleet, and analytics pages must be usable on tablet (768px) and mobile (375px) viewports.
- Class: quality-attribute
- Status: active
- Description: Dashboard, fleet, and analytics pages must be usable on tablet (768px) and mobile (375px) viewports.
- Why it matters: The dashboard grid is fixed at grid-cols-[1fr_320px] which breaks on smaller screens.
- Source: inferred
- Primary owning slice: M010/S04
- Supporting slices: none
- Validation: unmapped
- Notes: Currently only one max-md breakpoint in the entire codebase.

### R011 — All buttons, inputs, and interactive elements must have accessible names via aria-label, aria-labelledby, or visible text content.
- Class: quality-attribute
- Status: active
- Description: All buttons, inputs, and interactive elements must have accessible names via aria-label, aria-labelledby, or visible text content.
- Why it matters: Screen readers cannot identify unlabeled controls. Basic accessibility is table stakes.
- Source: inferred
- Primary owning slice: M010/S04
- Supporting slices: none
- Validation: unmapped
- Notes: Currently zero aria-* or role= attributes found across components (one aria-label on NotificationBell button).

## Validated

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

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | core-capability | active | M010/S01 | none | partial — `sanctions.ts` fixed in audit commit (was hardcoded '48 hours'), needs re-validation |
| R002 | core-capability | active | M010/S01 | none | partial — `chokepoints.ts` fixed in audit commit (was hardcoded '1 hour'), needs re-validation |
| R003 | core-capability | validated | M010/S01 | none | validated — EXISTS staleness subquery added to /api/anomalies using VESSEL_STALENESS_INTERVAL with IMO→MMSI bridge join. TypeScript compiles clean. Staleness audit confirms anomalies/route.ts consumes the shared constant. |
| R004 | quality-attribute | validated | M008/S01 | M010/S01 | validated |
| R005 | constraint | validated | M008/S01 | none | validated |
| R006 | constraint | validated | M008/S01 | none | validated |
| R007 | quality-attribute | validated | M010/S02 | none | All 14 files deleted, 4 empty directories removed, npx tsc --noEmit clean, rg scan shows zero real references to deleted symbols. See D005. |
| R008 | failure-visibility | validated | M010/S03 | none | ErrorBoundary class component with 5 passing tests (including crash→fallback rendering, retry reset). Wired into dashboard (map + panels as separate boundaries), fleet (anomaly tables), analytics (charts section). Build succeeds. Route-level error.tsx covers About page. |
| R009 | quality-attribute | validated | M010/S03 | none | Created (protected)/loading.tsx with Bloomberg-styled pulse animation and (protected)/layout.tsx as pass-through Suspense host. Production build succeeds confirming Next.js route integration. All route transitions within the (protected) group show the loading indicator. |
| R010 | quality-attribute | active | M010/S04 | none | unmapped |
| R011 | quality-attribute | active | M010/S04 | none | unmapped |

## Coverage Summary

- Active requirements: 4
- Mapped to slices: 4
- Validated: 7 (R003, R004, R005, R006, R007, R008, R009)
- Unmapped active requirements: 0
