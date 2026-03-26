# S03: Error Boundaries & Loading States

**Goal:** Add error boundaries around major page sections and loading indicators for route transitions so a single component crash doesn't white-screen the page and navigation feels responsive.
**Demo:** After this: A simulated component crash shows fallback UI instead of white screen. Route transitions show loading spinner.

## Tasks
- [x] **T01: Built reusable ErrorBoundary class component with Bloomberg-styled fallback, route-level loading/error/layout files, and 5 passing tests** — Create the reusable ErrorBoundary class component, the (protected) route group's layout.tsx, loading.tsx, and error.tsx, and a test file that verifies the ErrorBoundary catches render errors and shows fallback UI.

The ErrorBoundary must be a 'use client' class component (React 19 still requires class components for componentDidCatch). Default fallback uses Bloomberg terminal aesthetic: bg-black, text-amber-500, font-mono, uppercase tracking-widest, sharp corners, border-amber-500/20. Includes a 'RETRY' button that resets the boundary's error state.

The layout.tsx is a pass-through ({children}) needed so loading.tsx has a Suspense boundary for route transitions. loading.tsx shows a Bloomberg-styled pulse animation with 'LOADING...' text. error.tsx is the last-resort page-level error boundary receiving error and reset props.
  - Estimate: 45m
  - Files: src/components/ui/ErrorBoundary.tsx, src/components/ui/__tests__/ErrorBoundary.test.tsx, src/app/(protected)/layout.tsx, src/app/(protected)/loading.tsx, src/app/(protected)/error.tsx
  - Verify: npx vitest run src/components/ui/__tests__/ErrorBoundary.test.tsx && npx tsc --noEmit
- [x] **T02: Wrapped major page sections in ErrorBoundary so a component crash shows fallback UI instead of white-screening the page** — Import the ErrorBoundary component and wrap major sections in each page:

**Dashboard (dashboard/page.tsx):** Wrap the map container (<VesselMap>) in its own ErrorBoundary. Wrap the right-column panel stack in a second ErrorBoundary. This way a panel crash doesn't kill the map and vice versa.

**Fleet (fleet/page.tsx):** Wrap the SanctionedVessels + AnomalyTable rendering section (the block inside the `anomalies.length > 0` conditional) in an ErrorBoundary. The page already handles fetch errors via useState — the boundary catches render crashes in child components.

**Analytics (analytics/page.tsx):** Wrap the charts rendering section (the selectedChokepoints.map block) in an ErrorBoundary. Same rationale — fetch errors are already handled, boundary catches Recharts render crashes.

About page is static content — route-level error.tsx from T01 is sufficient coverage.

Run full verification: type-check, all tests pass, build succeeds.
  - Estimate: 30m
  - Files: src/app/(protected)/dashboard/page.tsx, src/app/(protected)/fleet/page.tsx, src/app/(protected)/analytics/page.tsx
  - Verify: npx tsc --noEmit && npx vitest run && npm run build
