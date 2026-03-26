---
id: S03
parent: M010
milestone: M010
provides:
  - Reusable ErrorBoundary component at src/components/ui/ErrorBoundary.tsx
  - Route-level loading and error files for (protected) route group
  - Bloomberg-styled error fallback pattern
requires:
  []
affects:
  - S04
key_files:
  - src/components/ui/ErrorBoundary.tsx
  - src/components/ui/__tests__/ErrorBoundary.test.tsx
  - src/app/(protected)/layout.tsx
  - src/app/(protected)/loading.tsx
  - src/app/(protected)/error.tsx
  - src/app/(protected)/dashboard/page.tsx
  - src/app/(protected)/fleet/page.tsx
  - src/app/(protected)/analytics/page.tsx
key_decisions:
  - ErrorBoundary uses render prop fallback pattern (function receiving error + reset) for composability over static component prop
  - Dashboard uses two isolated ErrorBoundaries (map vs panels) so a crash in one doesn't take down the other
  - About page relies on route-level error.tsx rather than inline ErrorBoundary since it's static content
patterns_established:
  - Bloomberg-styled error fallback: bg-black, text-amber-500, font-mono, uppercase tracking-widest, sharp corners, border-amber-500/20 with RETRY button
  - Route-level loading.tsx + layout.tsx pattern for Suspense-based route transition indicators
observability_surfaces:
  - ErrorBoundary logs caught errors via console.error in componentDidCatch
  - Optional onError callback prop for custom error reporting integration
drill_down_paths:
  - .gsd/milestones/M010/slices/S03/tasks/T01-SUMMARY.md
  - .gsd/milestones/M010/slices/S03/tasks/T02-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-03-26T20:18:45.968Z
blocker_discovered: false
---

# S03: Error Boundaries & Loading States

**Reusable ErrorBoundary class component with Bloomberg fallback, wired into all major page sections, plus route-level loading and error files for the (protected) route group**

## What Happened

T01 created the reusable `ErrorBoundary` class component (`src/components/ui/ErrorBoundary.tsx`) — a `'use client'` class component using `getDerivedStateFromError` + `componentDidCatch` since React 19 still requires class components for error catching. The default fallback uses Bloomberg terminal aesthetic (bg-black, text-amber-500, font-mono, uppercase tracking-widest, sharp corners, border-amber-500/20) with a RETRY button that resets error state. The component accepts an optional `fallback` render prop receiving `(error, reset)` for composable context-specific fallbacks, and an `onError` callback for logging. Five tests verify: normal rendering, error catch with fallback display, retry reset, custom fallback render prop, and onError callback invocation.

T01 also created three route-level files: `(protected)/layout.tsx` (pass-through `{children}` needed as Suspense boundary host), `(protected)/loading.tsx` (Bloomberg-styled pulse animation with "LOADING..." text), and `(protected)/error.tsx` (page-level last-resort error boundary receiving `error` and `reset` props).

T02 imported ErrorBoundary into the three main pages. Dashboard gets two isolated boundaries — one around VesselMap, one around the right-column panel stack — so a panel crash doesn't kill the map and vice versa. Fleet wraps the anomaly tables rendering block (SanctionedVessels + AnomalyTable). Analytics wraps the charts section (selectedChokepoints.map block). The About page relies on the route-level error.tsx from T01 since it's static content.

## Verification

All slice-level verification passed:
- `npx tsc --noEmit` — zero type errors (exit 0)
- `npx vitest run` — 34 suites, 378 tests pass (exit 0), including 5 ErrorBoundary-specific tests
- `npm run build` — production build succeeds (exit 0), all routes compile correctly
- Confirmed ErrorBoundary import and usage in all three page files via grep
- All 8 key files exist on disk with expected content

## Requirements Advanced

None.

## Requirements Validated

- R008 — ErrorBoundary class component with 5 passing tests (crash→fallback, retry reset). Wired into dashboard (map + panels as separate boundaries), fleet (tables), analytics (charts). Build succeeds.
- R009 — Created (protected)/loading.tsx with Bloomberg-styled pulse animation and layout.tsx as Suspense host. Production build succeeds confirming Next.js route integration.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

Minor: Added React.ReactNode return type annotation to ThrowingChild test helper in ErrorBoundary.test.tsx to satisfy tsc — a function that throws before returning doesn't meet JSX component type constraints without explicit annotation. No functional impact.

## Known Limitations

None. Error boundaries cover all major sections. The About page is static content covered by route-level error.tsx.

## Follow-ups

None.

## Files Created/Modified

- `src/components/ui/ErrorBoundary.tsx` — New reusable ErrorBoundary class component with Bloomberg-styled fallback, render prop, and onError callback
- `src/components/ui/__tests__/ErrorBoundary.test.tsx` — 5 tests covering normal render, error catch, retry reset, custom fallback, onError callback
- `src/app/(protected)/layout.tsx` — Pass-through layout providing Suspense boundary for route transitions
- `src/app/(protected)/loading.tsx` — Bloomberg-styled pulse loading indicator for route transitions
- `src/app/(protected)/error.tsx` — Page-level last-resort error boundary with Bloomberg styling
- `src/app/(protected)/dashboard/page.tsx` — Added two ErrorBoundary wrappers (map + panel stack)
- `src/app/(protected)/fleet/page.tsx` — Added ErrorBoundary wrapper around anomaly tables section
- `src/app/(protected)/analytics/page.tsx` — Added ErrorBoundary wrapper around charts section
