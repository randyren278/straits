---
estimated_steps: 6
estimated_files: 3
skills_used: []
---

# T02: Wire ErrorBoundary into dashboard, fleet, and analytics pages

Import the ErrorBoundary component and wrap major sections in each page:

**Dashboard (dashboard/page.tsx):** Wrap the map container (<VesselMap>) in its own ErrorBoundary. Wrap the right-column panel stack in a second ErrorBoundary. This way a panel crash doesn't kill the map and vice versa.

**Fleet (fleet/page.tsx):** Wrap the SanctionedVessels + AnomalyTable rendering section (the block inside the `anomalies.length > 0` conditional) in an ErrorBoundary. The page already handles fetch errors via useState — the boundary catches render crashes in child components.

**Analytics (analytics/page.tsx):** Wrap the charts rendering section (the selectedChokepoints.map block) in an ErrorBoundary. Same rationale — fetch errors are already handled, boundary catches Recharts render crashes.

About page is static content — route-level error.tsx from T01 is sufficient coverage.

Run full verification: type-check, all tests pass, build succeeds.

## Inputs

- ``src/components/ui/ErrorBoundary.tsx` — the reusable ErrorBoundary component from T01`
- ``src/app/(protected)/dashboard/page.tsx` — dashboard page to modify`
- ``src/app/(protected)/fleet/page.tsx` — fleet page to modify`
- ``src/app/(protected)/analytics/page.tsx` — analytics page to modify`

## Expected Output

- ``src/app/(protected)/dashboard/page.tsx` — map and panel column each wrapped in ErrorBoundary`
- ``src/app/(protected)/fleet/page.tsx` — anomaly tables section wrapped in ErrorBoundary`
- ``src/app/(protected)/analytics/page.tsx` — charts section wrapped in ErrorBoundary`

## Verification

npx tsc --noEmit && npx vitest run && npm run build
