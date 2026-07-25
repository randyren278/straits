# Straits — Mobile-First UI Rework · Design Spec

**Date:** 2026-07-24
**Status:** Approved for planning
**Author:** Audit-driven (273-agent mobile UI audit + user approval)

## 1. Problem

The Straits dashboard was built desktop-first. Responsiveness was added reactively (~32 responsive utilities total, zero media queries in `globals.css`), so on phones and tablets the UI renders poorly: header chrome eats the fold, controls that do nothing on a given route still render, touch targets are far below the 44px minimum, decision-critical data scrolls off-screen, and charts are illegible. A 273-agent audit rendered the real app at 5 viewports (iPhone SE 375, iPhone 14 390, iPhone Pro Max 430, iPad portrait 834, iPad landscape 1194) and produced **105 adversarially-verified findings** (9 critical, 30 high, 48 medium, 18 low).

## 2. Goal & Non-Goals

**Goal:** A genuine mobile-first rework across all 5 surfaces so the app is usable and legible on phone and tablet, while the desktop experience remains **byte-for-byte unchanged**.

**Non-Goals:**
- No change to desktop layout/behavior. Every change is `max-md:` / `max-lg:` / `pointer:coarse` / breakpoint-gated.
- No new features, data, routes, or dependencies.
- No auth changes (the `(protected)` group stays open per project posture).
- No redesign of the aesthetic.

## 3. Hard Constraint — Terminal Aesthetic (never violate)

- True black (`#000`) background + **amber-500** accents; red/green only for risk/price deltas. No new hues, no light mode.
- **JetBrains Mono** everywhere (`font-mono`), including Recharts SVG text.
- **Zero border-radius** — `--radius-*: initial` in `globals.css` makes all `rounded-*` inert. Never introduce rounded corners. (Also remove latent `rounded` classes in source as dead-class hygiene.)
- Data-dense, information-first "intelligence terminal" feel. Fixes **reflow and resize only** — they never restyle.

## 4. Cross-Cutting Design Decisions

These three decisions resolve the bulk of the findings and must be applied consistently:

**D1 — Breakpoint shift `md`→`lg` for the mobile treatment.** Tailwind `md` = 768px, but iPad portrait is 834px, so it currently falls into a dead zone and renders the crushed desktop layout. The mobile/stacked treatment must extend through **1024px** (`max-lg`). Applies to Header rows, the dashboard grid, and fleet gutters. The desktop single-row / two-column layouts return at `lg` (1024px+).

**D2 — Route-gated controls.** The Header currently renders SearchInput + DataFreshness + TankerFilter + AnomalyFilter unconditionally on every route. These are map/dashboard tooling. Render them **only when `activeTab === 'dashboard'`**. NotificationBell + StatusBar are global telemetry and render on all routes.

**D3 — 44px touch targets on touch/mobile only.** All interactive controls (nav tabs, filter pills, table rows, chart toggles, export buttons, chevrons) must reach a 44px minimum height on mobile via `max-md:min-h-[44px]` / `max-md:py-*` (or `pointer:coarse` where a media query fits better). Desktop compact density (`py-1`) is preserved.

## 5. Per-Surface Design

The **Header** is a single shared surface consumed by all pages — it is designed once (below) and not re-built per page. The mockup approved by the user shows a **2-row mobile header** (logo+nav row; route-appropriate control strip) with chokepoints collapsed behind a toggle on dashboard.

### 5.1 Header & Nav Shell — `Header.tsx` (+ SearchInput, ChokepointWidget, TankerFilter, AnomalyFilter, StatusBar, DataFreshness)
Mobile job: identify location + get out of the way. Target: 2 tight rows (~90px) instead of 4 (~255px).
- **P0** Shift `max-md`→`max-lg` on the wrapper/top-row/nav/controls/chokepoint lines (leave the orthogonal `max-sm:px-2` alone).
- **P0** Route-gate map-only controls (D2).
- **P1** Deterministic mobile controls: SearchInput on its own full-width line (`max-lg:w-full`); remaining controls in a single **non-wrapping horizontally-scrollable** strip (`flex-nowrap overflow-x-auto`, each child `shrink-0`) — replacing today's ragged `flex-wrap`.
- **P1** Chokepoint strip: remove the redundant **outer** `overflow-x-auto` on `Header.tsx:108` so the inner row (ChokepointWidget) is the sole scroller; add snap + right padding (`pr-6`) peek affordance; reduce card `min-w`; **collapse behind a `CHOKEPOINTS ▸` toggle** (one `useState`, mobile-gated, SSR-safe) defaulting collapsed on mobile. Verify the `absolute top-full` expand popover still positions (bump z-index or reflow if it clips).
- **P1** 44px touch targets (D3) on nav tabs + TankerFilter + AnomalyFilter + bell + chevron; ensure full nav labels (no "Anlytcs"/"Abt" truncation, no "Live Map" wrap).
- **P2** Kill StatusBar's stray `border-l` on mobile (`max-lg:border-l-0`); normalize DataFreshness (add `font-mono`, `whitespace-nowrap`, compact label so "less than a minute ago" never wraps).

### 5.2 Dashboard (Live Map) — `dashboard/page.tsx` (+ globals.css)
Mobile job: the live vessel map owns the fold.
- **P0** `h-screen`→`h-dvh` on the outer div; map wrapper `max-md:min-h-[50vh]`→`max-md:min-h-[70dvh]`; grid stacking `max-md:`→`max-lg:` so iPad portrait joins the stack (no cramped grid, no empty black void). **Do not** use `calc(100dvh - <fixed>)` — the header height is variable.
- **P1** MapLibre attribution: override the vendor CSS in `globals.css` (after `@import`, outside `@theme`, literal values since Tailwind classes don't apply in vendor CSS) — black bg, amber text, mono, no radius. Kills the white rounded pill.
- **P2** The bottom-left round "N" is the Next.js dev indicator, absent in production; optionally silence with `devIndicators: false` in `next.config.ts` for clean captures. Tidy ClusterPanel/VesselPanel mobile spacing.

### 5.3 Analytics — `analytics/page.tsx` (+ TrafficChart, TimeRangeSelector, ChokepointSelector)
Mobile job: a legible correlation chart leads the fold, not the filters.
- **P0** Collapse the `flex flex-wrap` filter panel behind a **mobile-only disclosure** showing an active-filter summary (e.g. `FILTERS · 7D · HORMUZ · WTI`) with a caret; always-visible inline at `md+`.
- **P0** De-cramp `TrafficChart`: on `≤640px` drop the rotated Y-axis captions, set Y-axis width ~32px, ticks ~10px, thin X ticks (`minTickGap`/`preserveStartEnd`); set `fontFamily: JetBrains Mono` on all Recharts SVG text (axis/legend/tooltip).
- **P1** 44px touch targets (D3) on all selectors; chokepoint buttons in a clean 2-col grid on mobile.
- **P1** Chart titles → amber JetBrains Mono uppercase (matching the page heading), not proportional bold white; add `amber-500/20` panel borders to charts + empty states.
- **P2** Shorter plots (260px) + tighter stack (16px) on phone; 350px/24px restored at `md+`.

### 5.4 Fleet Overview — `fleet/page.tsx` (+ SanctionedVessels, AnomalyTable, FleetVesselDetail, AnomalyBadge)
Mobile job: triage — scan hulls, tap to open a dossier.
- **P0 (critical, data loss)** `SanctionedVessels`: keep the desktop table (`hidden md:block` on the `overflow-x-auto` wrapper) and add a **`md:hidden` phone card list** where the **Sanction Category is always visible** (currently clipped off-screen). Both layouts share the one existing `expandedImo` state. Whole card is a ≥44px tap target.
- **P0** `AnomalyTable`: keep the table but `max-md:hidden` the IMO and Confidence columns (both re-surface in the section header badge / expanded dossier — no data loss); enlarge rows to ≥44px on mobile.
- **P1** Dossier grid `grid-cols-1 md:grid-cols-4` → `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` so tablets (768–1279px) get legible 2-up panels instead of a 4-up crush.
- **P1** Export CSV/JSON anchors → `inline-flex items-center max-md:min-h-[44px]`.
- **P2** Mobile-only anomaly-type summary strip at the top (`hidden max-md:flex`); remove latent `rounded` on AnomalyBadge; tablet gutters `max-lg:p-4`.

### 5.5 About — `about/page.tsx` (+ Header via D2)
Mobile job: reference reading — the fold belongs to content.
- **P0** Route-gate map/dashboard controls off the header on `/about` (D2; keep the NotificationBell — personal alerts work anywhere).
- **P1** Dual-render the Dark Fleet Risk Score table: lift rows into a `RISK_ROWS` array; `hidden md:table` for the semantic table; a `md:hidden` stacked factor/points/notes block on phone with full-width notes.
- **P2** Stack pipe-delimited anomaly config strings per-parameter on phone, rejoin with amber pipes at `sm+`; align `main` padding/width with sibling pages (`max-w-7xl mx-auto max-md:p-3`).

## 6. Architecture & Isolation

No new components or state containers beyond: one `controlsOpen`/`chokepointsOpen` `useState` in Header, and one `RISK_ROWS` const in About. Each surface's changes are independently testable. Shared logic (breakpoint shift D1, route-gate D2, 44px D3) is applied per-file but follows the three documented rules so it reads consistently. The Header is modified once and consumed by all pages.

**SSR safety:** any mobile-gated `useState` (toggles) must render a stable default on the server (collapsed) and not read `window` during render — mobile-vs-desktop is expressed through CSS breakpoints, not JS viewport checks, wherever possible.

## 7. Testing & Verification

- **Automated visual verification (per user choice):** after each phase, re-run the Playwright screenshot harness at all 5 viewports × affected views and compare against the `/tmp/straits-audit/shots` "before" baseline. The harness is retained (kept out of the committed tree; screenshots in `/tmp`).
- **Existing unit tests** (`vitest`) for AnomalyTable, SanctionedVessels, ErrorBoundary, NotificationBell, route handlers must still pass — no behavioral/data changes are intended, only layout.
- **Desktop regression check:** screenshot at ≥1280px before/after to confirm the desktop layout is unchanged.
- **Lint** (`eslint src/`) clean.

## 8. Phasing

Single phased plan, verified per phase (re-screenshot):
1. **Phase 0 — Cross-cutting foundation:** D1 (breakpoint shift) + D2 (route-gate) + D3 (44px) applied to the Header and shared controls. This is the highest-leverage change and unblocks every page. Verify: header renders as 2 rows on all mobile viewports; iPad portrait no longer crushed; controls absent on non-dashboard routes.
2. **Phase 1 — Dashboard:** dvh heights, grid stacking through lg, MapLibre attribution restyle. Verify: map owns ~70% of the phone fold; no white pill; no tablet void.
3. **Phase 2 — Analytics:** filter disclosure, chart de-cramp + mono, borders, touch targets. Verify: a legible chart leads the fold.
4. **Phase 3 — Fleet:** sanctioned card list (category visible), anomaly column-hiding, dossier grid, export buttons, summary strip. Verify: sanction category visible on 375px; rows ≥44px.
5. **Phase 4 — About:** stacked risk table, config-string stacking, padding. Verify: title + first definitions above the fold; formula readable.
6. **Phase 5 — Final regression:** full 5-viewport pass + desktop ≥1280px unchanged + vitest + lint.

## 9. Affected Files (by touch count)

`Header.tsx` (28), `analytics/page.tsx` (9), `dashboard/page.tsx` (8), `TrafficChart.tsx` (8), `fleet/page.tsx` (7), `about/page.tsx` (7), `ChokepointWidget.tsx` (5), `DataFreshness.tsx` (5), `SanctionedVessels.tsx` (5), `StatusBar.tsx` (3), `AnomalyTable.tsx` (3), `FleetVesselDetail.tsx` (3), `TankerFilter.tsx` (3), `VesselMap.tsx`/`globals.css` (attribution), `TimeRangeSelector.tsx` (2), `ChokepointSelector.tsx`, `AnomalyFilter.tsx`, `NotificationBell.tsx`, `SearchInput.tsx`, `AnomalyBadge.tsx`, `next.config.ts`.

## 10. References

- Before/after mockup: `/tmp/straits-audit/before-after.html` (rendered sections in `/tmp/straits-audit/ba-*.png`)
- Full audit digest (105 findings + blueprints): `/tmp/straits-audit/digest.json`
- Baseline screenshots: `/tmp/straits-audit/shots/` (40 PNGs)
- Memory: `mobile-ui-audit-2026-07.md`
