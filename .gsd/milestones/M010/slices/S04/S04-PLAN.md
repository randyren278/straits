# S04: Responsive Layout & Accessibility

**Goal:** Dashboard, fleet, and analytics pages render usably at 768px and 375px viewports. All interactive elements have accessible names.
**Demo:** After this: Dashboard renders usably at 768px and 375px. All buttons have accessible names.

## Tasks
- [ ] **T01: Add responsive breakpoints to Header, dashboard grid, and page layouts** — The Header packs ~8 components into a single 56px row that overflows at narrow widths. The dashboard grid has partial responsive support (max-md:flex max-md:flex-col) but the map container collapses to 0 height on mobile. This task restructures the Header for mobile, adds min-height to the map container, adds overflow handling to ChokepointWidgets, and verifies fleet/analytics pages at narrow widths.

**Constraint (D004):** Desktop layout must not change. All responsive rules are additive at max-md: and max-sm: breakpoints only.
**Constraint (KNOWLEDGE):** Tailwind v4 requires static class strings — no dynamic interpolation of breakpoint classes.
  - Estimate: 45m
  - Files: src/components/ui/Header.tsx, src/app/(protected)/dashboard/page.tsx, src/components/ui/ChokepointWidget.tsx, src/app/(protected)/analytics/page.tsx, src/app/(protected)/fleet/page.tsx
  - Verify: npx tsc --noEmit && npm run build && npx vitest run
- [ ] **T02: Add aria-label, aria-pressed, aria-expanded, and role attributes to all interactive components** — Systematic pass through all interactive components adding ARIA attributes. Currently only ~5 files have any aria-* attributes. This task adds: aria-label to icon-only buttons and the search input, aria-pressed to toggle filter buttons, aria-expanded to collapse/expand controls, role='status' to live-updating status regions, and aria-label to ambiguous clickable elements.

This is additive-only — no layout or behavior changes. Every edit adds HTML attributes without modifying existing className, onClick, or component structure.

**Components to update (in order):**
1. SearchInput — aria-label on input, aria-label on clear button (icon-only X), role='listbox' on dropdown
2. TankerFilter — aria-pressed for toggle state
3. AnomalyFilter — aria-pressed for toggle state
4. NotificationBell — aria-pressed on filter buttons, aria-label on anomaly items
5. ChokepointWidget — aria-expanded + aria-label on expand buttons, aria-label on vessel buttons
6. ChokepointSelector — aria-pressed on toggle buttons
7. TimeRangeSelector — aria-pressed on selected button
8. DataFreshness — role='status' for live region
9. StatusBar — role='status' on container
10. NewsPanel — aria-expanded + aria-label on collapse button
11. WatchlistPanel — aria-expanded + aria-label on collapse button, aria-label on remove buttons
12. VesselPanel — aria-label on watchlist button, aria-expanded on section toggles, aria-pressed on track toggle
13. ClusterPanel — aria-label on vessel buttons (close button already has aria-label)
14. SanctionedVessels — aria-expanded on expandable rows, keyboard accessibility
15. FleetVesselDetail — aria-label on disabled 'Show on Map' button for context
  - Estimate: 45m
  - Files: src/components/ui/SearchInput.tsx, src/components/ui/TankerFilter.tsx, src/components/ui/AnomalyFilter.tsx, src/components/ui/NotificationBell.tsx, src/components/ui/ChokepointWidget.tsx, src/components/ui/ChokepointSelector.tsx, src/components/ui/TimeRangeSelector.tsx, src/components/ui/DataFreshness.tsx, src/components/ui/StatusBar.tsx, src/components/panels/NewsPanel.tsx, src/components/panels/WatchlistPanel.tsx, src/components/panels/VesselPanel.tsx, src/components/panels/ClusterPanel.tsx, src/components/fleet/SanctionedVessels.tsx, src/components/fleet/FleetVesselDetail.tsx
  - Verify: npx tsc --noEmit && npm run build && npx vitest run && test $(rg 'aria-' src/components/ -g '*.tsx' --no-filename -c 2>/dev/null | paste -sd+ - | bc) -ge 50
