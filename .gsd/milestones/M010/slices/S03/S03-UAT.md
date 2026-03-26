# S03: Error Boundaries & Loading States — UAT

**Milestone:** M010
**Written:** 2026-03-26T20:18:45.968Z

# S03: Error Boundaries & Loading States — UAT

**Milestone:** M010
**Written:** 2026-03-26

## UAT Type

- UAT mode: mixed (artifact-driven + live-runtime)
- Why this mode is sufficient: Error boundaries can be verified via automated tests (artifact-driven) and by triggering real component crashes in the browser (live-runtime). Loading states require observing route transitions in a running app.

## Preconditions

- `docker compose up -d` (TimescaleDB running)
- `npm run dev` (Next.js dev server on localhost:3000)
- Browser open to http://localhost:3000

## Smoke Test

Navigate to http://localhost:3000/dashboard. The page loads without errors. Open browser DevTools console — no ErrorBoundary-related warnings or errors.

## Test Cases

### 1. ErrorBoundary catches render crash on dashboard map

1. Temporarily edit `src/components/map/VesselMap.tsx` to add `throw new Error('test crash')` at the top of the component function body
2. Navigate to http://localhost:3000/dashboard
3. **Expected:** The map area shows a Bloomberg-styled error fallback (black background, amber text, "COMPONENT ERROR" heading, "RETRY" button). The right-column panels still render normally — they are in a separate ErrorBoundary.

### 2. ErrorBoundary catches render crash on dashboard panels

1. Temporarily edit one of the panel components (e.g. `src/components/intelligence/NewsPanel.tsx`) to add `throw new Error('test crash')` at the top of the component function body
2. Navigate to http://localhost:3000/dashboard
3. **Expected:** The right-column panel area shows the error fallback. The map still renders normally — it is in a separate ErrorBoundary.

### 3. Retry button resets error state

1. With the crash from test case 1 still in place, observe the error fallback on the dashboard
2. Remove the `throw new Error('test crash')` line from VesselMap.tsx (hot reload will update)
3. Click the "RETRY" button on the error fallback
4. **Expected:** The error fallback disappears and the map renders normally

### 4. ErrorBoundary on fleet page

1. Temporarily edit `src/components/fleet/AnomalyTable.tsx` to add `throw new Error('test crash')` at the top of the component function body
2. Navigate to http://localhost:3000/fleet
3. **Expected:** The anomaly tables section shows the error fallback. The page header and navigation still render.

### 5. ErrorBoundary on analytics page

1. Temporarily edit one of the chart components to add `throw new Error('test crash')`
2. Navigate to http://localhost:3000/analytics
3. **Expected:** The charts section shows the error fallback. The page header and chokepoint selector still render.

### 6. Route transition loading indicator

1. Navigate to http://localhost:3000/dashboard
2. Click the "Fleet" navigation link
3. **Expected:** A loading indicator with "LOADING..." text appears briefly during the route transition (Bloomberg-styled: black background, amber pulsing text)

### 7. Route-level error.tsx as last resort

1. Temporarily edit `src/app/(protected)/about/page.tsx` to add `throw new Error('test crash')` at the top
2. Navigate to http://localhost:3000/about
3. **Expected:** The page-level error fallback renders (from error.tsx) with Bloomberg styling and a "TRY AGAIN" button

## Edge Cases

### Multiple rapid retries

1. With a crashing component, click "RETRY" multiple times rapidly
2. **Expected:** Each click resets the boundary. Since the component still crashes, the fallback reappears each time. No console errors about state updates on unmounted components.

### Nested error — boundary catches closest

1. If a chart component inside the analytics ErrorBoundary crashes, the analytics boundary catches it
2. **Expected:** The route-level error.tsx does NOT activate — the section-level boundary handles it first

## Failure Signals

- White screen on any page after a component crash (ErrorBoundary not catching)
- "RETRY" button not visible in the error fallback
- Loading indicator not appearing during route transitions (missing layout.tsx or loading.tsx)
- Error fallback not matching Bloomberg aesthetic (wrong colors, fonts, or styling)
- A crash in the map section taking down the panel section on the dashboard (boundaries not isolated)

## Not Proven By This UAT

- Error boundary behavior with async/server component errors (these are caught differently in Next.js)
- Performance impact of error boundaries on render time
- Error reporting to external services (onError callback exists but no service is wired)

## Notes for Tester

- All test cases that inject `throw new Error()` require reverting the change after testing. Hot module reload should pick up the revert automatically.
- The loading indicator in test case 6 may be very brief on fast connections — slow down with Chrome DevTools network throttling (Slow 3G) to observe it clearly.
- Error boundary fallbacks use the same Bloomberg aesthetic as the rest of the app: true black (#000), amber-500 text, JetBrains Mono font, uppercase tracking-widest.
