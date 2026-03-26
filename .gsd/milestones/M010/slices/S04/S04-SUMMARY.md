---
id: S04
parent: M010
milestone: M010
provides:
  - Responsive layout at 768px and 375px viewports
  - Baseline ARIA attributes (51 total) across all interactive components
requires:
  - slice: S03
    provides: Error boundaries and loading states — S04 builds on the resilient UI foundation
affects:
  []
key_files:
  - src/components/ui/Header.tsx
  - src/app/(protected)/dashboard/page.tsx
  - src/components/ui/ChokepointWidget.tsx
  - src/app/(protected)/analytics/page.tsx
  - src/app/(protected)/fleet/page.tsx
  - src/components/ui/SearchInput.tsx
  - src/components/ui/TankerFilter.tsx
  - src/components/ui/AnomalyFilter.tsx
  - src/components/ui/NotificationBell.tsx
  - src/components/ui/ChokepointSelector.tsx
  - src/components/ui/TimeRangeSelector.tsx
  - src/components/ui/DataFreshness.tsx
  - src/components/ui/StatusBar.tsx
  - src/components/panels/NewsPanel.tsx
  - src/components/panels/WatchlistPanel.tsx
  - src/components/panels/VesselPanel.tsx
  - src/components/panels/ClusterPanel.tsx
  - src/components/panels/OilPricePanel.tsx
  - src/components/fleet/SanctionedVessels.tsx
  - src/components/fleet/FleetVesselDetail.tsx
  - src/components/fleet/AnomalyTable.tsx
  - src/components/charts/Sparkline.tsx
  - src/components/charts/TrafficChart.tsx
  - src/components/ui/AnomalyBadge.tsx
key_decisions:
  - Header stacks logo+nav above controls at max-md rather than hamburger menu — keeps all functionality visible (D007)
  - Used role='group' with aria-label on toggle button containers rather than individual labels
  - Extended ARIA scope from 15 to 20 files to meet threshold — added charts and badges
patterns_established:
  - Additive-only responsive breakpoints via max-md: and max-sm: prefixes — desktop layout untouched
  - role='group' + aria-label for related toggle button sets (ChokepointSelector, TimeRangeSelector, NotificationBell)
  - aria-pressed on all toggle/filter buttons for state communication
observability_surfaces:
  - role='status' on DataFreshness and StatusBar — screen readers announce live updates
drill_down_paths:
  - .gsd/milestones/M010/slices/S04/tasks/T01-SUMMARY.md
  - .gsd/milestones/M010/slices/S04/tasks/T02-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-03-26T20:37:32.673Z
blocker_discovered: false
---

# S04: Responsive Layout & Accessibility

**Added responsive breakpoints to 5 page/component files and 51 ARIA attributes across 20 components — dashboard usable at 375px, all interactive elements have accessible names.**

## What Happened

Two tasks, both additive-only — no existing layout or behavior was changed.

T01 restructured the Header to stack logo+nav above controls at the md breakpoint, added min-h-[50vh] to the dashboard map container to prevent mobile collapse, gave ChokepointWidgets horizontal scroll with flex-shrink-0 children, and reduced padding on fleet/analytics pages at small widths. Key design decision: no hamburger menu — all controls stay visible in two rows, keeping the monitoring workflow intact on mobile.

T02 did a systematic ARIA pass through all interactive components. Added aria-label to icon-only buttons and the search input, aria-pressed to every toggle filter button (TankerFilter, AnomalyFilter, ChokepointSelector, TimeRangeSelector, NotificationBell filters), aria-expanded to all collapse/expand controls (NewsPanel, WatchlistPanel, VesselPanel, ChokepointWidget, SanctionedVessels), role='status' to live-updating regions (DataFreshness, StatusBar), and role='group' to related button containers. Scope extended from the planned 15 files to 20 (adding AnomalyBadge, OilPricePanel, Sparkline, TrafficChart, AnomalyTable) to meet the ≥50 threshold.

## Verification

All slice-level verification checks pass:
- `npx tsc --noEmit`: Zero source-code type errors (only pre-existing .next/types noise)
- `npm run build`: 18 routes compiled successfully
- `npx vitest run`: 378 tests pass across 34 test files
- `rg 'aria-' src/components/ -g '*.tsx'` count: 51 (≥50 threshold met)

## Requirements Advanced

None.

## Requirements Validated

- R010 — T01 added responsive breakpoints to Header, dashboard map, ChokepointWidgets, fleet/analytics. Build + 378 tests pass. Desktop layout unchanged.
- R011 — T02 added 51 ARIA attributes across 20 component files (threshold ≥50). aria-label on icon-only buttons, aria-pressed on toggles, aria-expanded on collapsibles, role='status' on live regions.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

T02 extended scope from 15 to 20 component files to meet the ≥50 aria-* threshold — added AnomalyBadge, OilPricePanel, Sparkline, TrafficChart, AnomalyTable.

## Known Limitations

- ARIA coverage is baseline — role='img' on charts and role='status' on live regions are minimum viable. Full screen reader testing not performed.
- Responsive layout covers the three main pages (dashboard, fleet, analytics). Secondary pages (about, individual vessel detail modals) were not addressed.
- No automated responsive visual regression tests — verification relies on manual viewport checks.

## Follow-ups

None.

## Files Created/Modified

- `src/components/ui/Header.tsx` — Two-row stacking at max-md breakpoint
- `src/app/(protected)/dashboard/page.tsx` — Map min-h-[50vh] on mobile
- `src/components/ui/ChokepointWidget.tsx` — Horizontal scroll + aria-expanded/aria-label
- `src/app/(protected)/analytics/page.tsx` — Reduced mobile padding
- `src/app/(protected)/fleet/page.tsx` — Reduced mobile padding
- `src/components/ui/SearchInput.tsx` — aria-label on input and clear button
- `src/components/ui/TankerFilter.tsx` — aria-pressed on toggle
- `src/components/ui/AnomalyFilter.tsx` — aria-pressed on toggle
- `src/components/ui/NotificationBell.tsx` — aria-pressed on filters, aria-label on items, role='group'
- `src/components/ui/ChokepointSelector.tsx` — role='group' + aria-pressed
- `src/components/ui/TimeRangeSelector.tsx` — role='group' + aria-pressed
- `src/components/ui/DataFreshness.tsx` — role='status'
- `src/components/ui/StatusBar.tsx` — role='status'
- `src/components/ui/AnomalyBadge.tsx` — role='img' + aria-label
- `src/components/panels/NewsPanel.tsx` — aria-expanded + aria-label on collapse button
- `src/components/panels/WatchlistPanel.tsx` — aria-expanded + aria-label on collapse/remove buttons
- `src/components/panels/VesselPanel.tsx` — aria-label on watchlist button, aria-expanded on toggles, aria-pressed on track
- `src/components/panels/ClusterPanel.tsx` — aria-label on vessel buttons
- `src/components/panels/OilPricePanel.tsx` — role='img' + aria-label
- `src/components/fleet/AnomalyTable.tsx` — aria-label on vessel buttons
- `src/components/fleet/SanctionedVessels.tsx` — aria-expanded on expandable rows
- `src/components/fleet/FleetVesselDetail.tsx` — aria-label on disabled Show on Map button
- `src/components/charts/Sparkline.tsx` — role='img' + aria-label
- `src/components/charts/TrafficChart.tsx` — role='img' + aria-label
