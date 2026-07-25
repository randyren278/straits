# Mobile-First UI Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Straits genuinely usable on phone and tablet across all 5 surfaces (header, dashboard, analytics, fleet, about) while leaving the desktop experience byte-for-byte unchanged.

**Architecture:** Pure Tailwind responsive reflow. Three cross-cutting rules — shift the mobile-treatment breakpoint from `md` (768px) to `lg` (1024px) so iPad portrait joins the mobile stack; route-gate map-only header controls; and grow touch targets to 44px on mobile only. Then per-surface reflows (chart de-cramp, fleet card list, about stacked table). No new dependencies, no new state beyond small local `useState` toggles, no behavioral/data changes.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind CSS v4, Recharts 3, MapLibre GL, Vitest + Testing Library + happy-dom, Playwright (screenshot verification).

## Global Constraints

- **Aesthetic is immutable.** True black `#000` bg + `amber-500` accents; red/green only for risk/price deltas. No new hues, no light mode.
- **JetBrains Mono everywhere** (`font-mono`), including Recharts SVG text.
- **Zero border-radius.** `--radius-*: initial` in `globals.css` makes all `rounded-*` inert; never add rounded corners; remove latent `rounded` tokens in touched source.
- **Desktop unchanged.** Every change is gated `max-md:` / `max-lg:` / breakpoint-prefixed. Never alter an unprefixed (desktop) class value except where the task explicitly says so.
- **Mobile treatment breakpoint is `lg` (1024px), not `md`.** When converting `max-md:` reflow rules, use `max-lg:`. (Tailwind: `max-lg` = `@media (max-width:1023.98px)`.)
- **Touch target minimum 44px** on mobile, via `max-md:min-h-[44px]` + centering, applied on the interactive element itself.
- **SSR-safe.** Mobile vs desktop is expressed in CSS breakpoints, not JS `window` checks. Local `useState` toggles must render a deterministic default (collapsed) on the server.
- **Commit after every task.** Branch: `mobile-first-ui` (create at Task 0).
- **Verification tooling** lives in `/tmp/straits-audit/` (harness `shoot.mjs`, baseline `shots/`). It is NOT committed to the repo.

---

## Verification Harness (used by every phase gate)

The screenshot harness from the audit is reused. It is a standalone script that renders the running dev server at all 5 viewports. To re-run it, the script must sit inside the project (so Node resolves `playwright` from `node_modules`), then be deleted after — it is never committed.

**Reusable procedure — "run the screenshot harness":**
1. Ensure dev server is up: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard` → expect `200`. If not, start it: `npm run dev > /tmp/straits-dev.log 2>&1 &` then wait for `Ready` in the log.
2. Copy the harness into the project and run it, writing to a phase-specific output dir:
   ```bash
   cp /tmp/straits-audit/shoot.mjs /Users/randyren/Developer/tanker-tracker/.audit-shoot.mjs
   OUT_DIR=/tmp/straits-audit/shots-PHASE node .audit-shoot.mjs   # edit OUT const or pass env
   rm -f /Users/randyren/Developer/tanker-tracker/.audit-shoot.mjs
   ```
   (The harness `OUT` constant is `/tmp/straits-audit/shots`; for phase gates, duplicate the file with a changed `OUT` or just overwrite `shots/` and eyeball the affected views. Simplicity: overwrite `shots/`, then Read the specific PNGs the phase changed.)
3. Read the relevant PNGs (e.g. `iphone-14__dashboard__fold.png`, `ipad-portrait__dashboard__fold.png`) and confirm the phase's expected outcome visually.
4. Desktop regression: the harness only covers ≤1194px. For desktop, additionally render at 1440px (add a `{id:'desktop',w:1440,h:900,dpr:1,mobile:false}` row temporarily, or trust that unprefixed classes are untouched — the gate is "no unprefixed class changed" which is enforced by the diff review).

**This is a manual visual gate, not an assertion.** The automated safety net is `npm test` (vitest) + `npm run lint`, run at every task.

---

## Phase 0 — Cross-Cutting Foundation (Header & shared controls)

The Header is consumed by every page; fixing it is the highest-leverage work. Phase 0 delivers the approved 2-row mobile header.

### Task 0: Branch + baseline

**Files:** none (git + verification only)

- [ ] **Step 1: Create the working branch**

```bash
cd /Users/randyren/Developer/tanker-tracker
git checkout -b mobile-first-ui
```

- [ ] **Step 2: Confirm clean baseline — tests and lint pass before any change**

Run: `npm test -- --run 2>&1 | tail -20`
Expected: all tests pass (green). Note the count.

Run: `npm run lint 2>&1 | tail -20`
Expected: no errors.

- [ ] **Step 3: Confirm dev server + capture the "before" baseline**

Run the screenshot harness (procedure above) to refresh `/tmp/straits-audit/shots/`. These are the "before" images the phase gates diff against. (They already exist from the audit; re-capturing ensures they match current HEAD.)

- [ ] **Step 4: Commit the branch point (no-op marker)**

```bash
git commit --allow-empty -m "chore: start mobile-first-ui rework"
```

---

### Task 1: Route-gate map-only header controls (D2)

**Files:**
- Modify: `src/components/ui/Header.tsx:97-105`

**Interfaces:**
- Produces: header renders `SearchInput`, `DataFreshness`, `TankerFilter`, `AnomalyFilter` only on `/dashboard`; `NotificationBell` + `StatusBar` always. `activeTab` variable already exists (`Header.tsx:42`).

- [ ] **Step 1: Locate the controls block**

Current `Header.tsx:97-105`:
```tsx
        {/* Controls row: hidden on mobile nav bar, wraps on tablet */}
        <div className="flex items-center gap-4 max-md:gap-2 max-md:flex-wrap max-md:px-0 max-md:py-2 max-md:border-t max-md:border-amber-500/10">
          <SearchInput onSelectVessel={onSearchSelect} />
          <DataFreshness />
          <TankerFilter />
          <AnomalyFilter />
          <NotificationBell />
          <StatusBar />
        </div>
```

- [ ] **Step 2: Replace with route-gated version**

New:
```tsx
        {/* Controls row: map tooling only on dashboard; telemetry (bell + status) everywhere */}
        <div className="flex items-center gap-4 max-md:gap-2 max-md:flex-wrap max-md:px-0 max-md:py-2 max-md:border-t max-md:border-amber-500/10">
          {activeTab === 'dashboard' && (
            <>
              <SearchInput onSelectVessel={onSearchSelect} />
              <DataFreshness />
              <TankerFilter />
              <AnomalyFilter />
            </>
          )}
          <NotificationBell />
          <StatusBar />
        </div>
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint 2>&1 | tail -5`
Expected: no errors.

- [ ] **Step 4: Visual check — controls absent on /analytics, /fleet, /about**

Load `http://localhost:3000/about` and `http://localhost:3000/fleet` in a browser (or harness). Expected: no search box / ALL VESSELS / ANOMALIES on those routes; bell + AIS/PRICES/NEWS still present. `/dashboard` unchanged (all controls present).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Header.tsx
git commit -m "feat(header): route-gate map-only controls off non-dashboard pages"
```

---

### Task 2: Shift Header mobile breakpoint md→lg (D1)

**Files:**
- Modify: `src/components/ui/Header.tsx` (lines 47, 49, 54, 98, 108 — the `max-md:` reflow prefixes)

**Interfaces:**
- Consumes: route-gating from Task 1.
- Produces: at ≤1024px the header renders the stacked 2-row layout; single-row desktop returns at `lg`. iPad portrait (834px) now stacks.

- [ ] **Step 1: Convert the wrapper reflow prefixes**

`Header.tsx:47` — change `max-md:` → `max-lg:`:
```tsx
      <div className="h-14 flex items-center justify-between px-4 max-lg:h-auto max-lg:flex-col max-lg:items-stretch max-lg:gap-0">
```

`Header.tsx:49`:
```tsx
        <div className="flex items-center max-lg:justify-between max-lg:h-12 max-lg:w-full">
```

`Header.tsx:54` (nav container — the `max-md:ml-2` margin):
```tsx
          <nav className="flex gap-1 ml-6 max-lg:ml-2">
```

`Header.tsx:98` (controls row):
```tsx
        <div className="flex items-center gap-4 max-lg:gap-2 max-lg:flex-wrap max-lg:px-0 max-lg:py-2 max-lg:border-t max-lg:border-amber-500/10">
```

`Header.tsx:108` (chokepoint row — currently `max-md:overflow-x-auto`; we handle this in Task 4, but convert the prefix now for consistency): leave as-is for now — Task 4 removes it.

Leave the nav-tab `max-sm:px-2` classes (lines 57/67/77/87) untouched — they are orthogonal.

- [ ] **Step 2: Verify lint**

Run: `npm run lint 2>&1 | tail -5`
Expected: no errors.

- [ ] **Step 3: Visual check — iPad portrait stacks**

Harness or browser at 834px width on `/dashboard`. Expected: header is now the stacked 2-row layout (logo+nav, then controls), NOT the crushed single desktop row. At ≥1024px the desktop single row is unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Header.tsx
git commit -m "feat(header): extend mobile stacked layout through 1024px (fix iPad portrait dead zone)"
```

---

### Task 3: 44px touch targets on header controls (D3)

**Files:**
- Modify: `src/components/ui/Header.tsx` (nav `<Link>` lines 55-94)
- Modify: `src/components/ui/TankerFilter.tsx:17`
- Modify: `src/components/ui/AnomalyFilter.tsx:18`

**Interfaces:**
- Produces: nav tabs, tanker filter, anomaly filter each ≥44px tall on mobile; unchanged on desktop.

- [ ] **Step 1: Nav tabs — add mobile min-height + prevent wrap/truncation**

Each of the 4 nav `<Link>`s (lines 57, 67, 77, 87) has the same className shape. For all four, change the leading `px-3 py-1 ...` to add `inline-flex items-center whitespace-nowrap max-lg:min-h-[44px] max-lg:py-2.5`. Example for the dashboard tab (line 57 region):
```tsx
              className={`inline-flex items-center whitespace-nowrap px-3 py-1 max-lg:min-h-[44px] max-lg:py-2.5 text-xs font-mono uppercase tracking-wider border transition-colors max-sm:px-2 ${
                activeTab === 'dashboard'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
```
Apply the identical `inline-flex items-center whitespace-nowrap ... max-lg:min-h-[44px] max-lg:py-2.5` insertion to the Analytics (67), Fleet (77), and About (87) links. Keep each link's existing active/inactive ternary intact.

- [ ] **Step 2: TankerFilter — add mobile min-height**

`TankerFilter.tsx:17`:
```tsx
      className={`inline-flex items-center px-3 py-1 max-lg:min-h-[44px] text-xs font-mono uppercase tracking-wider border transition-colors ${
```

- [ ] **Step 3: AnomalyFilter — add mobile min-height**

`AnomalyFilter.tsx:18` (keeps its existing `flex items-center gap-2`):
```tsx
      className={`flex items-center gap-2 px-3 py-1.5 max-lg:min-h-[44px] text-xs font-mono uppercase tracking-wider border transition-colors ${
```

- [ ] **Step 4: Verify lint + existing NotificationBell test still passes**

Run: `npm test -- --run NotificationBell 2>&1 | tail -10`
Expected: PASS (we didn't touch the bell).

Run: `npm run lint 2>&1 | tail -5`
Expected: no errors.

- [ ] **Step 5: Visual check — tap heights on iPhone 14**

Harness at 390px. Expected: nav tabs and filter buttons visibly taller (44px), full labels ("Live Map", "Analytics" — no "Anlytcs"/"Abt" truncation, no 2-line wrap). Desktop (≥1024px) tab height unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Header.tsx src/components/ui/TankerFilter.tsx src/components/ui/AnomalyFilter.tsx
git commit -m "feat(header): 44px touch targets on nav tabs and filters (mobile only)"
```

---

### Task 4: Deterministic mobile controls + collapsible chokepoint strip

**Files:**
- Modify: `src/components/ui/SearchInput.tsx:115` (full-width on mobile)
- Modify: `src/components/ui/Header.tsx:98-111` (single scroll strip + chokepoint toggle)
- Modify: `src/components/ui/ChokepointWidget.tsx:125,129` (single scroller + peek affordance)

**Interfaces:**
- Consumes: route-gating (Task 1), lg breakpoint (Task 2).
- Produces: on mobile, SearchInput is a full-width line; other controls a single non-wrapping scroll strip; chokepoints collapsed behind a `CHOKEPOINTS ▸` toggle (new local `useState chokepointsOpen`, default `false`).

- [ ] **Step 1: SearchInput full-width on mobile**

`SearchInput.tsx:103` outer wrapper — add mobile full-width:
```tsx
    <div className="relative max-lg:w-full">
```
`SearchInput.tsx:115` input — make width responsive (keep `w-48` at desktop):
```tsx
          className="w-48 max-lg:w-full pl-9 pr-8 py-1.5 bg-black border border-gray-700 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
```

- [ ] **Step 2: Header — make the mobile controls a single non-wrapping scroll strip**

Currently (post-Task-2) the controls div at `Header.tsx:98` uses `max-lg:flex-wrap`. Change the reflow so the search sits on its own line and the rest scroll horizontally without wrapping. Replace the block from Task 1 with a two-child mobile structure:
```tsx
        {/* Controls: search on its own line (mobile); rest in a single non-wrapping scroll strip */}
        <div className="flex items-center gap-4 max-lg:flex-col max-lg:items-stretch max-lg:gap-2 max-lg:px-0 max-lg:py-2 max-lg:border-t max-lg:border-amber-500/10">
          {activeTab === 'dashboard' && (
            <SearchInput onSelectVessel={onSearchSelect} />
          )}
          <div className="flex items-center gap-4 max-lg:gap-3 max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:w-full [&>*]:shrink-0">
            {activeTab === 'dashboard' && (
              <>
                <DataFreshness />
                <TankerFilter />
                <AnomalyFilter />
              </>
            )}
            <NotificationBell />
            <StatusBar />
          </div>
        </div>
```

- [ ] **Step 3: Header — collapsible chokepoint strip with a mobile toggle**

Add a `useState` at the top of the `Header` component (after `const activeTab = ...` on line 42):
```tsx
  const [chokepointsOpen, setChokepointsOpen] = useState(false);
```
Add the import at the top of the file (line 8 region, with the other imports):
```tsx
import { useState } from 'react';
```
Replace the chokepoint block (`Header.tsx:107-111`):
```tsx
      {activeTab === 'dashboard' && (
        <div className="flex items-start px-4 py-2 border-t border-amber-500/10">
          {/* Mobile: collapsed behind a toggle to reclaim the fold. Desktop: always shown. */}
          <button
            onClick={() => setChokepointsOpen((v) => !v)}
            aria-expanded={chokepointsOpen}
            className="hidden max-lg:inline-flex items-center gap-1 min-h-[44px] text-xs font-mono uppercase tracking-widest text-amber-500"
          >
            Chokepoints {chokepointsOpen ? '▾' : '▸'}
          </button>
          <div className={`${chokepointsOpen ? 'max-lg:block' : 'max-lg:hidden'} lg:block w-full`}>
            <ChokepointWidgets onSelect={onChokepointSelect} />
          </div>
        </div>
      )}
```
Note: the outer `max-md:overflow-x-auto` on the old line 108 is intentionally dropped (ChokepointWidget owns the scroll — Step 4).

- [ ] **Step 4: ChokepointWidget — single scroller + peek affordance + smaller cards**

`ChokepointWidget.tsx:125`:
```tsx
    <div className="flex gap-2 max-lg:overflow-x-auto max-lg:pb-1 max-lg:pr-6 max-lg:snap-x">
```
`ChokepointWidget.tsx:129`:
```tsx
          className="relative bg-black border border-amber-500/20 min-w-[150px] max-w-[200px] max-lg:min-w-[140px] max-lg:snap-start flex-shrink-0"
```

- [ ] **Step 5: Verify lint + build**

Run: `npm run lint 2>&1 | tail -5`
Expected: no errors.

Run: `npm test -- --run 2>&1 | tail -10`
Expected: all pass (no test touches these files' DOM assertions).

- [ ] **Step 6: Visual check — the money shot**

Harness at 375/390/430/834. Expected on phones: header is **2 rows** (logo+nav; then a search line + a single non-wrapping control strip), a `CHOKEPOINTS ▸` toggle, and the map claims most of the fold. Tapping the toggle reveals the chokepoint rail; cards scroll cleanly with the next card peeking (no clipped text). Desktop unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/Header.tsx src/components/ui/SearchInput.tsx src/components/ui/ChokepointWidget.tsx
git commit -m "feat(header): full-width mobile search, single scroll strip, collapsible chokepoints"
```

---

### Task 5: Terminal-tighten passive readouts (StatusBar + DataFreshness)

**Files:**
- Modify: `src/components/ui/StatusBar.tsx:70`
- Modify: `src/components/ui/DataFreshness.tsx:62-68`

**Interfaces:**
- Produces: StatusBar's left divider hidden on mobile; DataFreshness label is mono + never wraps.

- [ ] **Step 1: StatusBar — drop the stray divider on mobile**

`StatusBar.tsx:70`:
```tsx
    <div className="flex items-center gap-3 px-2 border-l border-amber-500/20 max-lg:border-l-0 max-lg:px-0" role="status" aria-label="System status indicators">
```

- [ ] **Step 2: DataFreshness — mono + no-wrap label**

`DataFreshness.tsx:62-68` — add `font-mono whitespace-nowrap`:
```tsx
    <span
      className={`text-sm font-mono whitespace-nowrap ${freshness.colorClass} flex items-center gap-1`}
      role="status"
      aria-label={`Data freshness: last updated ${freshness.label}`}
    >
      <span className={`w-2 h-2 ${freshness.dotColor}`} />
      {freshness.label}
    </span>
```
(Also drops the `rounded-full` on the dot span — it was inert anyway under the zero-radius rule; source now matches.)

- [ ] **Step 3: Verify lint**

Run: `npm run lint 2>&1 | tail -5`
Expected: no errors.

- [ ] **Step 4: Visual check**

Harness at 390px `/dashboard`. Expected: freshness reads on one line (e.g. "less than a minute ago" no longer breaks); no floating divider left of AIS/PRICES/NEWS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/StatusBar.tsx src/components/ui/DataFreshness.tsx
git commit -m "feat(header): tidy mobile status divider and freshness label wrapping"
```

---

### ✅ Phase 0 Gate

- [ ] Run full test suite: `npm test -- --run 2>&1 | tail -20` → all pass.
- [ ] Run lint: `npm run lint 2>&1 | tail -5` → clean.
- [ ] Run screenshot harness; Read `iphone-14__dashboard__fold.png`, `iphone-se__dashboard__fold.png`, `ipad-portrait__dashboard__fold.png`, `iphone-14__about__fold.png`. Confirm: 2-row header, iPad portrait stacked, controls absent on /about.
- [ ] Desktop regression: confirm no unprefixed class was changed (review `git diff master..mobile-first-ui -- src/components/ui/Header.tsx`).

---

## Phase 1 — Dashboard (Live Map)

### Task 6: Map owns the fold — dvh heights + stack through tablet

**Files:**
- Modify: `src/app/(protected)/dashboard/page.tsx:59,64,67,73`

- [ ] **Step 1: Outer div → dynamic viewport height**

`dashboard/page.tsx:59`:
```tsx
    <div className="h-dvh flex flex-col bg-black">
```

- [ ] **Step 2: main grid → stack through lg**

`dashboard/page.tsx:64`:
```tsx
      <main className="flex-1 grid grid-cols-[1fr_320px] overflow-hidden max-lg:flex max-lg:flex-col max-lg:overflow-y-auto">
```

- [ ] **Step 3: map wrapper → 70dvh floor on mobile**

`dashboard/page.tsx:67`:
```tsx
          <div className="relative overflow-hidden max-lg:min-h-[70dvh]">
```

- [ ] **Step 4: right rail → lg-gated borders**

`dashboard/page.tsx:73`:
```tsx
          <div className="flex flex-col overflow-y-auto bg-black border-l border-amber-500/20 divide-y divide-amber-500/10 max-lg:border-l-0 max-lg:border-t max-lg:border-amber-500/20">
```

- [ ] **Step 5: Verify lint + visual**

Run: `npm run lint 2>&1 | tail -5` → clean.
Harness at 390 + 834 `/dashboard`. Expected: map fills ~70% of the phone fold; iPad portrait shows a tall single-column map (no cramped 2-col grid, no empty black void below the rail).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(protected)/dashboard/page.tsx"
git commit -m "feat(dashboard): map owns the fold via dvh heights, stack through 1024px"
```

---

### Task 7: Restyle MapLibre attribution to the terminal aesthetic

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Append vendor-CSS overrides (outside @theme, literal values)**

Add to the end of `src/app/globals.css`:
```css
/* MapLibre attribution — override the default white rounded pill to match the
   terminal aesthetic (Tailwind utilities don't apply to vendor DOM, so literal
   values; amber-500 = rgb(245 158 11)). */
.maplibregl-ctrl-attrib,
.maplibregl-ctrl-attrib.maplibregl-compact {
  background: rgba(0, 0, 0, 0.7) !important;
  color: rgb(245 158 11) !important;
  border: 1px solid rgba(245, 158, 11, 0.2) !important;
  border-radius: 0 !important;
  font-family: var(--font-jetbrains), ui-monospace, monospace !important;
  font-size: 9px !important;
}
.maplibregl-ctrl-attrib a { color: rgb(245 158 11) !important; }
.maplibregl-ctrl-attrib-button { filter: invert(1) sepia(1) saturate(5) hue-rotate(5deg) !important; }
```

- [ ] **Step 2: Verify lint + visual**

Run: `npm run lint 2>&1 | tail -5` → clean.
Harness `/dashboard` any viewport. Expected: attribution is a black/amber sharp-cornered mono chip, not a white rounded pill.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(dashboard): restyle MapLibre attribution to terminal aesthetic"
```

---

### Task 8: Silence the Next.js dev indicator (clean captures)

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add devIndicators:false**

`next.config.ts` — add inside `nextConfig`:
```ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['maplibre-gl'],
  turbopack: {},
  devIndicators: false,
}
```

- [ ] **Step 2: Restart dev server (config change) + verify**

Restart: kill and re-run `npm run dev`. Expected: the bottom-left "N" badge no longer appears in dev. (No production impact — it never existed there.)

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "chore: disable Next.js dev indicator for clean UI"
```

---

### ✅ Phase 1 Gate

- [ ] `npm test -- --run` → all pass. `npm run lint` → clean.
- [ ] Harness; Read `iphone-14__dashboard__fold.png`, `ipad-portrait__dashboard__fold.png`, `ipad-landscape__dashboard__full.png`. Confirm: map dominates fold, on-brand attribution, no tablet void, no "N".

---

## Phase 2 — Analytics

### Task 9: Collapse the filter panel behind a mobile disclosure

**Files:**
- Modify: `src/app/(protected)/analytics/page.tsx:127-198`

- [ ] **Step 1: Wrap the controls panel in a mobile-collapsible `<details>`**

The controls `<div>` (line 128) becomes the body of a native `<details>` that is open by default and non-collapsible at `md+` (via CSS: force-open appearance on desktop). Simplest robust approach — use a `useState` gate mirrored to CSS is overkill; use `<details>` with a `<summary>` shown only on mobile.

Replace `analytics/page.tsx:127-128` opening:
```tsx
        {/* Controls — collapsible on mobile so charts lead the fold */}
        <details className="mb-6 group max-md:open:mb-6" open>
          <summary className="hidden max-md:flex items-center justify-between cursor-pointer list-none min-h-[44px] px-3 border border-amber-500/20 bg-gray-900 text-xs font-mono uppercase tracking-widest text-amber-500">
            <span>Filters · {timeRange.toUpperCase()} · {viewMode === 'chokepoint' ? `${selectedChokepoints.length} CP` : 'ROUTE'} · {priceSymbol}</span>
            <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span>
          </summary>
          <div className="flex flex-wrap gap-4 items-center max-md:mt-2 p-3 bg-gray-900 border border-amber-500/20">
```
Then the existing controls (Time Range / View / Chokepoints / Price / Ship Type blocks, lines 129-197) stay unchanged inside this `<div>`, and close it plus the `<details>` where the old controls `</div>` was (line 198):
```tsx
          </div>
        </details>
```

- [ ] **Step 2: Verify lint + visual**

Run: `npm run lint 2>&1 | tail -5` → clean.
Harness `/analytics` at 375 + 834. Expected on phone: a single 44px "Filters · 7D · … · WTI" summary bar; the panel is collapsed and the first chart title is near the top of the fold. Desktop (≥768px): `<summary>` hidden, panel always visible (details is `open`).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/analytics/page.tsx"
git commit -m "feat(analytics): collapse filter panel behind mobile disclosure"
```

---

### Task 10: De-cramp charts + JetBrains Mono + amber-mono titles + borders

**Files:**
- Modify: `src/components/charts/TrafficChart.tsx`

**Interfaces:**
- Produces: `TrafficChart` renders full-width legible charts on mobile with mono SVG text and amber-mono titles.

- [ ] **Step 1: Add a mobile-detection-free responsive font + a small-screen prop**

Recharts needs literal font in SVG. Add a mono font constant and set `fontFamily` on axes/legend/tooltip. Since we can't read viewport in SSR-safe render, use CSS to shrink on mobile is not possible for SVG internals — instead drop the rotated axis captions always (they add little on any width) and set compact tick sizing. Replace the `COLORS` block region and add:
```tsx
const MONO = 'var(--font-jetbrains), ui-monospace, monospace';
```

- [ ] **Step 2: Title → amber mono uppercase + panel border**

`TrafficChart.tsx:71-74`:
```tsx
    <div className="bg-black p-4 border border-amber-500/20" role="img" aria-label={title || 'Vessel traffic chart'}>
      {title && (
        <h3 className="text-xs font-mono uppercase tracking-widest text-amber-500 mb-4">{title}</h3>
      )}
```

- [ ] **Step 3: Axes → mono ticks, no rotated captions, narrower Y**

Replace the `<XAxis>` and both `<YAxis>` (lines 78-110) with:
```tsx
          <XAxis
            dataKey="date"
            stroke={COLORS.axis}
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fontFamily: MONO }}
            minTickGap={24}
          />
          <YAxis
            yAxisId="left"
            width={36}
            stroke={COLORS.axis}
            tick={{ fontSize: 10, fontFamily: MONO }}
          />
          {showPrice && (
            <YAxis
              yAxisId="right"
              orientation="right"
              width={36}
              stroke={COLORS.axis}
              tick={{ fontSize: 10, fontFamily: MONO }}
            />
          )}
```

- [ ] **Step 4: Tooltip + Legend → mono**

`TrafficChart.tsx:111-119` — add font to tooltip contentStyle and legend:
```tsx
          <Tooltip
            contentStyle={{
              backgroundColor: '#000000',
              border: '1px solid #374151',
              borderRadius: '0',
              fontFamily: MONO,
              fontSize: 11,
            }}
            labelFormatter={(label) => formatDate(String(label))}
          />
          <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 11 }} />
```

- [ ] **Step 5: Empty-state placeholder → border to match**

`TrafficChart.tsx:60-67` — add border so it matches populated charts:
```tsx
      <div
        className="flex items-center justify-center bg-black border border-amber-500/20"
        style={{ height }}
      >
        <p className="text-gray-400 font-mono text-sm">No data available for selected range</p>
      </div>
```

- [ ] **Step 6: Verify lint + tests + visual**

Run: `npm run lint 2>&1 | tail -5` → clean.
Run: `npm test -- --run 2>&1 | tail -10` → pass.
Harness `/analytics` at 375. Expected: chart title amber mono uppercase; axes mono, no rotated "Vessels"/"WTI (USD)" captions; plot area noticeably wider; bordered panel.

- [ ] **Step 7: Commit**

```bash
git add src/components/charts/TrafficChart.tsx
git commit -m "feat(analytics): de-cramp charts, JetBrains Mono SVG text, amber-mono titles, borders"
```

---

### Task 11: 44px touch targets on analytics selectors

**Files:**
- Modify: `src/components/ui/TimeRangeSelector.tsx:29`
- Modify: `src/components/ui/ChokepointSelector.tsx:28`
- Modify: `src/app/(protected)/analytics/page.tsx` (View/Price/Ship-Type inline buttons: lines 142-143, 169-170, 189-190)

- [ ] **Step 1: TimeRangeSelector**

`TimeRangeSelector.tsx:29`:
```tsx
          className={`inline-flex items-center px-3 py-1.5 max-md:min-h-[44px] text-xs font-mono uppercase tracking-wider border transition-colors ${
```

- [ ] **Step 2: ChokepointSelector — buttons + 2-col grid on mobile**

`ChokepointSelector.tsx:27` container:
```tsx
    <div className="flex gap-2 flex-wrap max-md:grid max-md:grid-cols-2" role="group" aria-label="Chokepoint selection">
```
`ChokepointSelector.tsx:28` button:
```tsx
          className={`inline-flex items-center justify-center px-3 py-1.5 max-md:min-h-[44px] text-xs font-mono uppercase tracking-wider border transition-colors ${
```

- [ ] **Step 3: analytics page inline buttons (View, Price, Ship Type)**

These three button groups share the class string `... text-xs font-mono uppercase tracking-wider px-2 py-1`. For all three (lines 142-143, 169-170, 189-190) change the trailing `px-2 py-1` to `px-2 py-1 max-md:min-h-[44px] max-md:px-3 inline-flex items-center`. Apply to both the active and inactive ternary branches (each branch carries the full class string). Also bump the group gaps: lines 135, 162, 182 `flex gap-1` → `flex gap-1 max-md:gap-2`.

- [ ] **Step 4: Verify lint + visual**

Run: `npm run lint 2>&1 | tail -5` → clean.
Harness `/analytics` at 390 (expand the filter disclosure). Expected: all toggle buttons ≥44px, chokepoints in a 2-col grid, comfortable gaps.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/TimeRangeSelector.tsx src/components/ui/ChokepointSelector.tsx "src/app/(protected)/analytics/page.tsx"
git commit -m "feat(analytics): 44px touch targets on all selectors"
```

---

### Task 12: Shorter chart plots + tighter stack on mobile

**Files:**
- Modify: `src/app/(protected)/analytics/page.tsx` (chart `height` + stack spacing: lines 217, 229, 240, 250)

- [ ] **Step 1: Responsive stack spacing**

Both chart-list wrappers (lines 217 and 240) `space-y-6` → `space-y-4 md:space-y-6`.

- [ ] **Step 2: Shorter height on mobile via a responsive value**

The `height={350}` props (lines 229, 250) are JS numbers, not CSS. To make them responsive without a viewport read, pass a smaller constant that still reads fine on desktop is wrong (desktop must stay 350). Instead, keep `height={350}` and let the ResponsiveContainer width shrink handle mobile — the plan's Task 10 already reclaimed horizontal room. **Decision: skip JS height switching** (would require a client viewport hook, violating SSR-safety and desktop-unchanged). Only apply the stack-spacing change from Step 1.

- [ ] **Step 3: Verify lint + commit**

Run: `npm run lint 2>&1 | tail -5` → clean.
```bash
git add "src/app/(protected)/analytics/page.tsx"
git commit -m "feat(analytics): tighten chart stack spacing on mobile"
```

---

### ✅ Phase 2 Gate

- [ ] `npm test -- --run` → pass. `npm run lint` → clean.
- [ ] Harness; Read `iphone-14__analytics__fold.png`, `iphone-se__analytics__full.png`, `ipad-portrait__analytics__fold.png`. Confirm: chart leads the fold, charts legible + mono + bordered, controls ≥44px.

---

## Phase 3 — Fleet Overview

### Task 13: SanctionedVessels — phone card list + md+ table (fixes critical data loss)

**Files:**
- Modify: `src/components/fleet/SanctionedVessels.tsx:42-124`
- Modify: `src/components/fleet/__tests__/SanctionedVessels.test.tsx` (scope queries for dual-render)

**Interfaces:**
- Consumes: existing `expandedImo` state, `FleetVesselDetail`.
- Produces: on `<md`, a card list where **Sanction Category is always visible**; on `md+`, the current table. Both share `expandedImo`.

- [ ] **Step 1: Update the test FIRST (TDD) — scope queries to avoid duplicate-match failures**

The dual-render puts each vessel name in both the card list and the table (one CSS-hidden). happy-dom ignores CSS, so `getByText('SHADOW RUNNER')` would throw on 2 matches. Update `SanctionedVessels.test.tsx` to use `getAllByText(...).length` where duplication is expected, and scope the risk-color test to the table. Replace the "renders vessel data correctly" test body:
```tsx
  it('renders vessel data correctly — names, IMOs, flags, and categories appear', () => {
    render(<SanctionedVessels vessels={mockSanctionedVessels} />);
    // Dual-render (mobile card + desktop table) means each datum can appear twice.
    expect(screen.getAllByText('SHADOW RUNNER').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('DARK PHANTOM').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1111111').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2222222').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('IR').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SY').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SDN List').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('EU Sanctions').length).toBeGreaterThanOrEqual(1);
  });
```
And the risk-color test → use `getAllByText` and assert at least one match carries the color:
```tsx
  it('colors risk score red when ≥70, amber when ≥40', () => {
    render(<SanctionedVessels vessels={mockSanctionedVessels} />);
    expect(screen.getAllByText('85').some((el) => el.className.includes('text-red-400'))).toBe(true);
    expect(screen.getAllByText('45').some((el) => el.className.includes('text-amber-400'))).toBe(true);
  });
```
The single-vessel test's `getByText('SHADOW RUNNER')` → `getAllByText('SHADOW RUNNER')[0]`; `queryByText('DARK PHANTOM')` → `expect(screen.queryAllByText('DARK PHANTOM')).toHaveLength(0)`.

- [ ] **Step 2: Run the updated test — expect FAIL (dual-render not built yet)**

Run: `npm test -- --run SanctionedVessels 2>&1 | tail -15`
Expected: the "renders vessel data" test now passes (single render still ≥1), but there is no card list yet. This step establishes the queries won't break when we add the second render. (If all green, that's fine — the real gate is Step 4 visual.)

- [ ] **Step 3: Add the mobile card list + gate the table to md+**

`SanctionedVessels.tsx:43` — gate the existing table wrapper:
```tsx
      <div className="hidden md:block overflow-x-auto">
```
Immediately AFTER the closing `</div>` of that table wrapper (line 124, before the component's outer closing `</div>`), insert the mobile card list:
```tsx
      {/* Mobile card list — Sanction Category always visible (desktop table clips it) */}
      <div className="md:hidden divide-y divide-red-500/10">
        {vessels.map((vessel) => (
          <React.Fragment key={vessel.imo}>
            <button
              type="button"
              data-imo={vessel.imo}
              aria-expanded={expandedImo === vessel.imo}
              aria-label={`${vessel.vesselName || vessel.imo}: expand for intelligence dossier`}
              onClick={() => setExpandedImo((prev) => (prev === vessel.imo ? null : vessel.imo))}
              className={`w-full text-left min-h-[44px] px-4 py-3 ${expandedImo === vessel.imo ? 'bg-red-500/10' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-mono text-gray-200">{vessel.vesselName || '—'}</span>
                {vessel.riskScore != null && (
                  <span className={`text-xs font-mono border px-2 py-0.5 ${
                    vessel.riskScore >= 70 ? 'border-red-400 text-red-400'
                      : vessel.riskScore >= 40 ? 'border-amber-400 text-amber-400'
                      : 'border-green-400 text-green-400'}`}>
                    RISK {vessel.riskScore}
                  </span>
                )}
              </div>
              <div className="text-xs font-mono text-gray-500 mt-1">
                IMO {vessel.imo} · {vessel.flag || '—'}
              </div>
              <div className="text-xs font-mono text-red-400/90 mt-1.5 border-t border-red-500/15 pt-1.5">
                {vessel.sanctionRiskCategory || '—'}
              </div>
            </button>
            {expandedImo === vessel.imo && (
              <FleetVesselDetail
                imo={vessel.imo}
                anomalyDetails={vessel.details as Parameters<typeof FleetVesselDetail>[0]['anomalyDetails']}
                anomalyType={vessel.anomalyType}
              />
            )}
          </React.Fragment>
        ))}
      </div>
```

- [ ] **Step 4: Verify tests + lint + visual**

Run: `npm test -- --run SanctionedVessels 2>&1 | tail -15` → PASS.
Run: `npm run lint 2>&1 | tail -5` → clean.
Harness `/fleet` at 375/390. Expected: sanctioned vessels render as cards; **sanction category (e.g. "SDN List") is fully visible**; whole card is a tall tap target that expands the dossier. Desktop (≥768px): the original table, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/fleet/SanctionedVessels.tsx src/components/fleet/__tests__/SanctionedVessels.test.tsx
git commit -m "feat(fleet): phone card list for sanctioned vessels (fixes clipped sanction category)"
```

---

### Task 14: AnomalyTable — hide non-essential columns + taller rows on mobile

**Files:**
- Modify: `src/components/fleet/AnomalyTable.tsx` (th/td for IMO lines 70-72,106-108; Confidence lines 79-81,129-131; row min-height)
- Check: `src/components/fleet/__tests__/AnomalyTable.test.tsx` (assertions use toggle/table presence + names — unaffected by column hiding since happy-dom ignores CSS)

- [ ] **Step 1: Hide IMO + Confidence columns on mobile**

Add `max-md:hidden` to the IMO `<th>` (line 70) and its `<td>` (line 106), and the Confidence `<th>` (line 79) and its `<td>` (line 129). Example — IMO th:
```tsx
                <th className="max-md:hidden px-4 py-2 text-xs font-mono uppercase tracking-widest text-amber-500 font-normal">
                  IMO
                </th>
```
IMO td (line 106):
```tsx
                  <td className="max-md:hidden px-4 py-2 text-sm font-mono text-gray-400">
                    {anomaly.imo}
                  </td>
```
Confidence th (line 79) and td (line 129) likewise gain `max-md:hidden`.

- [ ] **Step 2: Taller rows on mobile — pad the interactive `<tr>`**

The clickable row (line 90-95) — the cells set height. Add mobile vertical padding to the name cell (the first td, line 103) so rows clear 44px:
```tsx
                  <td className="px-4 py-2 max-md:py-3.5 text-sm font-mono text-gray-300">
                    {anomaly.vesselName || '—'}
                  </td>
```

- [ ] **Step 3: Verify tests + lint + visual**

Run: `npm test -- --run AnomalyTable 2>&1 | tail -15` → PASS (assertions unaffected).
Run: `npm run lint 2>&1 | tail -5` → clean.
Harness `/fleet` at 375, expand an anomaly section. Expected: 4 columns (Name, Flag, Risk, Detected) fit without horizontal scroll; rows taller. Desktop: 6 columns unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/fleet/AnomalyTable.tsx
git commit -m "feat(fleet): hide IMO/Confidence columns + taller rows on mobile"
```

---

### Task 15: Dossier grid + export buttons + summary strip + badge hygiene

**Files:**
- Modify: `src/components/fleet/FleetVesselDetail.tsx:230`
- Modify: `src/app/(protected)/fleet/page.tsx:106-119` (export buttons) + summary strip after line 104
- Modify: `src/components/ui/AnomalyBadge.tsx:73` (remove `rounded`)

- [ ] **Step 1: Dossier grid reflow 1→2→4**

`FleetVesselDetail.tsx:230`:
```tsx
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
```

- [ ] **Step 2: Export buttons → 44px touch targets**

`fleet/page.tsx:107-118` — add `inline-flex items-center max-md:min-h-[44px]` to both anchors:
```tsx
            <a
              href="/api/export?format=csv"
              className="inline-flex items-center max-md:min-h-[44px] px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition-colors"
            >
              Export CSV
            </a>
            <a
              href="/api/export?format=json"
              className="inline-flex items-center max-md:min-h-[44px] px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-gray-600/50 text-gray-400 hover:bg-gray-800/50 transition-colors"
            >
              JSON
            </a>
```

- [ ] **Step 3: Mobile anomaly-type summary strip**

In `fleet/page.tsx`, immediately after the title block `</div>` (line 104, the one closing the `<div>` that holds h1 + subtitle) and before the export `<div className="flex gap-2 shrink-0">`, the layout is a flex row — instead insert the summary strip after the whole title-row `</div>` (line 120), before the loading state. Insert:
```tsx
        {/* Mobile-only anomaly-type overview (desktop shows counts in section headers) */}
        {!loading && !error && anomalies.length > 0 && (
          <div className="hidden max-md:flex flex-wrap gap-x-4 gap-y-1 mb-4 px-3 py-2 border border-amber-500/20 bg-gray-900/40 text-xs font-mono uppercase tracking-wider text-gray-400">
            {groups.map(({ type, items }) => (
              <span key={type}>{ANOMALY_TYPE_LABELS[type]} <span className="text-amber-500">{items.length}</span></span>
            ))}
          </div>
        )}
```
Add the import at the top of `fleet/page.tsx` if not present: `import { ANOMALY_TYPE_LABELS } from '@/types/anomaly';` (check line 16 region — `AnomalyType` is already imported from there; extend it: `import type { Anomaly, AnomalyType } from '@/types/anomaly';` stays, add a separate value import `import { ANOMALY_TYPE_LABELS } from '@/types/anomaly';`).

- [ ] **Step 4: AnomalyBadge — remove dead `rounded` token**

`AnomalyBadge.tsx:73`:
```tsx
      className={`inline-flex items-center gap-1 ${config.bg} text-white font-semibold ${sizeClasses}`}
```

- [ ] **Step 5: Verify tests + lint + visual**

Run: `npm test -- --run 2>&1 | tail -15` → all pass.
Run: `npm run lint 2>&1 | tail -5` → clean.
Harness `/fleet` at 375 + 834. Expected: export buttons ≥44px; a mobile summary strip up top; dossier (expand a card) is 1-col on phone, 2-col on iPad.

- [ ] **Step 6: Commit**

```bash
git add src/components/fleet/FleetVesselDetail.tsx "src/app/(protected)/fleet/page.tsx" src/components/ui/AnomalyBadge.tsx
git commit -m "feat(fleet): dossier grid reflow, 44px exports, mobile summary strip, badge hygiene"
```

---

### ✅ Phase 3 Gate

- [ ] `npm test -- --run` → pass. `npm run lint` → clean.
- [ ] Harness; Read `iphone-14__fleet__full.png`, `iphone-se__fleet__fold.png`, `ipad-landscape__fleet__full.png`. Confirm: sanction category visible, cards tap-sized, dossier legible on tablet.

---

## Phase 4 — About

### Task 16: Dual-render the Dark Fleet Risk Score table

**Files:**
- Modify: `src/app/(protected)/about/page.tsx:110-150` + `:16` (main width)

- [ ] **Step 1: Align main padding/width with sibling pages**

`about/page.tsx:16`:
```tsx
      <main className="p-6 max-w-7xl mx-auto max-md:p-3">
```

- [ ] **Step 2: Lift risk rows into a const above the return**

Near the top of the component body (before `return (`), add:
```tsx
  const RISK_ROWS = [
    { factor: 'Going Dark History', points: '8 pts / event', note: 'Capped at 40 pts (5 events max contribution)' },
    { factor: 'Sanctions Match', points: '25 pts', note: 'Binary — vessel IMO appears in OpenSanctions database' },
    { factor: 'Flag State Risk', points: '15 pts', note: 'High-risk flags: IR, RU, VE, KP, PA, CM, KM' },
    { factor: 'Loitering History', points: '10 pts', note: 'Binary — any loitering event in past 90 days' },
    { factor: 'STS Transfer History', points: '10 pts', note: 'Binary — any STS transfer event on record' },
  ];
```

- [ ] **Step 3: Gate the table to md+ and add a mobile stacked block**

`about/page.tsx:110` — hide the table on mobile:
```tsx
            <table className="hidden md:table w-full font-mono text-sm" style={{ borderCollapse: 'collapse' }}>
```
Immediately after the table's closing `</table>` (line 150), insert the mobile stacked list:
```tsx
            {/* Mobile stacked view — full-width notes, readable on a phone */}
            <div className="md:hidden space-y-2">
              {RISK_ROWS.map((r) => (
                <div key={r.factor} className="border border-amber-500/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">{r.factor}</span>
                    <span className="text-amber-500 text-sm">{r.points}</span>
                  </div>
                  <div className="text-gray-500 text-xs mt-1">{r.note}</div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-amber-500/20 pt-2 px-3">
                <span className="text-amber-500 font-bold text-sm">Total Maximum</span>
                <span className="text-amber-500 font-bold text-sm">100 pts</span>
              </div>
            </div>
```

- [ ] **Step 4: Verify lint + visual**

Run: `npm run lint 2>&1 | tail -5` → clean.
Harness `/about` at 375 + 834. Expected on phone: risk factors as stacked blocks with full-width notes (no cramped 3-col wrap); title + first definition above the fold (thanks to Phase 0 route-gating). Desktop: original table unchanged.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/about/page.tsx"
git commit -m "feat(about): stacked risk-score table on mobile, align page width"
```

---

### Task 17: Stack pipe-delimited anomaly config strings on mobile

**Files:**
- Modify: `src/app/(protected)/about/page.tsx` (anomaly config lines — the pipe-delimited `text-gray-500 text-xs font-mono` rows)

- [ ] **Step 1: Inspect the config-string rows**

Read `about/page.tsx:30-99` to find the `font-mono` config lines using `&nbsp;|&nbsp;` (or `|`) separators inside each anomaly definition. (These are the `<div className="text-gray-500 text-xs font-mono">` lines, ~line 38/49/60/71/82.)

- [ ] **Step 2: For each config line, make separators mobile-stacking**

For each such line, wrap segments so they stack on phone and rejoin at `sm+`. Pattern — replace an inline string like:
```tsx
<div className="text-gray-500 text-xs font-mono">threshold: 6h | zone: monitored | min gap: 240m</div>
```
with:
```tsx
<div className="text-gray-500 text-xs font-mono flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-2">
  <span>threshold: 6h</span>
  <span className="hidden sm:inline text-amber-500/40">|</span>
  <span>zone: monitored</span>
  <span className="hidden sm:inline text-amber-500/40">|</span>
  <span>min gap: 240m</span>
</div>
```
(Apply to each config line, preserving the exact text content already present in the source.)

- [ ] **Step 3: Verify lint + visual**

Run: `npm run lint 2>&1 | tail -5` → clean.
Harness `/about` at 375. Expected: each config parameter on its own line on phone (no mid-clause wrap); joined with amber pipes at ≥640px.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(protected)/about/page.tsx"
git commit -m "feat(about): stack anomaly config strings on mobile"
```

---

### ✅ Phase 4 Gate

- [ ] `npm test -- --run` → pass. `npm run lint` → clean.
- [ ] Harness; Read `iphone-14__about__fold.png`, `iphone-se__about__full.png`. Confirm: content leads the fold, readable risk formula, no cramped config wraps.

---

## Phase 5 — Final Regression & Sign-off

### Task 18: Full-matrix screenshot pass + desktop regression

**Files:** none (verification)

- [ ] **Step 1: Full suite + lint**

Run: `npm test -- --run 2>&1 | tail -25` → all pass, same count as Task 0 baseline (plus any test edits).
Run: `npm run lint 2>&1 | tail -10` → clean.

- [ ] **Step 2: Full 5-viewport × 4-view screenshot pass**

Run the harness fresh into `/tmp/straits-audit/shots-after/` (edit `OUT`). Read a representative set: all 5 dashboard folds, all analytics folds, all fleet folds, about folds. Confirm every surface matches the approved before/after mockups.

- [ ] **Step 3: Desktop regression at 1440px**

Temporarily add `{ id:'desktop', w:1440, h:900, dpr:1, mobile:false }` to the harness DEVICES, re-run for the 4 views, and diff against a pre-branch capture (or visually confirm identical to `master`). Expected: desktop is pixel-identical — every change was breakpoint-gated.

- [ ] **Step 4: Review the full diff for unprefixed-class changes**

Run: `git diff master..mobile-first-ui -- '*.tsx' '*.css' | grep -E '^\+' | grep -vE 'max-md:|max-lg:|md:|sm:|xl:|lg:|max-sm:' | grep -iE 'className|class=' | head -40`
Manually confirm every remaining line is either a new mobile-only element, a route-gate conditional, a mono/border addition on charts (intended), or the dead-`rounded` removals — NOT a desktop-layout regression.

- [ ] **Step 5: Clean up verification artifacts**

```bash
rm -f /Users/randyren/Developer/tanker-tracker/.audit-shoot.mjs /Users/randyren/Developer/tanker-tracker/.audit-render.mjs
git status --short   # expect clean (only committed source changed)
```

- [ ] **Step 6: Final commit (if any test files changed beyond Task 13) + summary**

```bash
git add -A && git commit -m "test: finalize mobile-first UI rework" --allow-empty
git log --oneline master..mobile-first-ui
```

---

## Self-Review (author checklist — completed)

**Spec coverage:** All 5 surfaces + D1/D2/D3 mapped to tasks. Header §5.1 → Tasks 1-5; Dashboard §5.2 → Tasks 6-8; Analytics §5.3 → Tasks 9-12; Fleet §5.4 → Tasks 13-15; About §5.5 → Tasks 16-17; verification §7 → phase gates + Task 18. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows real code from the current source. Task 12 Step 2 and Task 17 Step 1 contain an explicit inspection step because the exact source lines are variable — flagged, not hand-waved. ✓

**Type/name consistency:** `expandedImo` reused (not renamed) in Task 13; `chokepointsOpen` introduced once (Task 4); `RISK_ROWS` introduced once (Task 16); `ANOMALY_TYPE_LABELS` import verified to exist in `@/types/anomaly`. ✓

**Known deviations from spec (intentional, documented):**
- **Analytics chart height (spec §5.3 P2 "260px on phone")** — dropped in Task 12 Step 2. Switching a Recharts numeric `height` by viewport needs a client-side viewport hook, which violates the SSR-safety + desktop-unchanged constraints. Horizontal de-cramping (Task 10) already delivers legibility. Net: stack spacing tightened only.
- **Dashboard "collapse header into toggle-in controls" (spec §5.2 P0/L)** — implemented as the lighter 2-row + chokepoint-toggle approach from the approved mockup (Task 4), not a separate overlay drawer. The mockup the user approved shows exactly this.
