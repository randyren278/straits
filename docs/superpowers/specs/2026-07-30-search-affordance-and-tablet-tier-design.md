# Vessel search affordances & the tablet tier

**Date:** 2026-07-30
**Status:** Approved, ready for planning
**Mockup:** https://claude.ai/code/artifact/0e41ba4f-606e-45ed-abb0-f508984a28a7

Two independent fixes, approved from an interactive HTML mockup before any
implementation:

1. **Search** tells the user nothing until it decides to, and silently dead-ends
   on vessels without a position fix.
2. **There is no tablet tier** — one `lg` breakpoint at 1024px slices straight
   between iPad portrait and iPad landscape.

---

## Part 1 — Vessel search

### Problem

The backend is healthy. Verified against production before designing around it:

| Query | Result |
|---|---|
| `a` | `[]` — the API floor is 2 characters |
| `te` | 10 hits |
| `TENDUA` | exact name hit |
| `9299862` | exact IMO hit |
| `front` | FRONT EMPIRE, FRONT ENDEAVOUR, … |

The failure is entirely in `src/components/ui/SearchInput.tsx`. Six states, five
of which render nothing or near-nothing:

| User action | Current behaviour | Cause |
|---|---|---|
| Focus the empty field | Nothing | No empty state; placeholder is `Search vessel...` |
| Type 1 character | Nothing | `query.length < 2` clears results and returns before opening the dropdown (`SearchInput.tsx:37`) |
| Wait for the request | Nothing | `loading` is tracked but never rendered (`SearchInput.tsx:42`) |
| Read a result row | `IMO: 9299862 \| ` | Template joins `flag` unconditionally (`SearchInput.tsx:150`); `flag` is `null` for most of the fleet, leaving a dangling pipe |
| Pick an unplaced vessel | Dropdown closes, nothing else | `dashboard/page.tsx:62` guards on `latitude !== null && longitude !== null` with no `else` |
| Get zero matches | `No vessels found` | No query echo, no recovery route |

The fifth row is a defect, not a polish item: vessels the AIS feed has not yet
placed are a genuinely dead click.

### Design

Every state produces visible output.

| State | Renders |
|---|---|
| Empty + focused | `Search the fleet` / "By vessel name, IMO number, or MMSI. Two characters minimum." / three tappable real examples: `TENDUA` (name), `9299862` (IMO), `front` (partial) |
| 1 character | `1 more character — search needs at least two.` States the exact remaining gap, not a generic minimum |
| In flight | Spinner inside the field + three skeleton rows |
| Results | Sticky header with count and `↑↓ move  ↵ open`; per row: name, sanction chip when `risk != null`, position chip (`TRACKING` / `NO FIX`), and `IMO · MMSI · FLAG` with absent fields omitted rather than joined |
| Zero matches | `No vessel matches "<query>". IMO numbers always resolve exactly — try one of those.` Query is echoed, escaped |
| Picked, unplaced | Opens the vessel dossier with a banner stating no position fix is available |

The dangling-pipe fix is structural: build the subtitle by pushing only
present fields into an array and joining with `·`, rather than interpolating a
fixed template.

### Scope

- `src/components/ui/SearchInput.tsx` — all six states
- `src/app/(protected)/dashboard/page.tsx` — the missing `else` branch on
  `handleSearchSelect`

The `else` branch resolves cleanly against the existing types, which was
verified rather than assumed:

- `setSelectedVessel` accepts `VesselWithPosition`, whose `position` field is
  already `VesselPosition | null` (`src/types/vessel.ts:57`). An unplaced vessel
  is therefore representable as
  `{ imo, mmsi, name, flag, shipType, destination: null, lastSeen: new Date(), position: null }`
  — no cast, no widening of the store.
- `VesselPanel` already reads every position field through optional chaining
  with an `'N/A'` fallback (`VesselPanel.tsx:202-222`), so it renders correctly
  against `position: null` with no change.

One small type change is required: the local `SearchResult` interface, declared
identically in both `SearchInput.tsx:11` and `Header.tsx:21`, omits `shipType`
even though the API returns it. Both copies gain the field so the constructed
vessel is complete.

No API change. `searchVessels()` in `src/lib/db/search.ts` and
`src/app/api/vessels/search/route.ts` are correct as written.

### Non-goals

Recent-search history, fuzzy matching, and search on routes other than
`/dashboard` are out of scope.

---

## Part 2 — The tablet tier

### Problem

Every responsive decision in the codebase is a single `lg` switch at 1024px:
`max-lg:` for the phone stack, `lg:` for a layout laid out at 1440px. There are
191 such occurrences across 27 `.tsx` files.

iPad straddles that line:

- **Portrait (820px)** falls below `lg` and gets the phone treatment on a
  ten-inch screen: bottom nav, mobile sheet, no chokepoint strip.
- **Landscape (1180px)** falls above `lg` and gets full desktop density with
  260px missing — the cram visible in the reported screenshots.

Rotating one device therefore swaps the entire information architecture: top nav
⇄ bottom nav, side rail ⇄ bottom sheet, chokepoints present ⇄ absent. That
discontinuity, not the cram, is the primary defect.

### Why 768 / 1280, and why a height guard

Material Design 3 window size classes put 820px in **Medium** and 1180px in
**Expanded**; both prescribe two panes and a nav rail, neither prescribes a
bottom bar. Apple HIG classifies iPad as `regular` horizontal size class in
*both* orientations and names compact-at-regular-width as an anti-pattern.
Tailwind's default `lg = 1024` is the trap precisely because it bisects one
device's two orientations.

Desktop moves from 1024 to 1280 because the pinned rail, the four chokepoint
widgets, and the full header control row were laid out at 1440 and demonstrably
cram at 1180.

The tier is two-dimensional. iPhone 16 Pro Max in landscape is **932 × 430** —
wide enough to pass a width-only tablet test, but with 430px of vertical room it
must stay on the phone stack.

| Width | Now | Proposed | Lands on |
|---|---|---|---|
| < 768 | Phone | Phone | iPhone portrait |
| 768–1023 | **Phone** | **Tablet** | iPad portrait (820) |
| 1024–1279 | **Desktop** | **Tablet** | iPad landscape (1180) |
| ≥ 1280 | Desktop | Desktop | Laptop, monitor |
| ≥ 768 wide, < 600 tall | **Phone** | Phone | iPhone Pro Max landscape (932×430) |

### Mechanism

Three custom variants in `src/app/globals.css` (Tailwind v4 `@custom-variant`):

```css
@custom-variant phone (@media (max-width: 767.98px), (max-height: 599.98px));
@custom-variant roomy (@media (min-width: 768px) and (min-height: 600px));
@custom-variant desk  (@media (min-width: 1280px) and (min-height: 600px));
```

`phone` and `roomy` are De Morgan complements: every viewport matches exactly
one — never both, never neither. `desk` nests strictly inside `roomy`, so
`roomy:` styles also apply at desktop and `desk:` layers on top.

Migration is mechanical per file: `max-lg:` → `phone:`, `lg:` → `roomy:`. At
phone and desktop widths that substitution is a **no-op**; it only lights up the
768–1279 band. A short reviewed exception list is then promoted `roomy:` →
`desk:`.

`max-lg:` and `phone:` can coexist across files during the migration — `lg`
remains defined at 1024. Files not yet migrated simply keep old behaviour in the
tablet band.

### The desktop-only exception list

Four sites cannot be `roomy:` because they need desktop width specifically:

| Site | File | Reason |
|---|---|---|
| 320px pinned rail | `dashboard/page.tsx` (`data-testid="panel-rail"`) | Tablet gets the drawer instead |
| `DataFreshness` | `ui/Header.tsx` | Duplicates `StatusChip`; first thing to cut at 1180 |
| AIS / PRICES / NEWS legend | `ui/Header.tsx` | Decoration in an already-cramped control row |
| `flex-wrap` tab strip | `fleet/FleetTabs.tsx` | Eight tabs orphan 7+1 at 1180 |

The chokepoint strip keeps all four widgets at tablet with reduced padding and
type size, rather than dropping any.

### Dashboard at tablet — Option A, the overlay drawer

Approved from the mockup over a pinned narrow rail (B) and a reused bottom sheet
(C). Rationale: on a tablet the map is the product, and A is the only option that
returns its full width. It is also the only option whose layout is identical in
both orientations, which is the rotation-continuity fix.

C was rejected on a measured ground: landscape iPad has only 820px of height, and
a bottom sheet spends the scarcer axis. C is the strongest option in portrait and
the weakest in landscape; A is stable across both.

Three-state layout:

| Tier | Nav | Chokepoints | Panels |
|---|---|---|---|
| phone | Bottom nav | Hidden | `MobileSheet` |
| roomy (not desk) | Top nav | Visible, compact | `IntelDrawer` overlaying a full-bleed map |
| desk | Top nav | Visible | Pinned 320px rail |

New components:

- **`RailPanels.tsx`** — the panel stack (`ClusterPanel`, `VesselPanel` when a
  vessel is selected, `WatchlistPanel`, `OilPricePanel`, `NewsPanel`), extracted
  once and consumed by both the pinned rail and the drawer. Holds no state of its
  own; renders what the vessel store already provides.
- **`IntelDrawer.tsx`** — a 340px overlay pinned to the map's right edge,
  toggled by a vertical edge tab, closable by its own header button. Owns only
  open/closed state and the slide transition. Holds no domain data; receives its
  contents as children.

Drawer closed is the default on load, so the map is unobstructed on arrival.

### Fleet at tablet

`FleetTabs` currently renders `grid-cols-2 lg:flex lg:flex-wrap`. At 1180px the
eight tabs wrap 7+1, orphaning `SPOOFED POSITION` onto its own row — visible in
the reported screenshot. Tablet gets `grid-cols-4`, which divides eight tabs into
two clean rows. Desktop keeps `flex-wrap` unchanged.

`AnomalyTable`'s IMO and flag columns are currently `max-lg:hidden`; under the
rename they become `phone:hidden` and therefore return at tablet, which is
correct — tablet has the width for them. No extra work.

### Other routes

`/analytics` and `/about` need the same `max-lg:` → `phone:`, `lg:` → `roomy:`
substitution so their nav and spacing match. No layout redesign.

`MobileBottomNav` becomes `roomy:hidden` — tablet uses the top nav in both
orientations.

---

## Delivery

Sequencing is **one commit per concern**, as chosen. The rename is therefore
distributed across the behaviour commits rather than landing as one verified
no-op first.

Tradeoff, recorded deliberately: a regression in the tablet band will need
bisecting through diffs that mix mechanical renames with behavioural changes.
The alternative — rename-first as a single proven no-op — was offered and not
taken. Mitigation is the verification gate below, which runs on every commit and
holds the phone and desktop viewports green throughout.

| # | Concern | Files |
|---|---|---|
| 1 | Define the three variants | `globals.css` — no usages yet, zero behaviour change |
| 2 | Header & nav at tablet | `Header.tsx`, `MobileBottomNav.tsx`, `ChokepointWidget.tsx`, `StatusChip.tsx`, `NotificationBell.tsx`, `TankerFilter.tsx`, `AnomalyFilter.tsx`, `TimeRangeSelector.tsx`, `ChokepointSelector.tsx` |
| 3 | Dashboard drawer | new `RailPanels.tsx`, new `IntelDrawer.tsx`, `dashboard/page.tsx`, `MobileSheet.tsx`, `MapFilterChips.tsx`, `NewsPanel.tsx` |
| 4 | Fleet at tablet | `FleetTabs.tsx`, `AnomalyTable.tsx`, `SanctionedVessels.tsx`, `SortControls.tsx`, `TablePager.tsx`, `fleet/page.tsx` |
| 5 | Analytics & About | `analytics/page.tsx`, `about/page.tsx` |
| 6 | Search affordances | `SearchInput.tsx`, `dashboard/page.tsx` |

Concern 1 must land first — the variants must exist before anything references
them. Concern 6 is independent of 1–5 and may land at any point.

---

## Verification

Measured, not eyeballed, per the existing house rule. Extend
`scripts/verify-dashboard-layout.mjs` and `scripts/verify-fleet-layout.mjs`.

**Regression gate — must stay green on every commit.** The existing 390×844,
360×800, and 1440×900 passes are the proof that each rename was a no-op at phone
and desktop widths.

**New viewports:**

| Viewport | Asserts |
|---|---|
| 820 × 1180 | Top nav present; bottom nav absent; chokepoint strip present; drawer closed by default; map width == viewport width |
| 1180 × 820 | Same four assertions — byte-identical structure to 820×1180, which is the rotation-continuity proof |
| 932 × 430 | Phone stack retained: bottom nav present, `MobileSheet` present, top nav absent. Guards the height clause |

**Drawer behaviour, both tablet viewports:** opening the drawer does not change
the map's width (it overlays, never reflows); the drawer's left edge sits inside
the map's box; closing restores the edge tab.

**Fleet, both tablet viewports:** the tab strip occupies exactly two rows, and no
row contains fewer than four tabs.

**Search, unit-level in a new `src/components/ui/SearchInput.test.tsx`:** each of
the six states renders its expected node; a result whose `flag` is `null` renders
no trailing separator; selecting a vessel with `latitude === null` calls
`setSelectedVessel` with `position: null` and does **not** call `setMapCenter`.

Every failure message carries the measured number, matching the convention
established in `verify-dashboard-layout.mjs`.
