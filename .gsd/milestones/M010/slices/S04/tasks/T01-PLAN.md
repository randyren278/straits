---
estimated_steps: 3
estimated_files: 5
skills_used: []
---

# T01: Add responsive breakpoints to Header, dashboard grid, and page layouts

The Header packs ~8 components into a single 56px row that overflows at narrow widths. The dashboard grid has partial responsive support (max-md:flex max-md:flex-col) but the map container collapses to 0 height on mobile. This task restructures the Header for mobile, adds min-height to the map container, adds overflow handling to ChokepointWidgets, and verifies fleet/analytics pages at narrow widths.

**Constraint (D004):** Desktop layout must not change. All responsive rules are additive at max-md: and max-sm: breakpoints only.
**Constraint (KNOWLEDGE):** Tailwind v4 requires static class strings — no dynamic interpolation of breakpoint classes.

## Inputs

- ``src/components/ui/Header.tsx` — current single-row header layout to restructure for mobile`
- ``src/app/(protected)/dashboard/page.tsx` — dashboard grid with max-md:flex max-md:flex-col that needs map min-height`
- ``src/components/ui/ChokepointWidget.tsx` — ChokepointWidgets container that overflows on narrow screens`
- ``src/app/(protected)/analytics/page.tsx` — analytics page to verify/adjust responsive behavior`
- ``src/app/(protected)/fleet/page.tsx` — fleet page to verify/adjust responsive behavior`

## Expected Output

- ``src/components/ui/Header.tsx` — restructured with mobile-friendly layout below md breakpoint (controls hidden or stacked)`
- ``src/app/(protected)/dashboard/page.tsx` — map container has min-h-[50vh] on mobile stacked layout, panel column bounded`
- ``src/components/ui/ChokepointWidget.tsx` — overflow-x-auto or hidden below md breakpoint`
- ``src/app/(protected)/analytics/page.tsx` — minor responsive adjustments if needed`
- ``src/app/(protected)/fleet/page.tsx` — minor responsive adjustments if needed`

## Verification

npx tsc --noEmit && npm run build && npx vitest run
