# M010: Quality & Consistency

**Gathered:** 2026-03-26
**Status:** Ready for planning

## Project Description

Tanker Tracker is a geopolitical intelligence dashboard tracking vessels across the Middle East in near real-time. Bloomberg-terminal aesthetic. AIS data + oil prices + sanctions + news + anomaly detection. Built with Next.js 16, React 19, Mapbox GL, TimescaleDB.

## Why This Milestone

A codebase audit revealed three categories of technical debt accumulated across M001-M009:
1. The anomalies API lost its staleness filter during a refactor, causing the fleet tab to show 97 vessels not visible on the map.
2. Multiple refactoring iterations left dead components (VesselLayer, AnomalyMatrix, TrackLayer), orphaned modules, and unwired auth scaffolding.
3. Zero error boundaries, loading states, responsive breakpoints, or ARIA attributes — a crash in any component white-screens the whole page, navigation flashes blank, and the dashboard breaks on mobile.

## User-Visible Outcome

### When this milestone is complete, the user can:

- See the fleet tab showing only vessels that appear on the map (no phantom anomalies for stale vessels)
- Navigate between pages with a loading indicator instead of a blank flash
- Use the dashboard on a tablet or phone without horizontal overflow
- Have one panel crash without losing the rest of the page

### Entry point / environment

- Entry point: http://localhost:3000/dashboard
- Environment: local dev / browser
- Live dependencies involved: TimescaleDB (docker), AISStream.io WebSocket

## Completion Class

- Contract complete means: TypeScript compiles clean, all tests pass, rg audit confirms no hardcoded display intervals, no orphaned components
- Integration complete means: API anomaly IMOs ⊆ vessel IMOs verified by curl comparison
- Operational complete means: error boundary catches simulated crash, loading.tsx renders during transition

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- Fleet anomaly IMOs are a strict subset of map vessel IMOs (curl comparison)
- A simulated component crash in one panel does not affect other panels
- Dashboard renders usably at 768px and 375px viewport widths
- Build passes with zero dead imports

## Risks and Unknowns

- Anomalies staleness filter may reduce fleet tab anomaly count significantly — this is correct behavior, not a bug
- Responsive layout changes could break the Bloomberg aesthetic on desktop if not careful — must preserve desktop layout exactly

## Existing Codebase / Prior Art

- `src/lib/constants/staleness.ts` — staleness constants (VESSEL_STALENESS_INTERVAL = '7 days', CHOKEPOINT_STALENESS_INTERVAL = '7 days')
- `src/app/api/anomalies/route.ts` — anomalies endpoint, missing EXISTS staleness subquery
- `src/lib/db/sanctions.ts` — getVesselsWithSanctions(), recently fixed to use staleness constant
- `src/components/map/VesselMap.tsx` — 534-line monolithic map component
- `src/components/map/VesselLayer.tsx` — dead component (71 lines, zero importers)
- `src/components/map/TrackLayer.tsx` — dead component (71 lines, zero importers)
- `src/components/fleet/AnomalyMatrix.tsx` — dead component (132 lines, has tests but rendered nowhere)
- `src/lib/auth.ts` — unwired auth (no middleware enforcement)
- `src/app/login/page.tsx` — login page with no guard on protected routes
- `src/proxy.ts` — dead module

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions — it is an append-only register; read it during planning, append to it during execution.

## Relevant Requirements

- R001 — 7-day vessel staleness (re-validate after audit fix)
- R002 — 7-day chokepoint staleness (re-validate after audit fix)
- R003 — Anomalies filtered by position recency (add EXISTS subquery)
- R007 — Dead code removed
- R008 — Error boundaries on all pages
- R009 — Loading states for route transitions
- R010 — Responsive layout
- R011 — ARIA attributes on interactive elements

## Scope

### In Scope

- Add staleness filter to anomalies API route
- Re-validate staleness constants in sanctions.ts and chokepoints.ts
- Delete dead components: VesselLayer, AnomalyMatrix + test, TrackLayer
- Delete dead modules: tracks.ts + test, proxy.ts, sanctions/matcher.ts + test
- Delete unwired auth: auth.ts + test, login page, login API route, auth test
- React error boundaries wrapping page sections
- loading.tsx for (protected) route group
- Responsive breakpoints for dashboard, fleet, analytics
- ARIA labels on buttons, inputs, interactive elements

### Out of Scope / Non-Goals

- Refactoring VesselMap.tsx into smaller components (future work)
- Wiring the auth system (needs design decisions about auth flow)
- Changing the notification bell to show alerts instead of anomalies
- Adding tests for untested detection modules (sts-transfer, repeat-going-dark, risk-score)

## Technical Constraints

- Must preserve Bloomberg aesthetic on desktop (true black + amber, sharp corners, JetBrains Mono)
- Responsive changes must not alter the desktop layout — mobile is additive
- Dead code deletion must not break any existing import chains

## Integration Points

- TimescaleDB — anomalies query needs bridge join through vessels table for staleness filter
- Mapbox GL — error boundary must not unmount the map (expensive to reinitialize)

## Open Questions

- None — scope is well-defined from the audit
