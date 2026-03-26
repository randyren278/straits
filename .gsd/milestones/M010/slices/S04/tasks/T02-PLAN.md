---
estimated_steps: 18
estimated_files: 15
skills_used: []
---

# T02: Add aria-label, aria-pressed, aria-expanded, and role attributes to all interactive components

Systematic pass through all interactive components adding ARIA attributes. Currently only ~5 files have any aria-* attributes. This task adds: aria-label to icon-only buttons and the search input, aria-pressed to toggle filter buttons, aria-expanded to collapse/expand controls, role='status' to live-updating status regions, and aria-label to ambiguous clickable elements.

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

## Inputs

- ``src/components/ui/Header.tsx` — responsive layout from T01 (read-only, verify no conflicts)`
- ``src/components/ui/SearchInput.tsx` — search input and clear button need aria-label`
- ``src/components/ui/TankerFilter.tsx` — toggle button needs aria-pressed`
- ``src/components/ui/AnomalyFilter.tsx` — toggle button needs aria-pressed`
- ``src/components/ui/NotificationBell.tsx` — filter buttons need aria-pressed, items need aria-label`
- ``src/components/ui/ChokepointWidget.tsx` — expand buttons need aria-expanded + aria-label, vessel buttons need aria-label`
- ``src/components/ui/ChokepointSelector.tsx` — toggle buttons need aria-pressed`
- ``src/components/ui/TimeRangeSelector.tsx` — selected button needs aria-pressed`
- ``src/components/ui/DataFreshness.tsx` — needs role='status'`
- ``src/components/ui/StatusBar.tsx` — needs role='status'`
- ``src/components/panels/NewsPanel.tsx` — collapse button needs aria-expanded + aria-label`
- ``src/components/panels/WatchlistPanel.tsx` — collapse button needs aria-expanded, remove buttons need aria-label`
- ``src/components/panels/VesselPanel.tsx` — watchlist button, section toggles, track toggle need ARIA`
- ``src/components/panels/ClusterPanel.tsx` — vessel buttons need aria-label`
- ``src/components/fleet/SanctionedVessels.tsx` — expandable rows need aria-expanded`
- ``src/components/fleet/FleetVesselDetail.tsx` — disabled button needs aria-label for context`

## Expected Output

- ``src/components/ui/SearchInput.tsx` — aria-label on input and clear button`
- ``src/components/ui/TankerFilter.tsx` — aria-pressed on toggle`
- ``src/components/ui/AnomalyFilter.tsx` — aria-pressed on toggle`
- ``src/components/ui/NotificationBell.tsx` — aria-pressed on filters, aria-label on items`
- ``src/components/ui/ChokepointWidget.tsx` — aria-expanded + aria-label on expand, aria-label on vessel buttons`
- ``src/components/ui/ChokepointSelector.tsx` — aria-pressed on toggles`
- ``src/components/ui/TimeRangeSelector.tsx` — aria-pressed on selected`
- ``src/components/ui/DataFreshness.tsx` — role='status'`
- ``src/components/ui/StatusBar.tsx` — role='status'`
- ``src/components/panels/NewsPanel.tsx` — aria-expanded + aria-label on collapse`
- ``src/components/panels/WatchlistPanel.tsx` — aria-expanded + aria-label on collapse and remove`
- ``src/components/panels/VesselPanel.tsx` — ARIA on watchlist, section toggles, track toggle`
- ``src/components/panels/ClusterPanel.tsx` — aria-label on vessel buttons`
- ``src/components/fleet/SanctionedVessels.tsx` — aria-expanded on expandable rows`
- ``src/components/fleet/FleetVesselDetail.tsx` — aria-label on Show on Map button`

## Verification

npx tsc --noEmit && npm run build && npx vitest run && test $(rg 'aria-' src/components/ -g '*.tsx' --no-filename -c 2>/dev/null | paste -sd+ - | bc) -ge 50
