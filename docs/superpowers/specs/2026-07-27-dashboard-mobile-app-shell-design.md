# Dashboard mobile app shell — design

**Status:** approved direction (M1), pending implementation
**Supersedes on mobile:** the header/panel layout described in `2026-07-24-mobile-first-ui-rework-design.md`
**Companion:** `2026-07-27-fleet-tabs-design.md` (same measurement doctrine)

## Problem

Measured on live production at 390×844, not eyeballed:

| Metric | Live | Target |
|---|---|---|
| `<header>` height | **275px (33% of viewport)** | ≤110px total fixed chrome |
| Header at 360×800 | 299px (37%) | ≤110px |
| Header with Chokepoints open | **487px (58%)** | unchanged by disclosure |
| Distinct y-baselines in header | 9, no shared grid | strict 44px rows |
| Visibly bordered boxes in header | 6 | ≤2 |
| Scroll to reach oil prices | 1.04 screens | 0 |
| Scroll to end of intel feed | 3.11 screens | ≤1.0 |
| INTEL FEED height | 1020px, uncapped | ≤8 items |
| Primary controls in thumb zone | **0%** | navigation reachable |
| Distinct spacing values | 10 | ≤6 |

The header's excess 165px is six dashboard-only widgets flow-wrapping into leftover
space. Every other route in the app renders the same header at 110px.

Three reviewers adjudicated the live page. Their non-obvious findings:

- **`DataFreshness` and `StatusBar` are the same information** in two visual
  languages 54px apart. Amber dots beside "less than a minute ago" signal
  contradictory states.
- **`NotificationBell` has no unread badge in the live DOM** — 1,936px² conveying
  nothing at a glance.
- **Typography is already coherent** (3 sizes, 3 line-heights). The incoherence is
  spacing sprawl and amber fragmented across 5 alpha tiers with no semantic map.
- **The intel feed has no cap** — its height scales with API results.

## Approach

Mobile stops mirroring desktop. Navigation moves to a thumb-reachable bottom bar,
the map runs nearly full-bleed, and every panel moves into a bottom sheet.

```
┌──────────────────────────┐
│ ▪ STRAITS   ●1m  ⌕  🔔³  │  44px  top bar
├──────────────────────────┤
│  [All Vessels ▾][Anomalies] │      floating chips, on the map
│           MAP            │  fills
│                          │
├──────────────────────────┤
│ ══════ (44px handle)     │  sheet, peek detent
│ HORMUZ 10/23 · SUEZ 85…  │  44px strip
├──────────────────────────┤
│  MAP  ANALYTICS  FLEET … │  56px bottom nav
└──────────────────────────┘
```

Verified against the built mockup: **100px fixed chrome, 1.00 screens, 0px
horizontal overflow** at both 390×844 and 360×800.

## Decisions

**D1 — The bottom nav is site-wide on mobile, not dashboard-only.**
Hiding the header's `<nav>` on mobile without a replacement would strand
`/fleet`, `/analytics`, and `/about` with no navigation. `MobileBottomNav` renders
from `src/app/(protected)/layout.tsx` so all four routes get it. The layout is
currently a pass-through; it gains this one responsibility.

**D2 — Desktop is unchanged.** Every change is gated behind `max-lg:` /
`lg:hidden`. The `lg` breakpoint (1024px) is already this project's mobile
boundary. Desktop geometry is regression-checked against
`.ui-baseline/desktop-1440x900.json` via `node scripts/ui-audit.mjs desktop`.

**D3 — Duplicated controls use `display:none`, never `visibility` or opacity.**
The map filter chips and the header filter row are two instances of the same
control. Tailwind's `hidden` / `max-lg:hidden` computes to `display:none`, which
removes the element from the accessibility tree, so exactly one instance is ever
exposed. Verification asserts exactly one hit-testable instance per control.

**D4 — Selecting a vessel collapses the panel sheet.**
Two stacked sheets competing for the same bottom edge is the defect this
redesign exists to remove. When `selectedVessel` becomes non-null the panel sheet
returns to its peek detent and the vessel sheet opens above the bottom nav
(`bottom: 56px`, not `bottom: 0`). Closing the vessel sheet leaves the panel
sheet at peek.

**D5 — The status chip merges freshness and system health.**
One element replaces `DataFreshness` + `StatusBar` on mobile: a single dot
carrying the worst of the three source states, plus the relative age. Tapping it
discloses the per-source breakdown. `DataFreshness` renders nothing when
`lastUpdate` is null (non-dashboard routes); the chip must still render its
status dot in that case, showing health without an age.

**D6 — The intel feed caps at 8 items with an expand control.**
Matches the ceiling discipline `/fleet` already uses. 8 × ~65px + 44px header
≈ 564px, down from 1020px. The full 15 remain one tap away.

**D7 — Chokepoints leave the header entirely on mobile.**
They become the sheet's peek strip and its first tab. This alone removes 61px at
rest and the 212px expansion. Desktop keeps the existing header row.

## Components

**New**
- `src/components/ui/MobileBottomNav.tsx` — 4 items, `lg:hidden`, fixed, honours
  `env(safe-area-inset-bottom)`. Active route from `usePathname()`. Each item ≥44px.
- `src/components/ui/StatusChip.tsx` — merged status + freshness (D5), with a
  disclosure listing AIS / Prices / News.
- `src/components/dashboard/MobileSheet.tsx` — 3 detents (peek 88px / half 420px /
  full 656px), tabs Chokepoints · Prices · Intel. The handle is itself the 44px
  target; **no absolutely-positioned invisible hit area** — that pattern swallowed
  every tap meant for the tabs in the mockup's first build.
- `src/components/map/MapFilterChips.tsx` — `TankerFilter` + `AnomalyFilter`
  positioned over the map, `lg:hidden`.

**Modified**
- `src/components/ui/Header.tsx` — mobile collapses to one 44px row: mark,
  wordmark, status chip, search icon, bell. `<nav>` gains `max-lg:hidden`; the
  filter cluster and chokepoint row gain `max-lg:hidden`.
- `src/app/(protected)/layout.tsx` — renders `MobileBottomNav`.
- `src/app/(protected)/dashboard/page.tsx` — map fills; panels move into the sheet;
  vessel sheet anchors above the nav.
- `src/components/panels/NewsPanel.tsx` — 8-item cap + expand (D6).
- `fleet`, `analytics`, `about` pages — `max-lg:pb-14` so content clears the fixed nav.

**Reused, not rebuilt:** `useVesselStore` for filter state, `SearchInput`'s
existing result handling, `handleRowKeyDown` from the fleet work, the
`FleetTabs` roving-tabindex keyboard pattern.

## Verification

Screenshots are not evidence on this project — a prior audit shipped 105 findings
and still missed four user-visible defects, because a screenshot cannot show
below-the-fold content or post-interaction state. Every check is a number.

New: `scripts/verify-dashboard-layout.mjs`, modelled on `verify-fleet-layout.mjs`.

Asserted at 390×844 and 360×800, on `/dashboard` and the three other routes:
1. Fixed chrome (top bar + bottom nav) ≤110px
2. Total scroll ≤1.0 screens on `/dashboard`
3. Horizontal overflow = 0
4. Every interactive element ≥44×44
5. **Every control is hit-testable at its own centre** — no invisible overlay
   intercepts it (this is the guard that caught the mockup's swallowed taps)
6. Exactly one hit-testable instance of each duplicated control (D3)
7. Sheet cycles peek → half → full, and the tabs are clickable in each detent
8. Selecting a vessel collapses the panel sheet to peek (D4)
9. Intel renders ≤8 items until expanded
10. Bottom nav present and above the fold on all four routes
11. Desktop 1440×900 geometry unchanged vs the recorded baseline

Unit tests colocated as `src/**/*.test.tsx`, run with `npx vitest run`.

## Out of scope

- Desktop layout changes
- The amber-alpha semantic remap and the spacing-scale consolidation — real
  findings, but they touch every component in the app and belong in their own pass
- Adding an unread badge to `NotificationBell` (a data question, not layout)
- Two live-site checks still unverified: vessel-sheet focus trap / Escape, and
  search-dropdown clipping. To be closed against a local dev server during
  implementation.
