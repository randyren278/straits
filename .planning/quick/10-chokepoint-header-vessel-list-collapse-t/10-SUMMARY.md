---
phase: quick-10
plan: 10
subsystem: ui
tags: [react, chokepoint, dropdown, collapsible, lucide-react]

requires: []
provides:
  - Collapsible chokepoint widgets with absolute-positioned dropdown vessel list
  - Single-open-at-a-time expandedId toggle pattern
  - Rotating ChevronDown indicator per widget
affects: [ui, header]

tech-stack:
  added: []
  patterns:
    - "Absolute dropdown below fixed-height header using relative parent + absolute child with top-full"
    - "Single expanded state (expandedId: string | null) enforces one-open-at-a-time without complexity"

key-files:
  created: []
  modified:
    - src/components/ui/ChokepointWidget.tsx

key-decisions:
  - "expandedId state lives in parent ChokepointWidgets — single source of truth, ensures only one dropdown open at a time"
  - "Dropdown uses absolute left-0 top-full z-50 anchored to relative widget container — header row height unaffected"
  - "onSelect (map flyTo) still fires on header click alongside expand toggle — both behaviors preserved"
  - "border-t-0 on dropdown removes the double-border between widget bottom and dropdown top"

patterns-established:
  - "Collapsible dropdown pattern: relative wrapper + absolute top-full child + expandedId toggle"

requirements-completed: []

duration: 3min
completed: 2026-03-17
---

# Quick Task 10: Chokepoint Header Vessel List Collapse Summary

**Chokepoint vessel lists converted from always-visible inline content to click-to-expand absolute dropdowns, keeping header row fixed height**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-17T22:39:00Z
- **Completed:** 2026-03-17T22:42:29Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Removed inline vessel list that caused variable header height
- Added `expandedId` state (string | null) — clicking a widget opens its dropdown, clicking again closes it, clicking another closes the previous
- Dropdown is absolute-positioned below the header button using `top-full` on a `relative` wrapper — header row height is now constant
- Added ChevronDown icon from lucide-react that rotates 180deg when dropdown is open

## Task Commits

1. **Task 1: Add collapse state and dropdown positioning to ChokepointWidget** - `f1e0ea2` (feat)

## Files Created/Modified
- `src/components/ui/ChokepointWidget.tsx` - Refactored with collapsible dropdown: expandedId state, relative wrapper, absolute dropdown, ChevronDown indicator

## Decisions Made
- `expandedId` lives in the parent component so only one widget can be expanded at a time — simpler than per-widget boolean state
- `border-t-0` on dropdown panel removes double-border artifact between header and dropdown
- Both `setExpandedId` and `onSelect` fire on click — map still flies to chokepoint bounds while toggling the dropdown

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Header row is now uniform height regardless of vessel data
- Vessel lists accessible on demand via click, reducing visual clutter in the header area
- No blockers

---
*Phase: quick-10*
*Completed: 2026-03-17*
