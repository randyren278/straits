# Phase 5: UI Redesign - Research

**Researched:** 2026-03-12
**Domain:** Tailwind CSS v4 theming, Next.js font optimization, React layout restructuring
**Confidence:** HIGH

---

## Summary

The dashboard currently uses a navy/purple color scheme (`#1a1a2e`, `#16162a`, `#1e1e3f`) with floating absolute-positioned panels overlaid on the map. The Inter font is loaded globally; data values use ad-hoc `font-mono` classes rather than a consistent JetBrains Mono typeface. Navigation active states use `bg-blue-600`. The goal is to strip all of this out and replace it with true black (`#000000`), amber (`#f59e0b`) as the sole accent, JetBrains Mono for all data values, and a fixed CSS Grid layout where panels sit beside the map rather than overlapping it.

This project runs Tailwind CSS **v4.2.1**, which uses a CSS-first configuration model — there is no `tailwind.config.ts` (none exists on disk). All theme customization happens inside `globals.css` using `@theme {}` blocks. This is a critical difference from v3: custom colors, fonts, and border-radius overrides are all CSS variables in `@theme`, not JavaScript objects.

The scope is a visual-only refactor. No API routes, database schemas, or data-fetching logic changes. Every file that renders JSX is a candidate for touch, but the Zustand stores, API routes, and service layer are untouched.

**Primary recommendation:** Define the terminal design system in `globals.css` `@theme`, replace `layout.tsx` font with JetBrains Mono, restructure `dashboard/page.tsx` from `relative` container with absolute children to a CSS Grid, then sweep each component to remove `rounded-*`, blue accents, and purple backgrounds.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Dashboard background is true black (#000000) with amber (#f59e0b) as the primary accent color — no navy or purple | `@theme` color overrides in globals.css + sweep of `bg-[#1a1a2e]` / `bg-[#16162a]` / `bg-[#1e1e3f]` hardcoded colors across all components |
| UI-02 | All data values (prices, coordinates, IMO numbers, speed, headings) render in JetBrains Mono or similar monospace font | `JetBrains_Mono` from `next/font/google` in `layout.tsx`; CSS variable passed to `@theme --font-mono`; apply `font-mono` class consistently to data spans |
| UI-03 | Dashboard uses a grid layout with fixed panel regions and hard 1px borders — no floating overlays on top of map | Replace `<main className="flex-1 relative">` + absolute-positioned panels with CSS Grid (`grid-cols-[1fr_320px]`); panels become grid children alongside map |
| UI-04 | Data panels use no rounded corners and tight information density matching terminal aesthetics | Remove `rounded-*` everywhere; reduce padding from `p-4` to `p-2` / `p-3`; reduce `space-y-3` to `space-y-2`; use `leading-tight` |
| UI-05 | Header uses amber accent for active navigation state, not blue | Replace `bg-blue-600` with `bg-amber-500` in Header.tsx nav links; same for TimeRangeSelector and ChokepointSelector active states |
</phase_requirements>

---

## Current UI Audit

### Color Inventory (what must be eliminated)

| Location | Current Value | Must Become |
|----------|--------------|-------------|
| `layout.tsx` body | `bg-[#1a1a2e]` | `bg-black` |
| `dashboard/page.tsx` | `bg-[#1a1a2e]` | `bg-black` |
| `analytics/page.tsx` | `bg-[#1a1a2e]` | `bg-black` |
| `Header.tsx` | `bg-[#16162a]` | `bg-black` |
| `OilPricePanel.tsx` | `bg-[#16162a]` floating absolute | `bg-black` grid panel |
| `NewsPanel.tsx` | `bg-[#16162a]` floating absolute | `bg-black` grid panel |
| `VesselPanel.tsx` | `bg-[#16162a]` absolute right-0 | `bg-black` grid panel |
| `WatchlistPanel.tsx` | `bg-[#1e1e3f]/95` absolute | `bg-black` grid panel |
| `NotificationBell.tsx` dropdown | `bg-[#1e1e3f]` | `bg-black` |
| `SearchInput.tsx` dropdown | `bg-[#16162a]` | `bg-black` |
| `TrafficChart.tsx` | `bg-[#16162a]` | `bg-black` |
| `TimeRangeSelector.tsx` | `bg-[#1a1a2e]`, active `bg-blue-600` | `bg-black`, active `bg-amber-500` |
| `ChokepointSelector.tsx` | `bg-[#1a1a2e]`, active `bg-amber-600` | `bg-black`, active `bg-amber-500` |
| `Header.tsx` nav | active `bg-blue-600` | active `bg-amber-500` |
| `AnomalyBadge.tsx` speed variant | `bg-blue-500` / `bg-blue-400` | `bg-amber-600` / `bg-amber-500` |

### Layout Inventory (what must be restructured)

| Component | Current Structure | Must Become |
|-----------|-----------------|-------------|
| `dashboard/page.tsx` | `h-screen flex flex-col` → `<main className="flex-1 relative">` → absolute-positioned panels | `h-screen flex flex-col` → `<main className="flex-1 grid grid-cols-[1fr_320px]">` → map + right-column panels |
| `VesselPanel.tsx` | `absolute right-0 top-0 bottom-0 w-80` | normal flow child in right column |
| `OilPricePanel.tsx` | `absolute top-16 right-4` floating | stacked section in right column |
| `NewsPanel.tsx` | `absolute top-32 right-4 w-80` floating | stacked section in right column |
| `WatchlistPanel.tsx` | `absolute left-4 top-20` floating | stacked section in right column or integrated into VesselPanel area |
| `analytics/page.tsx` | `p-6 max-w-7xl mx-auto` centered | Same pattern, but colors updated; layout is already non-overlapping |

### Rounded Corner Inventory (what must be removed)

Files with `rounded` classes that need stripping:
- `Header.tsx`: `rounded` on nav links, `rounded-lg` on ChokepointWidget buttons
- `VesselPanel.tsx`: `rounded-t-2xl` on mobile bottom sheet, `rounded-lg` on sanctions/anomaly alerts, `rounded` on buttons
- `OilPricePanel.tsx`: `rounded-lg`
- `NewsPanel.tsx`: `rounded-lg`
- `WatchlistPanel.tsx`: `rounded-lg`, `rounded-t-lg`
- `NotificationBell.tsx`: `rounded-lg`, `rounded-full` (badge count — keep as-is, it's circular)
- `SearchInput.tsx`: `rounded-lg`
- `TankerFilter.tsx`: `rounded`
- `AnomalyFilter.tsx`: `rounded`
- `ChokepointWidget.tsx`: `rounded-lg`
- `TimeRangeSelector.tsx`: `rounded-lg`, `rounded`
- `ChokepointSelector.tsx`: `rounded`
- `TrafficChart.tsx`: `rounded-lg`, tooltip `borderRadius: '8px'`
- `AnomalyBadge.tsx`: `rounded` — remove
- `analytics/page.tsx`: `rounded-lg` on controls bar and error/empty states

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Tailwind CSS | 4.2.1 | Utility classes | CSS-first config via `@theme` in globals.css |
| Next.js | 16.1.6 | Framework + font optimization | `next/font/google` for JetBrains Mono |
| React | 19.2.4 | Component layer | No changes needed |

### No New Dependencies Required
This phase is purely a visual refactor. No new npm packages are needed. JetBrains Mono is available via `next/font/google` (same mechanism as the current Inter font).

---

## Architecture Patterns

### Pattern 1: Tailwind v4 CSS-First Theme Configuration
**What:** All design tokens defined in `globals.css` using `@theme {}` — no JS config file
**When to use:** Any new color, font, or spacing token

```css
/* src/app/globals.css — SOURCE: https://tailwindcss.com/docs/theme */
@import "tailwindcss";
/* mapbox import stays */
@import 'mapbox-gl/dist/mapbox-gl.css';

@theme {
  /* Override amber to exactly the required value */
  --color-amber-500: #f59e0b;

  /* Eliminate all border-radius defaults to enforce terminal aesthetic */
  --radius-*: initial;

  /* Terminal font stack — registered as CSS variable for use in components */
  --font-mono: var(--font-jetbrains), ui-monospace, monospace;
}
```

**Critical:** In Tailwind v4, `--radius-*: initial` wipes ALL radius utilities. After this, `rounded-*` classes produce no output. This is the single most efficient way to enforce zero border-radius globally.

### Pattern 2: JetBrains Mono via next/font/google
**What:** Load JetBrains Mono as a CSS variable, attach to `<html>`, register in Tailwind `@theme`

```tsx
// src/app/layout.tsx — SOURCE: https://nextjs.org/docs/app/getting-started/fonts
import { JetBrains_Mono } from 'next/font/google';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`dark ${jetbrainsMono.variable}`}>
      <body className="bg-black text-white">
        {children}
      </body>
    </html>
  );
}
```

After this, `font-mono` in Tailwind resolves to JetBrains Mono because `@theme` maps `--font-mono` to `var(--font-jetbrains)`. All existing `font-mono` class usages automatically upgrade. No component-level changes needed for the font.

**Note:** Inter can be removed from `layout.tsx` entirely. The body font becomes the browser default sans-serif (or add a separate Inter registration if needed for labels). The terminal aesthetic uses monospace for data and no particular font requirement for UI labels.

### Pattern 3: CSS Grid Dashboard Layout (Overlay → Grid)
**What:** Replace the absolute-positioned floating panels with a two-column CSS Grid
**When to use:** The dashboard `page.tsx` main area

```tsx
// dashboard/page.tsx — before: <main className="flex-1 relative">
// dashboard/page.tsx — after:
<main className="flex-1 grid grid-cols-[1fr_320px] overflow-hidden">
  {/* Left column: full-height map */}
  <div className="relative border-r border-amber-500/20">
    <VesselMap />
  </div>
  {/* Right column: stacked panels */}
  <div className="flex flex-col overflow-y-auto bg-black border-l border-amber-500/20 divide-y divide-amber-500/20">
    <VesselPanel />
    <OilPricePanel />
    <NewsPanel />
    <WatchlistPanel />
  </div>
</main>
```

This eliminates all `absolute`, `z-10`, `z-20`, `z-40` positioning from panel components. The map (`VesselMap`) stays `relative` within its grid cell only — it no longer needs to be a full-screen canvas with panels floating over it.

### Pattern 4: Terminal Panel Structure
**What:** Each panel becomes a flex column with a 1px bordered header row and tight content

```tsx
// Structural pattern for all redesigned panels
<section className="flex flex-col">
  {/* Panel header */}
  <div className="px-3 py-1.5 border-b border-amber-500/20 flex items-center justify-between">
    <span className="text-xs text-amber-500 font-mono uppercase tracking-widest">
      VESSEL DETAIL
    </span>
  </div>
  {/* Panel content — tight spacing */}
  <div className="px-3 py-2 space-y-1.5 text-xs">
    <div className="flex justify-between">
      <span className="text-gray-500">IMO</span>
      <span className="font-mono text-white">9876543</span>
    </div>
  </div>
</section>
```

Key terminal density conventions:
- Headers: `text-xs uppercase tracking-widest text-amber-500`
- Labels: `text-xs text-gray-500`
- Data values: `font-mono text-white text-xs`
- Dividers: `border-b border-amber-500/20` (not `border-gray-700`)
- No padding above `p-3`; prefer `px-3 py-2` or `px-3 py-1.5`

### Pattern 5: Header Terminal Styling
**What:** Hard-bordered header with amber active state

```tsx
// Header.tsx nav link active state
className={`px-3 py-1 text-xs font-mono uppercase tracking-wider transition-colors border ${
  isActive
    ? 'border-amber-500 text-amber-500 bg-amber-500/10'
    : 'border-transparent text-gray-500 hover:text-white hover:border-gray-600'
}`}
```

Header background: `bg-black border-b border-amber-500/20`
Sub-row for chokepoints: `border-b border-amber-500/10`

### Anti-Patterns to Avoid
- **Keeping absolute positioning on panels:** The whole point of this phase is to move panels out of the map z-stack. Don't compromise by keeping any panel `absolute`.
- **Using `rounded-*` with explicit values:** After `--radius-*: initial` in globals.css, don't add back rounded corners on individual components. The notification bell count badge uses `rounded-full` for the circle shape — this is one intentional exception.
- **Mixing blue anywhere:** `bg-blue-*`, `text-blue-*`, `border-blue-*` must all be removed. The AnomalyBadge `speed` type currently uses blue; change to amber.
- **Purple/navy hardcoded hex values:** All `#1a1a2e`, `#16162a`, `#1e1e3f`, `#1a1a40`, `#252550` values must be replaced with `#000000` (`bg-black`) or `bg-gray-900` (`#111827`) for slight visual separation where needed.
- **Tooltip borderRadius in Recharts:** Recharts Tooltip `contentStyle` has `borderRadius: '8px'` as an inline style — must be explicitly set to `borderRadius: '0'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font loading | Manual `<link>` tag in `<head>` | `next/font/google` JetBrains_Mono | next/font inlines critical CSS, no FOUT, no external request at runtime |
| Global border-radius reset | Inline style on every element | `--radius-*: initial` in `@theme` | One line eliminates ALL rounded utilities globally |
| Custom color tokens | Hardcoded hex in every className | `@theme { --color-amber-500: #f59e0b }` | Single source of truth; generates all Tailwind utilities automatically |
| Terminal grid layout | CSS position tricks, JS measurement | CSS Grid `grid-cols-[1fr_320px]` | Native browser layout, zero JS, reliable overflow handling |

---

## Common Pitfalls

### Pitfall 1: VesselMap Height Breaks After Grid Restructure
**What goes wrong:** `VesselMap` currently fills its container because the container is full-screen (`h-screen`). After moving to a grid cell, the map div may collapse to zero height.
**Why it happens:** MapLibre GL JS needs an explicit pixel height on the container at mount time. Flexbox/grid cells with `overflow-hidden` on the parent and `h-full` on the child should work, but the parent must have a defined height.
**How to avoid:** Keep `h-screen flex flex-col` on the outer div; `flex-1` on `<main>`; within the grid cell, use `h-full` on the map wrapper. Verify `VesselMap` mounts after the grid cell has non-zero dimensions.
**Warning signs:** Map renders as 0px tall or MapLibre logs "Map container is empty."

### Pitfall 2: WatchlistPanel Conditional Render in Grid
**What goes wrong:** `WatchlistPanel` currently returns `null` when the watchlist is empty. In a grid layout, this creates an empty grid area that still takes no space — but other panels that depend on stacking order may shift unexpectedly.
**Why it happens:** The right column uses `flex flex-col divide-y`. When WatchlistPanel renders null, the divider disappears correctly. No actual issue, but test the collapsed state.
**How to avoid:** Leave the null-return logic intact. The `divide-y` dividers only appear between non-null children.

### Pitfall 3: Mobile Layout Regression
**What goes wrong:** `VesselPanel` has `max-md:w-full max-md:h-1/2 max-md:top-auto max-md:border-l-0 max-md:border-t max-md:rounded-t-2xl` — a mobile bottom sheet. In the grid layout, these absolute positioning classes no longer apply (the panel is in grid flow), so the mobile layout breaks entirely.
**Why it happens:** The mobile bottom sheet relied on absolute positioning. Grid flow breaks that pattern.
**How to avoid:** On mobile (`max-md`), switch from grid to flex-col: `grid-cols-[1fr_320px] max-md:flex max-md:flex-col`. The right column panels stack below the map on mobile. Accept that the bottom-sheet aesthetic is replaced by a scrollable column below the map. Remove all `max-md:*` absolute-positioning overrides from VesselPanel.
**Warning signs:** MAP-08 (mobile usability) — verify map is still visible and panels scroll beneath it on narrow viewports.

### Pitfall 4: Recharts Chart Colors Not Following Theme
**What goes wrong:** `TrafficChart.tsx` has hardcoded color constants (`COLORS.vesselCount: '#3b82f6'` — blue). These are passed as SVG `stroke` and `fill` props — Tailwind utilities have no effect on them.
**Why it happens:** Recharts renders SVG directly; CSS classes don't control SVG stroke/fill unless you use CSS custom properties.
**How to avoid:** Update the `COLORS` constant in `TrafficChart.tsx`. `vesselCount` should change from `#3b82f6` (blue) to `#6b7280` (gray-500). `tankerCount` amber `#f59e0b` is already correct. The `oilPrice` green `#22c55e` is acceptable (not blue/purple, not the amber accent — keep green for price as visual distinction).

### Pitfall 5: Tailwind v4 @theme Does Not Accept oklch for #000000
**What goes wrong:** Tailwind v4's default color palette uses oklch. If you try to override `--color-black` using a hex value and it conflicts with generated utilities, some utility names may not work.
**Why it happens:** Tailwind v4 generates colors in oklch; mixing hex into `@theme` is supported but requires care.
**How to avoid:** Use `bg-black` (Tailwind's default black utility, which is `#000000`) directly — do not override `--color-black` in `@theme`. Only override `--color-amber-500` if the default amber-500 (#f59e0b) differs from the target — it doesn't, so no override is needed. Just use `text-amber-500`, `bg-amber-500`, `border-amber-500` directly.

### Pitfall 6: NotificationBell Dropdown Still Uses Purple
**What goes wrong:** The notification bell dropdown uses `bg-[#1e1e3f]` and hover `bg-[#252550]`. These are hardcoded hex and not caught by `bg-gray-*` sweeps.
**Why it happens:** Developer used hardcoded hex rather than Tailwind palette utilities throughout.
**How to avoid:** The sweep must include a grep for all `#1a1a2e`, `#16162a`, `#1e1e3f`, `#1a1a40`, `#252550` in `.tsx` files and replace all with `bg-black` or `bg-gray-900`.

---

## Code Examples

### globals.css Final Form
```css
/* Source: https://tailwindcss.com/docs/theme */
@import 'mapbox-gl/dist/mapbox-gl.css';
@import "tailwindcss";

@theme {
  /* Zero out all border-radius utilities to enforce terminal aesthetic */
  --radius-*: initial;

  /* Register JetBrains Mono as the mono font stack */
  --font-mono: var(--font-jetbrains), ui-monospace, SFMono-Regular, monospace;
}
```

### layout.tsx — Font Registration
```tsx
/* Source: https://nextjs.org/docs/app/getting-started/fonts */
import { JetBrains_Mono } from 'next/font/google';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`dark ${jetbrainsMono.variable}`}>
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
```

### dashboard/page.tsx — Grid Layout
```tsx
return (
  <div className="h-screen flex flex-col bg-black">
    <Header onSearchSelect={handleSearchSelect} onChokepointSelect={handleChokepointSelect} />
    <main className="flex-1 grid grid-cols-[1fr_320px] overflow-hidden max-md:flex max-md:flex-col">
      {/* Map region */}
      <div className="relative overflow-hidden">
        <VesselMap />
      </div>
      {/* Right panel column */}
      <div className="flex flex-col overflow-y-auto bg-black border-l border-amber-500/20 divide-y divide-amber-500/10">
        <VesselPanel />
        <WatchlistPanel />
        <OilPricePanel />
        <NewsPanel />
      </div>
    </main>
  </div>
);
```

### Header.tsx — Terminal Nav Active State
```tsx
<Link
  href="/dashboard"
  className={`px-3 py-1 text-xs font-mono uppercase tracking-wider border transition-colors ${
    !isAnalytics
      ? 'border-amber-500 text-amber-500 bg-amber-500/10'
      : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
  }`}
>
  Live Map
</Link>
```

Header container: `bg-black border-b border-amber-500/20`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` for theme | `@theme {}` in CSS file | Tailwind v4.0 (2025) | No JS config file; CSS-only customization |
| `theme.extend.colors` in JS | `--color-*` CSS variables in `@theme` | Tailwind v4.0 | More portable, works with CSS cascade |
| `theme.extend.fontFamily` in JS | `--font-*` CSS variables in `@theme` | Tailwind v4.0 | Same mechanism, CSS-first |
| `tailwind.config.js borderRadius: {}` | `--radius-*: initial` | Tailwind v4.0 | One line resets all radius utilities |

---

## Open Questions

1. **VesselMap render at grid cell size**
   - What we know: MapLibre GL JS needs the container to have non-zero dimensions at mount
   - What's unclear: Whether `h-full` in a flex-1 grid cell reliably gives MapLibre the height it needs at mount time in Turbopack's dev mode
   - Recommendation: Test immediately after grid restructure. If map collapses, add explicit `style={{ height: '100%' }}` to the map wrapper div.

2. **Right column panel priority when no vessel is selected**
   - What we know: `VesselPanel` returns `null` when no vessel is selected; `WatchlistPanel` returns `null` when watchlist is empty
   - What's unclear: When both are null, OilPricePanel and NewsPanel should fill the column gracefully. No design spec on this empty state.
   - Recommendation: OilPricePanel renders unconditionally (only skips while loading). Treat "no vessel selected" as a valid state where the right column shows prices + news only.

3. **Analytics page layout**
   - What we know: The analytics page already uses a centered `max-w-7xl` layout (not a split map/panel layout)
   - What's unclear: Should analytics get the same `bg-black` + border treatment with any layout changes?
   - Recommendation: Yes — color sweep applies to analytics too. Layout (centered columns) can remain unchanged; only the color palette and rounded corners need updating.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Background is black, accent is amber, no blue/navy | visual / manual | Manual browser inspection | N/A |
| UI-02 | Data values render in JetBrains Mono | visual / manual | Manual browser inspection | N/A |
| UI-03 | Grid layout — panels beside map, no overlays | visual / manual | Manual browser inspection | N/A |
| UI-04 | No rounded corners, tight line spacing | visual / manual | Manual browser inspection | N/A |
| UI-05 | Header amber active state, no blue | visual / manual | Manual browser inspection | N/A |

**Note:** All UI-01 through UI-05 requirements are visual correctness assertions. They cannot be meaningfully tested with Vitest unit tests (which run in happy-dom without CSS rendering). The validation gate for this phase is a browser smoke test: open the dashboard, confirm the palette, open DevTools and verify `font-family` on a data span, and inspect that no panel uses `position: absolute` over the map.

The existing unit test suite (lib/ais, lib/db, lib/detection, etc.) is unaffected by this phase — run it to confirm no regressions.

### Sampling Rate
- **Per task commit:** `npx vitest run` (existing tests, confirm no regressions from component edits)
- **Per wave merge:** `npx vitest run` full suite
- **Phase gate:** All existing tests green + manual browser review of each page against success criteria before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all non-visual requirements. No new test files needed for this phase. Visual correctness validated manually in browser.

---

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS v4 — Theme variables docs](https://tailwindcss.com/docs/theme) — `@theme` syntax, `--radius-*: initial`, `--font-*`, `--color-*`
- [Next.js — Font optimization docs](https://nextjs.org/docs/app/getting-started/fonts) — `JetBrains_Mono` from `next/font/google`, CSS variable pattern

### Secondary (MEDIUM confidence)
- [JetBrains Mono on Google Fonts](https://fonts.google.com/specimen/JetBrains+Mono) — confirmed available via Google Fonts (and therefore `next/font/google`)
- Direct codebase audit — every component file read and catalogued for current colors, layout patterns, and rounded-corner usage

### Tertiary (LOW confidence)
- None — all findings verified via official docs or direct source reading

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Tailwind v4, Next.js docs are authoritative; no new packages needed
- Architecture: HIGH — Grid layout pattern well-understood; confirmed via direct codebase audit of all component files
- Pitfalls: HIGH — Identified by direct code reading (hardcoded hex, Recharts inline styles, mobile bottom sheet, MapLibre height)

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (Tailwind v4 is stable; Next.js font API is stable)
