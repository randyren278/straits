# S04: Responsive Layout & Accessibility — Research

**Date:** 2026-03-26

## Summary

This slice targets two requirements: R010 (responsive layout at 768px and 375px) and R011 (accessible names on all interactive elements). Both are straightforward applications of known patterns to known code.

**Responsive:** The dashboard already has partial responsive support — `max-md:flex max-md:flex-col` on the main grid — but the Header is the real problem. It renders a horizontal bar with nav tabs, search, freshness indicator, filters, notifications, and status bar all in one row. At 768px this overflows. The fleet and analytics pages use `max-w-7xl mx-auto p-6` which naturally adapts. The chokepoint widgets bar (`flex gap-2` of 160-200px widgets) will also overflow at narrow widths. Per D004, desktop layout must not change — responsive rules are additive at `max-md:` and `max-sm:` breakpoints only.

**Accessibility:** Out of ~24 distinct `<button>` elements across the codebase (excluding tests), only 4 have `aria-label`. The one `<input>` (search) has a placeholder but no `aria-label` or associated `<label>`. Several buttons have visible text content (which is sufficient for screen readers), but icon-only buttons and ambiguous buttons need explicit labels. The key gaps are: SearchInput clear button (icon-only X), TankerFilter (has text but no ARIA context for toggle state), AnomalyFilter (has icon+text but no toggle state), ChokepointWidget expand buttons (icon-only chevrons), chokepoint vessel list buttons, NotificationBell filter buttons, NewsPanel collapse toggle, WatchlistPanel collapse toggle, WatchlistPanel remove buttons, VesselPanel watchlist toggle, VesselPanel section expand buttons, VesselPanel track toggle, FleetVesselDetail "Show on Map" button, and all ChokepointSelector toggle buttons.

## Recommendation

Split into two focused tasks:

1. **Responsive layout** — Modify the Header to stack into a mobile-friendly layout below `md` breakpoint (hide chokepoint widgets, stack nav+controls vertically). Add `overflow-x-auto` on the chokepoint bar. Confirm dashboard grid stacking (already works). Verify fleet and analytics pages work at narrow widths (they should — they use `max-w-7xl` and `p-6`). Adjust analytics controls `flex-wrap` if needed.

2. **ARIA attributes** — Systematic pass through all interactive components adding `aria-label` to icon-only buttons, `aria-expanded` to toggle/collapse buttons, `aria-label` to the search input, and `aria-pressed` or `aria-checked` where appropriate for filter toggles. This is a wide but shallow change — many files, small edits per file.

Build responsive first (higher risk — layout changes could break things), then ARIA (lower risk — additive attributes only).

## Implementation Landscape

### Key Files

**Responsive (Task 1):**
- `src/components/ui/Header.tsx` — Main problem. The `h-14 flex items-center justify-between px-4` layout breaks on narrow screens. Need to reorganize: hide some elements on mobile, or stack the right-side controls. The nav links + right-side widgets don't fit at 375px.
- `src/components/ui/ChokepointWidget.tsx` — The `flex gap-2` container of 160-200px widgets overflows. Needs `overflow-x-auto` and possibly horizontal scroll indicator.
- `src/app/(protected)/dashboard/page.tsx` — Already has `max-md:flex max-md:flex-col`. Verify the right panel gets a bounded height on mobile so it doesn't push the map out of view.
- `src/app/(protected)/analytics/page.tsx` — The controls bar `flex flex-wrap gap-4` should handle narrow screens. Charts use `ResponsiveContainer` from Recharts which auto-adapts. May need to reduce chart height on mobile.
- `src/app/(protected)/fleet/page.tsx` — Uses `max-w-7xl mx-auto p-6`. Tables have `overflow-x-auto` on SanctionedVessels. AnomalyTable needs checking.
- `src/components/fleet/FleetVesselDetail.tsx` — Has `grid grid-cols-1 md:grid-cols-4` which already handles mobile. Good.

**ARIA (Task 2):**
- `src/components/ui/SearchInput.tsx` — Add `aria-label` to input, `aria-label` to clear button, role and aria attributes to dropdown
- `src/components/ui/TankerFilter.tsx` — Add `aria-pressed` for toggle state, `aria-label`
- `src/components/ui/AnomalyFilter.tsx` — Add `aria-pressed` for toggle state, `aria-label`
- `src/components/ui/NotificationBell.tsx` — Already has `aria-label` on bell. Add `aria-pressed` to filter buttons, labels to anomaly items (they're clickable divs → need `role="button"` + `aria-label`)
- `src/components/ui/ChokepointWidget.tsx` — Add `aria-expanded` + `aria-label` to expand buttons, `aria-label` to vessel buttons
- `src/components/ui/ChokepointSelector.tsx` — Add `aria-pressed` to toggle buttons
- `src/components/ui/TimeRangeSelector.tsx` — Add `aria-pressed` or `aria-current` to selected button
- `src/components/ui/DataFreshness.tsx` — Add `role="status"` for live region
- `src/components/ui/StatusBar.tsx` — Add `role="status"` to container
- `src/components/panels/NewsPanel.tsx` — Add `aria-expanded` + `aria-label` to collapse button
- `src/components/panels/WatchlistPanel.tsx` — Add `aria-expanded` + `aria-label` to collapse button, `aria-label` to remove buttons
- `src/components/panels/VesselPanel.tsx` — Add `aria-label` to watchlist button, `aria-expanded` + `aria-label` to section toggles, `aria-pressed` to track toggle
- `src/components/panels/ClusterPanel.tsx` — Already has `aria-label` on close button. Add labels to vessel buttons.
- `src/components/fleet/AnomalyTable.tsx` — Already has `aria-expanded` and `aria-label`. No changes needed.
- `src/components/fleet/SanctionedVessels.tsx` — Expandable rows use `onClick` on `<tr>`. These need keyboard accessibility or at minimum `role="button"` + `tabIndex`. However the `<tr>` pattern is tricky for a11y — can be addressed with `aria-expanded` on the row.
- `src/components/fleet/FleetVesselDetail.tsx` — "Show on Map" button has text content (sufficient). Has `title` but should also get `aria-label` for disabled state context.

### Build Order

1. **T01: Responsive layout** — Header restructuring is the riskiest piece. Dashboard grid, fleet tables, analytics controls. Verify at 768px and 375px viewports using `npm run build` to confirm no Tailwind class issues.
2. **T02: ARIA attributes** — Systematic pass through all interactive components. Lower risk since these are additive-only changes that don't affect layout or behavior. Verify with `npm run build` and grep audit for coverage.

### Verification Approach

- `npx tsc --noEmit` — zero type errors
- `npm run build` — production build succeeds
- `npx vitest run` — all existing tests pass (ARIA changes shouldn't break anything, but responsive className changes could affect snapshot tests if any exist)
- Manual viewport check: describe expected layout behavior at 768px and 375px for dashboard, fleet, analytics
- ARIA audit: `rg 'aria-' src/components/ -g '*.tsx' | wc -l` should increase significantly from current count (~12 occurrences)
- `rg '<button' src/components/ -g '*.tsx' | grep -v test | grep -v aria-label` — buttons without text content should be near zero after this slice

## Constraints

- D004: Desktop layout must not change. Responsive rules are additive only at `max-md:` and `max-sm:` breakpoints.
- Tailwind v4 (KNOWLEDGE): All class strings must be static — no dynamic interpolation of breakpoint classes.
- Bloomberg aesthetic must be preserved — no rounded corners (already enforced by `--radius-*: initial` in globals.css), same color palette, same font.

## Common Pitfalls

- **Header overflow on mobile** — The Header packs ~8 components into a single 56px-tall row. At 375px, even hiding some elements might not be enough. Consider a two-row layout on mobile: nav on top, controls below. Or use a hamburger-style collapse for controls.
- **Map height on mobile stacked layout** — When dashboard switches to `flex-col`, the map needs a fixed/min height or it collapses to 0. The current map container is `relative overflow-hidden` inside a flex child — on mobile with `flex-col`, it needs `min-h-[50vh]` or similar.
- **Chokepoint widgets horizontal scroll** — Adding `overflow-x-auto` works but looks rough without a scroll indicator. Consider hiding the widget bar entirely below `md` since chokepoint data is available on the analytics page.
- **SanctionedVessels table on mobile** — The 5-column table will be tight at 375px. `overflow-x-auto` is already on the wrapper div, so horizontal scroll handles this. But consider if column hiding would be better UX.
