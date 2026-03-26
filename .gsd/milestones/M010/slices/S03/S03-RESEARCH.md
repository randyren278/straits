# S03: Error Boundaries & Loading States — Research

**Date:** 2026-03-26

## Summary

This slice adds two things the codebase currently lacks entirely: (1) error boundaries so a crash in one panel/section doesn't white-screen the page, and (2) `loading.tsx` for route transitions so navigation doesn't flash blank.

The codebase has zero `error.tsx`, zero `loading.tsx`, and zero error boundary components. All four protected pages (`dashboard`, `fleet`, `analytics`, `about`) are `'use client'` components. The dashboard page is the most complex — it composes a map, five sidebar panels, and a header. Each panel fetches its own data independently, making them natural error boundary units.

This is straightforward work. The patterns are well-established in Next.js App Router and React. No new libraries needed.

## Recommendation

Build a reusable `<ErrorBoundary>` class component (React 19 still requires class components for `componentDidCatch` — hooks can't catch render errors). Use Bloomberg terminal aesthetics for the fallback UI (amber text on black, monospace, sharp corners). Then wire it into the three complex pages at the section level.

For loading states, add `loading.tsx` at the `(protected)` route group level. Since there's no `layout.tsx` in `(protected)` yet, one needs to be created as a pass-through — `loading.tsx` requires a sibling or ancestor layout to work with Suspense boundaries during navigation.

Also add `error.tsx` at the `(protected)` route group level as a last-resort page-level error boundary (Next.js convention), distinct from the section-level `<ErrorBoundary>` components within pages.

## Implementation Landscape

### Key Files

- `src/components/ui/ErrorBoundary.tsx` — **NEW.** Reusable class component with `componentDidCatch`. Props: `children`, optional `fallback` render prop, optional `onError` callback. Default fallback shows error message in Bloomberg terminal style. Includes a "Retry" button that resets the boundary state.
- `src/app/(protected)/loading.tsx` — **NEW.** Route transition loading indicator. Bloomberg-styled pulse animation with "LOADING..." text. Shows during client-side navigation between protected routes.
- `src/app/(protected)/layout.tsx` — **NEW.** Pass-through layout (`{children}`) needed so `loading.tsx` has a Suspense boundary to attach to.
- `src/app/(protected)/error.tsx` — **NEW.** Page-level error boundary (Next.js convention). `'use client'` component receiving `error` and `reset` props. Last-resort catch for unhandled errors that escape section-level boundaries.
- `src/app/(protected)/dashboard/page.tsx` — **MODIFY.** Wrap each major section in `<ErrorBoundary>`: the map container, each sidebar panel (or the panel column as a group). The map is expensive to reinitialize, so its boundary should have a "Retry" that re-mounts only the map, not the whole page.
- `src/app/(protected)/fleet/page.tsx` — **MODIFY.** Wrap the anomaly tables section and the sanctioned vessels section in error boundaries. The page already handles fetch errors via state — the boundary catches render crashes in child components.
- `src/app/(protected)/analytics/page.tsx` — **MODIFY.** Wrap the charts section in an error boundary. The page already handles fetch errors — boundary catches Recharts render crashes.
- `src/app/(protected)/about/page.tsx` — Static content, low crash risk. A route-level `error.tsx` is sufficient; no section-level boundaries needed.

### Build Order

1. **ErrorBoundary component + loading.tsx + layout.tsx + error.tsx** — Build all the new files first. These are independent of each other and of the existing pages. The ErrorBoundary component is the reusable primitive everything else depends on.
2. **Wire boundaries into dashboard page** — Highest impact: 5 panels + map, any crash currently kills everything. Wrap map separately from panels (map is expensive to remount).
3. **Wire boundaries into fleet and analytics pages** — Lower risk pages but still benefit from section-level boundaries around data-rendering components.
4. **Verification** — Confirm a simulated crash shows fallback, confirm route transitions show loading, confirm TypeScript compiles clean.

### Verification Approach

- **Simulated crash test:** Temporarily add `throw new Error('test')` inside a panel component (e.g. NewsPanel), verify the fallback UI renders while the rest of the dashboard remains functional. Remove the throw after confirming.
- **Route transition:** Navigate between dashboard → fleet → analytics and observe the loading indicator appears during transitions.
- **TypeScript:** `npx tsc --noEmit` passes clean.
- **Build:** `npm run build` succeeds.
- **Existing tests:** `npx vitest run` — all existing tests still pass (error boundaries don't break existing component tests since they're additive wrappers).

## Constraints

- React 19 still requires class components for error boundaries — `componentDidCatch` has no hooks equivalent. This is a React design constraint, not a codebase choice.
- The map component (`VesselMap`) is expensive to initialize (Mapbox GL context). The error boundary around it should reset state without unmounting if possible — but if the map itself crashes, a full remount is the only recovery path. The boundary's `reset` key pattern (increment a key to force remount) is the standard approach.
- `loading.tsx` in Next.js App Router works via React Suspense. It requires a layout at the same level or above to provide the Suspense boundary. Currently `(protected)` has no layout, so one must be added.
- Bloomberg aesthetic must be preserved: `bg-black`, `text-amber-500`, `font-mono`, `uppercase tracking-widest`, sharp corners (no `rounded-*`), `border-amber-500/20`.

## Common Pitfalls

- **ErrorBoundary as a server component** — Next.js `error.tsx` must be `'use client'`. The custom `<ErrorBoundary>` component also must be `'use client'` since it uses class component lifecycle methods. Missing the directive causes a build error.
- **loading.tsx without a layout** — Adding `loading.tsx` to `(protected)` without a `layout.tsx` at the same level means Next.js won't create a Suspense boundary for route transitions. The loading state will only show on initial page load, not during navigation. The fix is the pass-through layout.
- **Error boundary catching fetch errors** — React error boundaries only catch errors during rendering, not in event handlers or async code. The fleet/analytics pages already handle fetch errors via `useState` — the boundaries are for render crashes in child components (e.g. Recharts throws on bad data). Don't try to replace the existing fetch error handling.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| React Error Boundaries | `onewave-ai/claude-skills@error-boundary-creator` | available (40 installs) — not needed, pattern is simple |
| React Best Practices | `react-best-practices` | installed |
