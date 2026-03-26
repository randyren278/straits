# S04: Responsive Layout & Accessibility — UAT

**Milestone:** M010
**Written:** 2026-03-26T20:37:32.673Z

# S04: Responsive Layout & Accessibility — UAT

**Milestone:** M010
**Written:** 2026-03-26

## UAT Type

- UAT mode: mixed (artifact-driven for ARIA verification, human-experience for responsive layout)
- Why this mode is sufficient: ARIA attributes can be verified by grep count and build passing. Responsive layout requires visual confirmation at specific viewport widths that automated tests don't cover.

## Preconditions

- `npm run dev` running (Next.js dev server at localhost:3000)
- Browser with DevTools available (for viewport resizing and accessibility inspection)

## Smoke Test

Open http://localhost:3000/dashboard in a browser window resized to 375px width. The page should render without horizontal overflow — Header in two rows, map visible with ≥50vh height, panels stacked below.

## Test Cases

### 1. Header responsive stacking

1. Open http://localhost:3000/dashboard at full desktop width (≥1024px)
2. Confirm Header is a single row with logo, nav links, search, filters, and status all inline
3. Resize browser to 768px width
4. **Expected:** Header splits into two rows — logo+nav on top, search+filters+controls below. All controls remain visible (no hamburger menu).

### 2. Dashboard map container on mobile

1. Resize browser to 375px width on /dashboard
2. **Expected:** Map container has visible height (≥50vh). Map is usable — can pan/zoom. Panels stack below the map in a single column.

### 3. ChokepointWidgets horizontal scroll

1. On /dashboard at 375px width, scroll down to the chokepoint widget area
2. **Expected:** Chokepoint cards are arranged in a horizontal scrollable row. Swiping/scrolling horizontally reveals additional chokepoints. No cards are clipped or overlapping.

### 4. Fleet page mobile padding

1. Navigate to /fleet at 375px width
2. **Expected:** Page renders with reduced padding. Anomaly tables are readable. No horizontal overflow on the page body.

### 5. Analytics page mobile padding

1. Navigate to /analytics at 375px width
2. **Expected:** Charts stack vertically with reduced padding. Chart labels remain readable.

### 6. ARIA count threshold

1. Run: `rg -c 'aria-' src/components/ -g '*.tsx' --no-filename | awk '{s+=$1} END {print s}'`
2. **Expected:** Output is ≥ 50

### 7. Toggle buttons have aria-pressed

1. Open /dashboard and inspect TankerFilter buttons in DevTools
2. Click a filter to toggle it on
3. **Expected:** The active button has `aria-pressed="true"`, inactive buttons have `aria-pressed="false"`
4. Repeat for ChokepointSelector and TimeRangeSelector

### 8. Collapsible panels have aria-expanded

1. On /dashboard, inspect the News panel collapse button
2. **Expected:** When expanded, button has `aria-expanded="true"`. After collapsing, `aria-expanded="false"`.
3. Repeat for WatchlistPanel and VesselPanel section toggles.

### 9. Live regions have role='status'

1. Inspect the DataFreshness component in DevTools
2. **Expected:** Container has `role="status"`. Screen reader announces updates when data freshness changes.
3. Inspect StatusBar — should also have `role="status"`.

### 10. Icon-only buttons have aria-label

1. Inspect the SearchInput clear button (X icon) in DevTools
2. **Expected:** Has `aria-label` describing its purpose (e.g. "Clear search")
3. Inspect ChokepointWidget expand buttons — should have aria-label.

## Edge Cases

### Desktop layout unchanged

1. View /dashboard at 1440px width
2. **Expected:** Layout is identical to pre-S04 — grid-cols-[1fr_320px], 56px header, amber-on-black aesthetic. No visible difference from desktop users' perspective.

### Very narrow viewport (320px)

1. Resize to 320px width on /dashboard
2. **Expected:** Content may be tight but no horizontal scrollbar on the page body. Header controls wrap within their row. Nothing is completely invisible or unreachable.

## Failure Signals

- Horizontal scrollbar on the page body (not within a scroll container like ChokepointWidgets) at any viewport width
- Any button in DevTools Accessibility panel showing "unnamed" or "no accessible name"
- Map container collapsing to 0 height on mobile
- Desktop layout visually different from before S04

## Not Proven By This UAT

- Full screen reader workflow testing (NVDA/VoiceOver end-to-end)
- Secondary pages (about, vessel detail modals)
- Automated visual regression at different viewports
- Touch interaction quality on actual mobile devices

## Notes for Tester

- The aria-* count of 51 meets the ≥50 threshold but is baseline coverage. Some complex interactive patterns (e.g. the map itself, Recharts chart internals) are not covered by these attributes.
- Responsive changes are additive via `max-md:` and `max-sm:` Tailwind prefixes. If desktop looks different, that's a regression — the base classes should be untouched.
