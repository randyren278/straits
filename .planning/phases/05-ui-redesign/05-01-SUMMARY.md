---
phase: 05-ui-redesign
plan: "01"
subsystem: ui
tags: [tailwind, css-tokens, jetbrains-mono, design-system, bloomberg-terminal]

# Dependency graph
requires: []
provides:
  - "@theme block in globals.css with --radius-*: initial enforcing zero border-radius"
  - "JetBrains Mono registered as --font-jetbrains CSS variable on html element"
  - "bg-black true-black body background replacing #1a1a2e"
  - "font-mono Tailwind utility mapped to JetBrains Mono via --font-jetbrains"
affects:
  - 05-02-component-sweep
  - 05-03-layout-polish

# Tech tracking
tech-stack:
  added:
    - JetBrains_Mono (next/font/google)
  patterns:
    - "@theme block for Tailwind v4 design token registration"
    - "CSS variable font injection: next/font variable prop → html className → @theme --font-mono"

key-files:
  created: []
  modified:
    - src/app/globals.css
    - src/app/layout.tsx

key-decisions:
  - "No color overrides in @theme — Tailwind v4 defaults for amber-500 (#f59e0b) and black (#000000) are correct as-is"
  - "--radius-*: initial zeroes all rounded-* utilities globally, enforcing sharp terminal aesthetic"
  - "JetBrains Mono loaded with display: swap for font render performance"
  - "body sans-serif falls back to browser default (acceptable for terminal aesthetic, only mono font is branded)"

patterns-established:
  - "Terminal aesthetic: --radius-*: initial blocks all rounded-* classes — do not add rounded-* to components"
  - "Font usage: font-mono class resolves to JetBrains Mono at runtime throughout the app"

requirements-completed:
  - UI-01
  - UI-02

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 5 Plan 01: Design System Tokens Summary

**Bloomberg terminal design token layer: JetBrains Mono via CSS variable and global zero-radius enforcement via Tailwind v4 @theme block**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T06:20:40Z
- **Completed:** 2026-03-13T06:21:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `@theme` block to globals.css zeroing all border-radius utilities (`--radius-*: initial`) to enforce sharp terminal aesthetic
- Registered JetBrains Mono as CSS variable `--font-jetbrains` injected on `<html>` via `next/font/google`
- Mapped Tailwind `font-mono` utility to JetBrains Mono via `@theme --font-mono: var(--font-jetbrains)`
- Replaced `bg-[#1a1a2e]` with `bg-black` (true black #000000) on body element
- All 338 existing Vitest tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add @theme design tokens to globals.css** - `d3f451f` (feat)
2. **Task 2: Register JetBrains Mono font in layout.tsx** - `9684a16` (feat)

## Files Created/Modified

- `src/app/globals.css` - Added @theme block with --radius-*: initial and --font-mono token registration
- `src/app/layout.tsx` - Replaced Inter with JetBrains_Mono, added variable prop, updated html/body classNames

## Decisions Made

- No color token overrides in @theme — Tailwind v4 defaults for amber-500 and black are already correct values
- `--radius-*: initial` approach chosen over individual `--radius-sm/md/lg: 0` for completeness (all variants zeroed in one line)
- `display: swap` for JetBrains Mono to avoid invisible text during font load
- Body sans-serif remains browser default — only monospace font is branded (terminal aesthetic is acceptable)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Token layer is complete and in place — Plans 02 and 03 can now reference `font-mono` and expect zero border-radius
- All downstream component sweeps (`rounded-*` audit) are unblocked
- No blockers

---
*Phase: 05-ui-redesign*
*Completed: 2026-03-13*
