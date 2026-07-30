# Search Affordances & Tablet Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Straits a real tablet tier between the phone stack and the desktop layout, and make vessel search produce visible output in every state.

**Architecture:** Three Tailwind v4 `@custom-variant`s (`phone` / `roomy` / `desk`) replace the single `lg` breakpoint. `phone` and `roomy` are De Morgan complements including a 600px height guard, so a landscape phone never inherits a two-pane layout. Each concern migrates only the files it touches, and brings its own verification. The dashboard's panel stack is extracted once into `RailPanels` and consumed by both the desktop pinned rail and a new tablet `IntelDrawer`.

**Tech Stack:** Next.js 16 (Turbopack), React 19, TypeScript 5, Tailwind CSS v4.2.1, Zustand, Vitest + Testing Library (happy-dom), Playwright (measurement harness).

**Spec:** `docs/superpowers/specs/2026-07-30-search-affordance-and-tablet-tier-design.md`
**Mockup:** https://claude.ai/code/artifact/0e41ba4f-606e-45ed-abb0-f508984a28a7
**Branch:** `tablet-tier-and-search` (already created, spec already committed)

---

## Global Constraints

- **Breakpoints, exact values:** `phone` = `@media (max-width: 767.98px), (max-height: 599.98px)`; `roomy` = `@media (min-width: 768px) and (min-height: 600px)`; `desk` = `@media (min-width: 1280px) and (min-height: 600px)`. Do not round `767.98` to `767`, and do not drop the height clauses.
- **`phone` and `roomy` must stay exact complements.** Every viewport matches exactly one — never both, never neither.
- **Migration rule:** within a file being migrated, `max-lg:` → `phone:` and `lg:` → `roomy:`, *except* the sites named in the desktop-only exception list below, which become `desk:`.
- **The `lg:` breakpoint stays defined at 1024px** for the whole migration. Un-migrated files keep working; `max-lg:` and `phone:` coexist across files.
- **Regression gate, every task:** `npm run verify:dashboard` and `npm run verify:fleet` must stay green at 390×844, 360×800, and 1440×900. Those passes are the proof each rename was a no-op at phone and desktop widths.
- **Bloomberg aesthetic is fixed:** true black, amber-500, JetBrains Mono, zero border-radius (`--radius-*: initial` in `globals.css` makes every `rounded-*` a no-op — do not add them).
- **Touch targets stay ≥ 44×44px** on `phone` and `roomy`. The harness fails the build otherwise.
- **Commit style:** Conventional Commits, matching existing history (`fix(identity):`, `feat(dashboard):`, `test(dashboard):`).

### Desktop-only exception list (become `desk:`, not `roomy:`)

| Site | File | Reason |
|---|---|---|
| 320px pinned rail | `dashboard/page.tsx` | Tablet gets `IntelDrawer` instead |
| `DataFreshness` | `ui/Header.tsx` | Duplicates `StatusChip`; first cut at 1180 |
| `StatusChip` desktop row (the AIS/PRICES/NEWS legend) | `ui/StatusChip.tsx` | Compact chip serves phone *and* tablet |
| `TankerFilter` + `AnomalyFilter` in the header | `ui/Header.tsx` | Move to the map at tablet — see below |
| `MapFilterChips` | `map/MapFilterChips.tsx` | Chips stay on the map through tablet |
| `flex-wrap` tab strip | `fleet/FleetTabs.tsx` | Eight tabs orphan 7+1 at 1180 |

**Why the last three exceed the spec's four-row table:** measured during planning. At 820px portrait the header would need logo 110 + nav 330 + search 192 + filters 200 + bell 40 + chip 60 = **~932px in an 820px viewport** — horizontal overflow, which the harness fails. Moving the two filter chips onto the map surface at tablet (where `MapFilterChips` already puts them on phone) brings it to ~732px. This is a planning refinement to the spec's exception list, not a change of design.

### Files at a glance

| File | Responsibility | Task |
|---|---|---|
| `src/app/globals.css` | Variant definitions | 1 |
| `src/components/ui/Header.tsx` | Top bar: nav, search, control row, chokepoints | 2 |
| `src/components/ui/StatusChip.tsx` | Compact chip (phone+tablet) vs legend row (desk) | 2 |
| `src/components/ui/MobileBottomNav.tsx` | Phone-only bottom nav | 2 |
| `src/components/ui/{TankerFilter,AnomalyFilter,NotificationBell,TimeRangeSelector,ChokepointSelector,ChokepointWidget}.tsx` | Touch-target renames only | 2 |
| `src/components/panels/RailPanels.tsx` | **New.** The panel stack, rendered once, consumed twice | 3 |
| `src/components/dashboard/IntelDrawer.tsx` | **New.** Tablet overlay drawer; open/close state only | 3 |
| `src/app/(protected)/dashboard/page.tsx` | Three-state layout; search-select handler | 3, 6 |
| `src/components/map/MapFilterChips.tsx` | Map-anchored filters through tablet | 3 |
| `src/components/dashboard/MobileSheet.tsx` | Phone-only sheet | 3 |
| `src/components/fleet/*.tsx`, `fleet/page.tsx` | Fleet tables and tab strip | 4 |
| `src/app/(protected)/{analytics,about}/page.tsx` | Page-level padding and disclosure | 5 |
| `src/components/ui/SearchInput.tsx` | Six search states | 6 |
| `scripts/verify-dashboard-layout.mjs` | Measurement harness | 2, 3 |
| `scripts/verify-fleet-layout.mjs` | Measurement harness | 4 |

---

## Task 1: Define the three responsive variants

Pure addition. No usages yet, so this cannot change rendered output anywhere.

**Files:**
- Modify: `src/app/globals.css:13` (immediately after the `@theme` block)

**Interfaces:**
- Consumes: nothing
- Produces: the `phone:`, `roomy:`, and `desk:` Tailwind variant prefixes, usable in any `className` from Task 2 onward

- [ ] **Step 1: Add the variant definitions**

Insert immediately after the closing `}` of the `@theme` block in `src/app/globals.css` (line 13), before the `:root` block:

```css
/* Responsive tiers.
 *
 * Tailwind's default `lg` sits at 1024px, which bisects one physical device:
 * iPad portrait (820) falls below it and got the phone stack, iPad landscape
 * (1180) falls above it and got a layout laid out for 1440. Rotating the device
 * swapped the whole information architecture.
 *
 * `phone` and `roomy` are De Morgan complements — every viewport matches
 * exactly one, never both, never neither. `desk` nests strictly inside `roomy`.
 *
 * The height clause is not decoration. iPhone 16 Pro Max in landscape is
 * 932x430: wide enough to pass a width-only tablet test, with nowhere near the
 * vertical room for two panes. It must stay on the phone stack.
 *
 * M3 window size classes put 820 in Medium and 1180 in Expanded; neither
 * prescribes a bottom bar. Apple HIG classes iPad as `regular` width in both
 * orientations. Desktop starts at 1280 because the pinned rail, four chokepoint
 * widgets, and full control row were laid out at 1440 and cram at 1180.
 */
@custom-variant phone {
  @media (max-width: 767.98px), (max-height: 599.98px) { @slot; }
}
@custom-variant roomy {
  @media (min-width: 768px) and (min-height: 600px) { @slot; }
}
@custom-variant desk {
  @media (min-width: 1280px) and (min-height: 600px) { @slot; }
}
```

- [ ] **Step 2: Prove the variants emit the exact media queries**

The block form with `@slot` is required — the shorthand `@custom-variant name (@media ...)` form does not parse a comma-separated media list. Verify the compiled output rather than trusting it:

```bash
mkdir -p .tw-probe
cat > .tw-probe/in.css <<'EOF'
@import "tailwindcss";
@custom-variant phone {
  @media (max-width: 767.98px), (max-height: 599.98px) { @slot; }
}
@custom-variant roomy {
  @media (min-width: 768px) and (min-height: 600px) { @slot; }
}
@custom-variant desk {
  @media (min-width: 1280px) and (min-height: 600px) { @slot; }
}
EOF
cat > .tw-probe/src.html <<'EOF'
<div class="phone:hidden roomy:flex desk:grid"></div>
EOF
cat > .tw-probe/run.mjs <<'EOF'
import postcss from 'postcss';
import tw from '@tailwindcss/postcss';
import { readFileSync } from 'node:fs';
const css = readFileSync('.tw-probe/in.css', 'utf8');
const out = await postcss([tw({ base: process.cwd() + '/.tw-probe' })])
  .process(css, { from: process.cwd() + '/.tw-probe/in.css' });
const m = out.css.match(/\.(phone|roomy|desk)\\:[\s\S]*?(?=\n@layer|\n\/\*|$)/);
console.log(m ? m[0].slice(0, 700) : '!! no variant utilities emitted');
EOF
node .tw-probe/run.mjs
```

Expected output, exactly:

```
.phone\:hidden {
    @media (max-width: 767.98px), (max-height: 599.98px) {
      display: none;
    }
  }
  .roomy\:flex {
    @media (min-width: 768px) and (min-height: 600px) {
      display: flex;
    }
  }
  .desk\:grid {
    @media (min-width: 1280px) and (min-height: 600px) {
      display: grid;
    }
  }
}
```

If you see `!! no variant utilities emitted`, the syntax is wrong — do not proceed.

- [ ] **Step 3: Remove the probe**

```bash
rm -rf .tw-probe
git status --short   # must show only src/app/globals.css
```

- [ ] **Step 4: Confirm the production build still compiles**

Run: `npm run build`
Expected: build completes with no CSS errors. Unused variant definitions emit no CSS, so bundle size is unchanged.

- [ ] **Step 5: Confirm no rendered output changed**

Run: `npm run test -- --run`
Expected: all suites pass, same counts as before this task.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(css): define phone/roomy/desk responsive tiers

Tailwind's default lg=1024 bisects one physical device: iPad portrait
(820) fell below it into the phone stack, landscape (1180) fell above it
into a layout built for 1440, so rotating swapped the whole information
architecture.

phone and roomy are De Morgan complements including a 600px height
guard, so a 932x430 phone in landscape stays on the phone stack rather
than inheriting two panes.

No usages yet — unused variants emit no CSS, so this changes no
rendered output."
```

---

## Task 2: Header and navigation at tablet

Migrates the header cluster and promotes the four header-level exceptions. After this task, both iPad orientations show the top nav and the chokepoint strip.

**Files:**
- Modify: `src/components/ui/Header.tsx:56,69,92,113,133,141`
- Modify: `src/components/ui/StatusChip.tsx:115,123,151`
- Modify: `src/components/ui/MobileBottomNav.tsx:27`
- Modify: `src/components/ui/NotificationBell.tsx:107`
- Modify: `src/components/ui/TankerFilter.tsx:17`
- Modify: `src/components/ui/AnomalyFilter.tsx:18`
- Modify: `src/components/ui/TimeRangeSelector.tsx:29`
- Modify: `src/components/ui/ChokepointSelector.tsx:28,34`
- Modify: `src/components/ui/ChokepointWidget.tsx:129,133,142,162,171`
- Test: `src/components/ui/Header.test.tsx:20,25,30,45,53-54`
- Test: `src/components/ui/StatusChip.test.tsx:43`
- Test: `src/components/ui/MobileBottomNav.test.tsx:28`
- Test: `scripts/verify-dashboard-layout.mjs` (add tablet viewports)

**Interfaces:**
- Consumes: `phone:` / `roomy:` / `desk:` variants from Task 1
- Produces: `data-testid="header-controls"` visible at `roomy` and above; `data-testid="header-chokepoints"` visible at `roomy` and above; `nav[aria-label="Primary"]` (bottom nav) visible at `phone` only; exactly one visible `[data-testid^="status-chip"]` and one `[aria-label*="Notification"]` at every width

- [ ] **Step 1: Write the failing unit tests**

Replace the class assertions in `src/components/ui/Header.test.tsx`. Lines 20, 25, 30, 45 and the comment at 53-54:

```typescript
// line 20
expect(screen.getByRole('navigation')).toHaveClass('phone:hidden');

// line 25
expect(screen.getByTestId('header-controls')).toHaveClass('phone:hidden');

// line 30
expect(screen.getByTestId('header-chokepoints')).toHaveClass('phone:hidden');

// line 45
expect(toggle).toHaveClass('roomy:hidden');

// lines 53-54, comment only
// happy-dom does not evaluate media queries, so both the `roomy:hidden`
// mobile cluster and the `phone:hidden` desktop row are always present
```

In `src/components/ui/StatusChip.test.tsx:43`:

```typescript
expect(screen.getByTestId('status-chip-mobile')).toHaveClass('desk:hidden');
```

In `src/components/ui/MobileBottomNav.test.tsx:28`:

```typescript
expect(screen.getByRole('navigation')).toHaveClass('roomy:hidden');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- --run src/components/ui/Header.test.tsx src/components/ui/StatusChip.test.tsx src/components/ui/MobileBottomNav.test.tsx`
Expected: FAIL — `Expected element to have class "phone:hidden"` and four similar failures. The elements still carry `max-lg:hidden` / `lg:hidden`.

- [ ] **Step 3: Migrate the simple touch-target sites**

These are mechanical `max-lg:` → `phone:` substitutions with no exception promotion. In each file, replace every occurrence:

- `src/components/ui/NotificationBell.tsx:107` — `max-lg:min-h-[44px] max-lg:min-w-[44px] max-lg:inline-flex max-lg:items-center max-lg:justify-center` becomes `phone:min-h-[44px] phone:min-w-[44px] phone:inline-flex phone:items-center phone:justify-center`
- `src/components/ui/TankerFilter.tsx:17` — `max-lg:min-h-[44px]` becomes `phone:min-h-[44px]`
- `src/components/ui/AnomalyFilter.tsx:18` — `max-lg:min-h-[44px]` becomes `phone:min-h-[44px]`
- `src/components/ui/TimeRangeSelector.tsx:29` — `max-lg:min-h-[44px]` becomes `phone:min-h-[44px]`
- `src/components/ui/ChokepointSelector.tsx:28` — `max-lg:grid max-lg:grid-cols-2` becomes `phone:grid phone:grid-cols-2`
- `src/components/ui/ChokepointSelector.tsx:34` — `max-lg:min-h-[44px]` becomes `phone:min-h-[44px]`
- `src/components/ui/ChokepointWidget.tsx:129` — `max-lg:flex-col` becomes `phone:flex-col`
- `src/components/ui/ChokepointWidget.tsx:133` — `max-lg:min-w-0 max-lg:max-w-none` becomes `phone:min-w-0 phone:max-w-none`
- `src/components/ui/ChokepointWidget.tsx:142` — `max-lg:min-h-[44px]` becomes `phone:min-h-[44px]`
- `src/components/ui/ChokepointWidget.tsx:162` — `max-lg:static max-lg:min-w-0 max-lg:border-x-0 max-lg:border-b-0 max-lg:border-t` becomes `phone:static phone:min-w-0 phone:border-x-0 phone:border-b-0 phone:border-t`
- `src/components/ui/ChokepointWidget.tsx:171` — `max-lg:min-h-[44px] max-lg:px-3` becomes `phone:min-h-[44px] phone:px-3`

Chokepoint widgets keep all four entries at tablet. Add tighter tablet padding by changing `ChokepointWidget.tsx:142` to:

```tsx
className="w-full flex items-center gap-2 px-3 py-1.5 phone:min-h-[44px] roomy:max-desk:py-1"
```

- [ ] **Step 4: Promote StatusChip to a compact-through-tablet split**

In `src/components/ui/StatusChip.tsx`, the compact chip must serve phone *and* tablet, and the three-indicator legend row becomes desktop-only. Change line 115:

```tsx
<div className="desk:hidden relative">
```

Line 123:

```tsx
className="desk:hidden min-h-[44px] min-w-[44px] px-2 inline-flex items-center gap-1.5"
```

Line 151:

```tsx
className="hidden desk:flex items-center gap-3 px-2 border-l border-amber-500/20"
```

This preserves the "exactly one visible status element" invariant at every width: compact below 1280, legend at or above it.

- [ ] **Step 5: Migrate MobileBottomNav to phone-only**

`src/components/ui/MobileBottomNav.tsx:27` — change `lg:hidden` to `roomy:hidden`. Also update the doc comment on line 4:

```
 * The header's nav row is hidden on phones; this replaces it and puts the
 * primary destinations in the thumb zone. Rendered from the (protected)
 * layout so every route in the group keeps navigation on a phone. Tablets
 * use the header's own nav row instead — see `roomy:hidden` below.
```

- [ ] **Step 6: Migrate Header and gate the two desktop-only controls**

In `src/components/ui/Header.tsx`, line 56:

```tsx
<div className="min-h-14 phone:min-h-11 flex items-center justify-between px-4 roomy:flex-wrap phone:h-auto phone:flex-col phone:items-stretch phone:gap-0">
```

Line 57:

```tsx
<div className="flex items-center phone:justify-between phone:min-h-11 phone:w-full">
```

Line 60:

```tsx
className="flex items-center gap-2 shrink-0 phone:min-w-[44px] phone:min-h-[44px]"
```

Line 69, with its comment:

```tsx
{/* Below 768 this is replaced by MobileBottomNav, which puts the same
    destinations in the thumb zone instead of the top 33%. Tablets keep
    this row — rotation must not change the navigation model. */}
<nav className="phone:hidden flex gap-1 ml-6">
```

Line 92 — the mobile cluster becomes phone-only, so tablet does not double up the bell:

```tsx
<div data-testid="header-mobile-controls" className="roomy:hidden flex items-center gap-3">
```

Line 99 — the search toggle inside that cluster:

```tsx
className="roomy:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400"
```

Lines 111-129 — the control row now serves tablet and desktop. `DataFreshness`, `TankerFilter`, and `AnomalyFilter` are wrapped so they appear only at `desk`; the filters live on the map at tablet:

```tsx
        {/* Control row from 768 up. On phones the filters live on the map and
            the search input moves behind the toggle above, so the row is dropped.
            Between 768 and 1279 the row carries search, alerts and status only:
            at 820px the full desktop set measured ~932px against an 820px
            viewport. DataFreshness duplicates StatusChip, and the filters have a
            map-anchored copy in MapFilterChips, so both are cut first. */}
        <div
          data-testid="header-controls"
          className="phone:hidden flex items-center gap-4"
        >
          {activeTab === 'dashboard' && (
            <SearchInput onSelectVessel={onSearchSelect} />
          )}
          <div className="flex items-center gap-4">
            {activeTab === 'dashboard' && (
              <div className="hidden desk:flex items-center gap-4">
                <DataFreshness />
                <TankerFilter />
                <AnomalyFilter />
              </div>
            )}
            <NotificationBell />
            <StatusChip />
          </div>
        </div>
```

Line 133 — the phone-only search drawer:

```tsx
<div data-testid="mobile-search" className="roomy:hidden px-4 py-2 border-t border-amber-500/10">
```

Line 141 — the chokepoint strip now shows at tablet:

```tsx
className="phone:hidden flex items-start px-4 py-2 border-t border-amber-500/10"
```

- [ ] **Step 7: Run the unit tests to verify they pass**

Run: `npm run test -- --run src/components/ui/Header.test.tsx src/components/ui/StatusChip.test.tsx src/components/ui/MobileBottomNav.test.tsx`
Expected: PASS, all three suites.

- [ ] **Step 8: Add the tablet viewports to the measurement harness**

In `scripts/verify-dashboard-layout.mjs`, add a tablet constant next to `VIEWPORTS` (line 21):

```javascript
const VIEWPORTS = [[390, 844], [360, 800]];
/** Tablet tier: iPad portrait and landscape. Both must produce the SAME
 *  structure — that equality is the rotation-continuity proof. */
const TABLETS = [[820, 1180], [1180, 820]];
/** Wide but short: a landscape phone must NOT be promoted to the tablet tier.
 *  This is the check that guards the 600px height clause in `roomy`. */
const PHONE_LANDSCAPE = [932, 430];
```

Then, immediately before the `// Desktop must be untouched by all of the above.` comment (line 241), insert:

```javascript
  // ── Tablet tier ────────────────────────────────────────────────────────
  // The defect this guards is not the cram, it is the discontinuity: before
  // this work, rotating one iPad swapped top nav for bottom nav and the side
  // rail for a bottom sheet. Both orientations are asserted identical.
  for (const [w, h] of TABLETS) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2000);
    const tag = `tablet@${w}x${h}`;

    const t = await page.evaluate(() => {
      const vis = (sel) =>
        [...document.querySelectorAll(sel)].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
      const de = document.documentElement;
      return {
        bottomNav: vis('nav[aria-label="Primary"]').length,
        headerNavLinks: vis('header nav a').length,
        chokepoints: vis('[data-testid="header-chokepoints"]').length,
        controls: vis('[data-testid="header-controls"]').length,
        sheet: vis('[data-testid="mobile-sheet"]').length,
        rail: vis('[data-testid="panel-rail"]').length,
        bells: vis('[aria-label*="Notification" i]').length,
        chips: vis('[data-testid^="status-chip"]').length,
        ovfX: de.scrollWidth - window.innerWidth,
      };
    });

    check(`${tag}: header nav present`, t.headerNavLinks === 4, `${t.headerNavLinks} visible nav links`);
    check(`${tag}: bottom nav absent`, t.bottomNav === 0, `${t.bottomNav} visible`);
    check(`${tag}: chokepoint strip present`, t.chokepoints === 1, `${t.chokepoints} visible`);
    check(`${tag}: control row present`, t.controls === 1, `${t.controls} visible`);
    check(`${tag}: mobile sheet absent`, t.sheet === 0, `${t.sheet} visible`);
    check(`${tag}: desktop rail absent`, t.rail === 0, `${t.rail} visible`);
    check(`${tag}: one notification bell`, t.bells === 1, `${t.bells} visible`);
    check(`${tag}: one status element`, t.chips === 1, `${t.chips} visible`);
    check(`${tag}: no horizontal overflow`, t.ovfX === 0, `${t.ovfX}px`);

    const blockedT = await blockedControls(page);
    check(`${tag}: controls hit-testable`, blockedT.length === 0, blockedT.length ? blockedT.join('; ') : 'none covered');

    await page.close();
  }

  // A 932x430 phone in landscape is wide enough to pass a width-only tablet
  // test. It must stay on the phone stack — this is the height clause's guard.
  {
    const [w, h] = PHONE_LANDSCAPE;
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2000);
    const p = await page.evaluate(() => {
      const vis = (sel) =>
        [...document.querySelectorAll(sel)].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
      return {
        bottomNav: vis('nav[aria-label="Primary"]').length,
        sheet: vis('[data-testid="mobile-sheet"]').length,
        headerNavLinks: vis('header nav a').length,
      };
    });
    check(`phone-landscape@${w}x${h}: bottom nav present`, p.bottomNav === 1, `${p.bottomNav} visible`);
    check(`phone-landscape@${w}x${h}: mobile sheet present`, p.sheet === 1, `${p.sheet} visible`);
    check(`phone-landscape@${w}x${h}: header nav absent`, p.headerNavLinks === 0, `${p.headerNavLinks} visible nav links`);
    await page.close();
  }
```

Note: `tablet: desktop rail absent` and `tablet: mobile sheet absent` will FAIL until Task 3. That is expected and is the failing test that drives Task 3 — see Step 10.

- [ ] **Step 9: Run the harness and confirm the expected pass/fail split**

Start the dev server in a separate terminal (`npm run dev`), then:

Run: `npm run verify:dashboard`
Expected:
- All 390×844, 360×800, and 1440×900 checks PASS — this is the proof the rename was a no-op at phone and desktop widths.
- All three `phone-landscape@932x430` checks PASS.
- Tablet checks PASS for: header nav present, bottom nav absent, chokepoint strip present, control row present, one bell, one status element, no horizontal overflow, controls hit-testable.
- Tablet checks FAIL for: `desktop rail absent` (the rail is still `max-lg:hidden`, so at 1180 it renders) and `mobile sheet absent` (the sheet is still `lg:hidden`, so at 820 it renders).

If any phone or desktop check fails, the rename was not a no-op — stop and fix before committing.

- [ ] **Step 10: Commit**

The two known tablet failures are carried into Task 3, which closes them.

```bash
git add src/components/ui/ scripts/verify-dashboard-layout.mjs
git commit -m "feat(header): give tablets the top nav and chokepoint strip

Migrates the header cluster to phone/roomy/desk. Both iPad orientations
now keep the header nav row and the chokepoint strip, so rotating no
longer swaps the navigation model.

Three controls are promoted to desk-only rather than roomy. At 820px the
full desktop control set measured ~932px against an 820px viewport,
which overflows. DataFreshness duplicates StatusChip, and TankerFilter
and AnomalyFilter already have a map-anchored copy in MapFilterChips, so
those three are cut at tablet. StatusChip's compact form now serves
phone and tablet; the three-indicator legend row is desk-only, keeping
exactly one visible status element at every width.

Harness gains 820x1180, 1180x820 and a 932x430 phone-landscape guard.
Two tablet checks fail deliberately -- the rail and sheet still key off
lg and are migrated in the dashboard commit."
```

---

## Task 3: Dashboard drawer at tablet

Extracts the panel stack, adds `IntelDrawer`, and gives the dashboard its three-state layout. Closes the two failures carried from Task 2.

**Files:**
- Create: `src/components/panels/RailPanels.tsx`
- Create: `src/components/dashboard/IntelDrawer.tsx`
- Create: `src/components/dashboard/IntelDrawer.test.tsx`
- Modify: `src/app/(protected)/dashboard/page.tsx:95-134`
- Modify: `src/components/map/MapFilterChips.tsx:9,19`
- Modify: `src/components/dashboard/MobileSheet.tsx:75`
- Modify: `src/components/panels/NewsPanel.tsx:65`
- Test: `src/app/(protected)/dashboard/page.test.tsx:38`
- Test: `src/components/map/MapFilterChips.test.tsx:16`
- Modify: `scripts/verify-dashboard-layout.mjs:171` (class-based selector must become a testid)

**Interfaces:**
- Consumes: `phone:` / `roomy:` / `desk:` from Task 1; the tablet harness block from Task 2
- Produces:
  - `RailPanels` — `() => JSX.Element`, no props. Reads `selectedVessel` from `useVesselStore` itself.
  - `IntelDrawer` — `({ children }: { children: ReactNode }) => JSX.Element`. Renders `data-testid="intel-drawer"` with `data-open="true" | "false"`, and an edge-tab button labelled `Open intel panel` / `Close intel panel`.
  - `data-testid="map-filter-chips"` on the chip container, replacing class-based selection in the harness.

- [ ] **Step 1: Write the failing test for RailPanels extraction**

Update `src/app/(protected)/dashboard/page.test.tsx:38`:

```typescript
expect(screen.getByTestId('panel-rail')).toHaveClass('max-desk:hidden');
```

Update `src/components/map/MapFilterChips.test.tsx:16`:

```typescript
expect(container.firstElementChild).toHaveClass('desk:hidden');
```

- [ ] **Step 2: Write the failing test for IntelDrawer**

Create `src/components/dashboard/IntelDrawer.test.tsx`:

```typescript
/**
 * IntelDrawer owns exactly one thing: whether it is open. Everything it shows
 * is passed in. These tests assert the toggle contract and nothing about the
 * panels, which are covered by their own suites.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntelDrawer } from './IntelDrawer';

describe('IntelDrawer', () => {
  it('starts closed so the map is unobstructed on arrival', () => {
    render(<IntelDrawer><p>panel body</p></IntelDrawer>);
    expect(screen.getByTestId('intel-drawer')).toHaveAttribute('data-open', 'false');
  });

  it('is hidden outside the tablet tier', () => {
    render(<IntelDrawer><p>panel body</p></IntelDrawer>);
    const root = screen.getByTestId('intel-drawer-root');
    expect(root).toHaveClass('phone:hidden');
    expect(root).toHaveClass('desk:hidden');
  });

  it('opens and closes from the edge tab', async () => {
    const user = userEvent.setup();
    render(<IntelDrawer><p>panel body</p></IntelDrawer>);
    const drawer = screen.getByTestId('intel-drawer');

    await user.click(screen.getByRole('button', { name: 'Open intel panel' }));
    expect(drawer).toHaveAttribute('data-open', 'true');

    await user.click(screen.getByRole('button', { name: 'Close intel panel' }));
    expect(drawer).toHaveAttribute('data-open', 'false');
  });

  it('renders its children', () => {
    render(<IntelDrawer><p>panel body</p></IntelDrawer>);
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test -- --run src/components/dashboard/IntelDrawer.test.tsx "src/app/(protected)/dashboard/page.test.tsx" src/components/map/MapFilterChips.test.tsx`
Expected: FAIL — `Failed to resolve import "./IntelDrawer"`, plus two class assertion failures.

- [ ] **Step 4: Create RailPanels**

Create `src/components/panels/RailPanels.tsx`:

```tsx
/**
 * The dashboard's intel panel stack.
 *
 * Rendered in two places that must never drift apart: the pinned rail at desk
 * widths, and IntelDrawer at tablet widths. Extracted so adding a panel means
 * one edit, not two.
 *
 * Holds no state. VesselPanel is conditional on the store's selection, which is
 * why this reads the store directly rather than taking it as a prop — both
 * consumers would otherwise have to duplicate the subscription.
 */
'use client';

import { ClusterPanel } from './ClusterPanel';
import { VesselPanel } from './VesselPanel';
import { WatchlistPanel } from './WatchlistPanel';
import { OilPricePanel } from './OilPricePanel';
import { NewsPanel } from './NewsPanel';
import { useVesselStore } from '@/stores/vessel';

export function RailPanels() {
  const selectedVessel = useVesselStore((state) => state.selectedVessel);

  return (
    <>
      <ClusterPanel />
      {selectedVessel && <VesselPanel />}
      <WatchlistPanel />
      <OilPricePanel />
      <NewsPanel />
    </>
  );
}
```

- [ ] **Step 5: Create IntelDrawer**

Create `src/components/dashboard/IntelDrawer.tsx`:

```tsx
/**
 * Tablet-only intel drawer.
 *
 * On a tablet the map is the product, so it runs full-bleed and the panels
 * become a deliberate act rather than a permanent 320px tax. The drawer
 * overlays the map — it never reflows it, so opening the drawer must not
 * change the map's width.
 *
 * Chosen over a bottom sheet on measured grounds: landscape iPad is 820px
 * tall, and a sheet spends the scarcer axis. This layout is identical in both
 * orientations, which is the point — rotation must not restructure the page.
 *
 * Owns exactly one piece of state: whether it is open.
 */
'use client';

import { useState, type ReactNode } from 'react';
import { ChevronLeft, X } from 'lucide-react';

export function IntelDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div data-testid="intel-drawer-root" className="phone:hidden desk:hidden">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open intel panel"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-11 h-24 flex items-center justify-center bg-black border border-r-0 border-amber-500/20 text-amber-500 hover:bg-amber-500/10 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
      )}

      <aside
        data-testid="intel-drawer"
        data-open={open}
        aria-hidden={!open}
        className={`absolute inset-y-0 right-0 z-20 w-[340px] flex flex-col bg-black border-l border-amber-500 shadow-[-14px_0_34px_rgba(0,0,0,0.85)] transition-transform duration-200 motion-reduce:transition-none ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="shrink-0 flex items-center justify-between px-3 h-11 border-b border-amber-500/20">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-500">Intel</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close intel panel"
            className="min-w-[44px] min-h-[44px] -mr-3 inline-flex items-center justify-center text-amber-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-amber-500/10">
          {children}
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 6: Rewire the dashboard to its three-state layout**

In `src/app/(protected)/dashboard/page.tsx`, replace lines 95-134 (from `<main` through the closing `)}` of the vessel sheet) with:

```tsx
      <main className="flex-1 grid grid-cols-[1fr_320px] max-desk:grid-cols-1 overflow-hidden phone:flex phone:flex-col">
        <ErrorBoundary>
          {/* Phone: the map fills everything between the header and the sheet.
              Tablet: the map is full-bleed and IntelDrawer overlays it, which is
              why the drawer lives inside this relative box rather than beside it. */}
          <div className="relative overflow-hidden phone:flex-1 phone:min-h-0">
            <VesselMap />
            <MapFilterChips />
            <IntelDrawer>
              <RailPanels />
            </IntelDrawer>
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div
            data-testid="panel-rail"
            className="max-desk:hidden flex flex-col overflow-y-auto bg-black border-l border-amber-500/20 divide-y divide-amber-500/10"
          >
            <RailPanels />
          </div>
        </ErrorBoundary>
      </main>

      <MobileSheet
        chokepoints={chokepoints}
        collapsed={!!selectedVessel}
        panels={{ prices: <OilPricePanel />, intel: <NewsPanel /> }}
      />

      {/* Sits above the bottom nav. At bottom-0 the nav would cover its
          controls, and the two would fight for the same edge. */}
      {selectedVessel && (
        <div
          data-testid="vessel-sheet"
          className="hidden phone:block fixed inset-x-0 bottom-[var(--straits-nav-h)] z-40 max-h-[60dvh] overflow-y-auto bg-black border-t border-amber-500/40 shadow-[0_-8px_24px_rgba(0,0,0,0.8)]"
        >
          <VesselPanel />
        </div>
      )}
```

Update the imports at the top of the file. `ClusterPanel` and `WatchlistPanel` are now only reached through `RailPanels`, so remove them; `VesselPanel`, `OilPricePanel` and `NewsPanel` are still used directly by the phone sheets:

```tsx
import { VesselMap } from '@/components/map/VesselMap';
import { VesselPanel } from '@/components/panels/VesselPanel';
import { OilPricePanel } from '@/components/panels/OilPricePanel';
import { NewsPanel } from '@/components/panels/NewsPanel';
import { RailPanels } from '@/components/panels/RailPanels';
import { Header } from '@/components/ui/Header';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useVesselStore } from '@/stores/vessel';
import { MobileSheet, type Chokepoint } from '@/components/dashboard/MobileSheet';
import { IntelDrawer } from '@/components/dashboard/IntelDrawer';
import { MapFilterChips } from '@/components/map/MapFilterChips';
```

- [ ] **Step 7: Migrate MapFilterChips and MobileSheet**

`src/components/map/MapFilterChips.tsx` — the chips stay on the map through tablet, because the header drops the filters below 1280. Replace lines 8-10 and 19:

```tsx
 * Phone and tablet only — the desk header keeps its own copy. Both instances
 * are in the DOM but `desk:hidden` / `hidden desk:flex` compute to
 * display:none, so exactly one is ever in the accessibility tree.
 */
'use client';

import { TankerFilter } from '@/components/ui/TankerFilter';
import { AnomalyFilter } from '@/components/ui/AnomalyFilter';

export function MapFilterChips() {
  return (
    <div
      data-testid="map-filter-chips"
      className="desk:hidden absolute top-3 left-3 z-10 flex gap-2"
    >
      <TankerFilter />
      <AnomalyFilter />
    </div>
  );
}
```

`src/components/dashboard/MobileSheet.tsx:75` — change the leading `lg:hidden` to `roomy:hidden`:

```tsx
      className={`roomy:hidden fixed inset-x-0 bottom-[var(--straits-nav-h)] z-30 flex flex-col bg-black border-t border-amber-500 shadow-[0_-8px_24px_rgba(0,0,0,0.85)] transition-[height] duration-200 ${HEIGHT[detent]}`}
```

`src/components/panels/NewsPanel.tsx:65` — `max-lg:min-h-[44px]` becomes `phone:min-h-[44px]`.

- [ ] **Step 8: Fix the harness's class-based selector**

`scripts/verify-dashboard-layout.mjs:171` selects the chips by their literal Tailwind class, which this task just renamed. Replace line 171:

```javascript
        const [chip] = await boxes(page, '[data-testid="map-filter-chips"]');
```

Delete the now-pointless `.then()` chain on that line — the original was `boxes(page, '[aria-label="Search vessels"]').then(() => boxes(page, '.lg\\:hidden.absolute'))`, whose first call was discarded.

- [ ] **Step 9: Add drawer assertions to the tablet block**

In `scripts/verify-dashboard-layout.mjs`, inside the `for (const [w, h] of TABLETS)` loop added in Task 2, immediately after the `controls hit-testable` check:

```javascript
    // The drawer overlays the map; it must never reflow it. A drawer that
    // shrinks the map on open is the failure mode this whole option was
    // chosen to avoid.
    const [mapClosed] = await boxes(page, '.maplibregl-map');
    check(`${tag}: map full-bleed with drawer closed`, mapClosed && mapClosed.w === w,
      `map ${mapClosed ? mapClosed.w : 'MISSING'}px vs viewport ${w}px`);

    await page.click('[aria-label="Open intel panel"]');
    await page.waitForTimeout(320);
    const [mapOpen] = await boxes(page, '.maplibregl-map');
    const [drawerBox] = await boxes(page, '[data-testid="intel-drawer"]');
    check(`${tag}: drawer does not reflow the map`, mapOpen && mapOpen.w === mapClosed.w,
      `map ${mapOpen ? mapOpen.w : 'MISSING'}px open vs ${mapClosed.w}px closed`);
    check(`${tag}: drawer sits inside the map box`, drawerBox && drawerBox.x + drawerBox.w <= w + 1,
      drawerBox ? `drawer right edge ${drawerBox.x + drawerBox.w}, viewport ${w}` : 'drawer MISSING');

    const blockedDrawer = await blockedControls(page, '[data-testid="intel-drawer"]');
    check(`${tag}: drawer controls hit-testable`, blockedDrawer.length === 0,
      blockedDrawer.length ? blockedDrawer.join('; ') : 'none covered');

    await page.click('[aria-label="Close intel panel"]');
    await page.waitForTimeout(320);
    const reopenTab = await page.$('[aria-label="Open intel panel"]');
    check(`${tag}: edge tab returns after close`, reopenTab !== null, `tab ${reopenTab ? 'present' : 'MISSING'}`);
```

- [ ] **Step 10: Run the unit tests**

Run: `npm run test -- --run`
Expected: PASS, all suites, including the four new `IntelDrawer` tests.

- [ ] **Step 11: Run the harness**

Run: `npm run verify:dashboard`
Expected: **every check passes**, including the two carried failures from Task 2 (`desktop rail absent` at both tablet viewports, `mobile sheet absent` at both) and all six new drawer checks. Phone and desktop checks unchanged.

- [ ] **Step 12: Commit**

```bash
git add src/components/panels/RailPanels.tsx src/components/dashboard/IntelDrawer.tsx src/components/dashboard/IntelDrawer.test.tsx "src/app/(protected)/dashboard/page.tsx" "src/app/(protected)/dashboard/page.test.tsx" src/components/map/MapFilterChips.tsx src/components/map/MapFilterChips.test.tsx src/components/dashboard/MobileSheet.tsx src/components/panels/NewsPanel.tsx scripts/verify-dashboard-layout.mjs
git commit -m "feat(dashboard): give tablets a full-bleed map and an intel drawer

On a tablet the map is the product, so it now runs edge to edge and the
panels become a deliberate act rather than a permanent 320px tax. The
drawer overlays the map and never reflows it -- asserted at both
orientations.

Chosen over a bottom sheet on measured grounds: landscape iPad is 820px
tall and a sheet spends the scarcer axis. The drawer is identical in
both orientations, which is the rotation-continuity fix.

Extracts RailPanels so the pinned desk rail and the tablet drawer cannot
drift apart. MapFilterChips now covers phone and tablet, since the
header drops the filters below 1280.

Also fixes verify-dashboard-layout.mjs:171, which selected the chips by
their literal Tailwind class and would have gone quietly stale."
```

---

## Task 4: Fleet at tablet

**Files:**
- Modify: `src/components/fleet/FleetTabs.tsx:58,66-68`
- Modify: `src/components/fleet/AnomalyTable.tsx:84,96,127,130,149`
- Modify: `src/components/fleet/SanctionedVessels.tsx:68,166`
- Modify: `src/components/fleet/SortControls.tsx:83`
- Modify: `src/components/fleet/TablePager.tsx:33`
- Modify: `src/app/(protected)/fleet/page.tsx:125,140,146`
- Test: `src/components/fleet/FleetTabs.test.tsx`
- Modify: `scripts/verify-fleet-layout.mjs`

**Interfaces:**
- Consumes: `phone:` / `roomy:` / `desk:` from Task 1
- Produces: `data-testid="fleet-tabs"` laid out as `grid-cols-2` at phone, `grid-cols-4` at roomy, `flex flex-wrap` at desk

- [ ] **Step 1: Write the failing test**

Add to `src/components/fleet/FleetTabs.test.tsx`:

```typescript
it('uses a four-column grid at tablet so eight tabs do not orphan one', () => {
  render(<FleetTabs tabs={TABS} activeId={TABS[0].id} onChange={() => {}} />);
  const tablist = screen.getByTestId('fleet-tabs');
  // Phone: two columns. Tablet: four, which divides eight tabs into two clean
  // rows. Desk: the original flex-wrap strip.
  expect(tablist).toHaveClass('grid-cols-2');
  expect(tablist).toHaveClass('roomy:grid-cols-4');
  expect(tablist).toHaveClass('desk:flex');
});
```

If `TABS` is not already a fixture in that file, define it above the test with eight entries matching the production categories:

```typescript
const TABS = [
  { id: 'sanctioned', label: 'Sanctioned', count: 122, accent: 'red' as const },
  { id: 'loitering', label: 'Loitering', count: 492 },
  { id: 'speed_anomaly', label: 'Speed Anomaly', count: 401 },
  { id: 'going_dark', label: 'Going Dark', count: 353 },
  { id: 'sts_transfer', label: 'STS Transfer', count: 138 },
  { id: 'route_deviation', label: 'Route Deviation', count: 132 },
  { id: 'repeat_going_dark', label: 'Repeat Going Dark', count: 65 },
  { id: 'spoofed_position', label: 'Spoofed Position', count: 32 },
];
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- --run src/components/fleet/FleetTabs.test.tsx`
Expected: FAIL — `Expected element to have class "roomy:grid-cols-4"`.

- [ ] **Step 3: Give FleetTabs a three-tier layout**

`src/components/fleet/FleetTabs.tsx` line 58:

```tsx
      className="grid grid-cols-2 roomy:grid-cols-4 desk:flex desk:flex-wrap border border-amber-500/20 bg-gray-900/40"
```

Lines 65-68, the `base` string:

```tsx
        const base =
          'flex items-center justify-between gap-2 min-h-[44px] desk:min-h-0 px-3 py-2 ' +
          'text-xs font-mono uppercase tracking-wider border-r border-b desk:border-b-0 ' +
          'border-amber-500/10 transition-colors text-left';
```

Update the file's doc comment, lines 4-7:

```
 * One tablist, three layouts: a 2-column grid on phones, where eight tabs laid
 * end to end (~760px) cannot fit a 390px screen; a 4-column grid at tablet,
 * which divides eight tabs into two clean rows rather than the 7+1 orphan that
 * flex-wrap produces at 1180; and the horizontal strip at desk widths.
 * Rendering a single DOM tree with responsive classes keeps exactly one
 * aria-selected node in the document.
```

- [ ] **Step 4: Migrate the remaining fleet files**

Mechanical substitutions, no exception promotions:

- `src/components/fleet/AnomalyTable.tsx:84,96,130,149` — `max-lg:hidden` becomes `phone:hidden`
- `src/components/fleet/AnomalyTable.tsx:127` — `max-lg:py-3.5` becomes `phone:py-3.5`
- `src/components/fleet/SanctionedVessels.tsx:68` — `hidden lg:block` becomes `hidden roomy:block`
- `src/components/fleet/SanctionedVessels.tsx:166` — `lg:hidden` becomes `roomy:hidden`
- `src/components/fleet/SortControls.tsx:83` — `lg:hidden` becomes `roomy:hidden`
- `src/components/fleet/TablePager.tsx:33` — `lg:min-h-0` becomes `roomy:min-h-0`
- `src/app/(protected)/fleet/page.tsx:125` — `max-lg:p-3 max-lg:pb-[calc(var(--straits-nav-h)+1rem)]` becomes `phone:p-3 phone:pb-[calc(var(--straits-nav-h)+1rem)]`
- `src/app/(protected)/fleet/page.tsx:140,146` — `max-lg:min-h-[44px]` becomes `phone:min-h-[44px]`

The IMO and flag columns return at tablet, which is intended — tablet has the width for them.

- [ ] **Step 5: Run the unit tests to verify they pass**

Run: `npm run test -- --run src/components/fleet/`
Expected: PASS, all fleet suites.

- [ ] **Step 6: Add the fleet tablet check to the harness**

In `scripts/verify-fleet-layout.mjs`, after the existing viewport loop and before the summary, add:

```javascript
  // The reported screenshot showed SPOOFED POSITION orphaned on its own row at
  // 1180: flex-wrap fits seven tabs and drops the eighth. A 4-column grid
  // divides eight tabs into two rows of four at both tablet orientations.
  for (const [w, h] of [[820, 1180], [1180, 820]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    await page.goto(BASE + '/fleet', { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForSelector('[data-testid="fleet-tabs"] [role="tab"]', { timeout: 30000 });
    await page.waitForTimeout(1200);
    const tag = `tablet@${w}x${h}`;

    const rows = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('[data-testid="fleet-tabs"] [role="tab"]')]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      const byTop = new Map();
      for (const r of tabs) {
        const k = Math.round(r.top);
        byTop.set(k, (byTop.get(k) ?? 0) + 1);
      }
      return [...byTop.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
    });

    check(`${tag}: fleet tabs in exactly two rows`, rows.length === 2, `${rows.length} rows: [${rows}]`);
    check(`${tag}: no orphaned tab row`, rows.every((n) => n >= 4), `row counts [${rows}] (each must be >= 4)`);

    await page.close();
  }
```

If `verify-fleet-layout.mjs` does not already expose a `browser`, `check()` and `BASE` in that scope, mirror the structure used in `verify-dashboard-layout.mjs:103-108`.

- [ ] **Step 7: Run both harnesses**

Run: `npm run verify:fleet && npm run verify:dashboard`
Expected: all checks pass in both, including the four new fleet tab-row checks. Task 3's dashboard checks stay green.

- [ ] **Step 8: Commit**

```bash
git add src/components/fleet/ "src/app/(protected)/fleet/page.tsx" scripts/verify-fleet-layout.mjs
git commit -m "feat(fleet): stop the tab strip orphaning a row at tablet

At 1180 flex-wrap fits seven of the eight category tabs and drops
SPOOFED POSITION onto a row of its own. Tablet now uses a 4-column grid,
which divides eight tabs into two clean rows at both orientations; desk
keeps the horizontal strip.

Migrates the rest of the fleet surface to phone/roomy. The IMO and flag
columns return at tablet, which is correct -- tablet has the width."
```

---

## Task 5: Analytics and About at tablet

Pure migration. No layout redesign, no exception promotions.

**Files:**
- Modify: `src/app/(protected)/analytics/page.tsx:57,120,135,140,147,154,155,174,181,182,194,201,202,230,253`
- Modify: `src/app/(protected)/about/page.tsx:24,134,177`

**Interfaces:**
- Consumes: `phone:` / `roomy:` from Task 1
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Migrate analytics**

In `src/app/(protected)/analytics/page.tsx`:

- Line 57, comment only: `// Filter panel: collapsed by default on phones; always shown from tablet up via CSS (roomy:block).`
- Line 120 — `max-lg:p-3 max-lg:pb-[calc(var(--straits-nav-h)+1rem)]` becomes `phone:p-3 phone:pb-[calc(var(--straits-nav-h)+1rem)]`
- Line 135 — `lg:hidden` becomes `roomy:hidden`
- Line 140 — `lg:flex` becomes `roomy:flex`, and `max-lg:mt-2` becomes `phone:mt-2`
- Lines 147, 174, 194 — `max-lg:gap-2` becomes `phone:gap-2`
- Lines 154, 155, 181, 182, 201, 202 — `max-lg:min-h-[44px] max-lg:px-3` becomes `phone:min-h-[44px] phone:px-3`
- Lines 230, 253 — `lg:space-y-6` becomes `roomy:space-y-6`

- [ ] **Step 2: Migrate about**

In `src/app/(protected)/about/page.tsx`:

- Line 24 — `max-lg:p-3 max-lg:pb-[calc(var(--straits-nav-h)+1rem)]` becomes `phone:p-3 phone:pb-[calc(var(--straits-nav-h)+1rem)]`
- Line 134 — `hidden lg:table` becomes `hidden roomy:table`
- Line 177 — `lg:hidden` becomes `roomy:hidden`

- [ ] **Step 3: Confirm no `lg:` remains outside the harness**

Run:

```bash
grep -rn 'max-lg:\|[^a-z-]lg:' src --include='*.tsx' --include='*.css'
```

Expected: **no output.** Every site is migrated. If anything prints, migrate it under the same rule (`max-lg:` → `phone:`, `lg:` → `roomy:`) before continuing.

- [ ] **Step 4: Run the full test suite and both harnesses**

Run: `npm run test -- --run && npm run lint && npm run verify:dashboard && npm run verify:fleet`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/analytics/page.tsx" "src/app/(protected)/about/page.tsx"
git commit -m "feat(pages): migrate analytics and about to the tablet tier

Completes the phone/roomy migration. The analytics filter panel is now
open by default from 768 up rather than 1024, and the about page's
comparison table returns at tablet instead of falling back to the
stacked phone list. No lg: sites remain in src/."
```

---

## Task 6: Search affordances

Independent of Tasks 1–5 in behaviour, but written against the migrated tree. All six states produce visible output, and the dead click is closed.

**Files:**
- Modify: `src/components/ui/SearchInput.tsx` (substantial rewrite of the render body)
- Modify: `src/components/ui/Header.tsx:21-28` (the duplicate `SearchResult` interface)
- Modify: `src/app/(protected)/dashboard/page.tsx:54-70` (`handleSearchSelect`)
- Create: `src/components/ui/SearchInput.test.tsx`

**Interfaces:**
- Consumes: `phone:` / `roomy:` from Task 1; `useVesselStore`'s `setSelectedVessel` and `setMapCenter`
- Produces: `SearchResult` now carries `shipType: number`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/SearchInput.test.tsx`:

```typescript
/**
 * Search had six states and rendered visible output in one of them. These tests
 * pin all six, plus the two data defects: a null flag used to leave a dangling
 * pipe, and a vessel with no position fix used to be a silent dead click.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput } from './SearchInput';

const PLACED = {
  imo: '9299862', mmsi: '667002199', name: 'TENDUA',
  flag: null, shipType: 80, latitude: 31.5418, longitude: 32.3459,
};
const UNPLACED = {
  imo: '9354521', mmsi: '412330991', name: 'ANHONA',
  flag: null, shipType: 80, latitude: null, longitude: null,
};

function mockSearch(results: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results }),
  }));
}

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('SearchInput states', () => {
  it('names the three accepted key types when focused and empty', async () => {
    const user = userEvent.setup();
    mockSearch([]);
    render(<SearchInput />);
    await user.click(screen.getByRole('textbox'));
    expect(screen.getByText(/vessel name, IMO number, or MMSI/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TENDUA' })).toBeInTheDocument();
  });

  it('states the exact remaining gap below the two-character floor', async () => {
    const user = userEvent.setup();
    mockSearch([]);
    render(<SearchInput />);
    await user.type(screen.getByRole('textbox'), 'T');
    expect(screen.getByText(/1 more character/i)).toBeInTheDocument();
  });

  it('shows a busy state while the request is in flight', async () => {
    const user = userEvent.setup();
    mockSearch([PLACED]);
    render(<SearchInput />);
    await user.type(screen.getByRole('textbox'), 'TE');
    expect(await screen.findByTestId('search-loading')).toBeInTheDocument();
  });

  it('omits the separator entirely when flag is null', async () => {
    const user = userEvent.setup();
    mockSearch([PLACED]);
    render(<SearchInput />);
    await user.type(screen.getByRole('textbox'), 'TENDUA');
    const row = await screen.findByRole('option', { name: /TENDUA/ });
    expect(row.textContent).toContain('IMO 9299862');
    expect(row.textContent).not.toMatch(/\|\s*$/);
    expect(row.textContent).not.toMatch(/·\s*$/);
  });

  it('echoes the query when nothing matches', async () => {
    const user = userEvent.setup();
    mockSearch([]);
    render(<SearchInput />);
    await user.type(screen.getByRole('textbox'), 'ZZZZ');
    expect(await screen.findByText(/No vessel matches/i)).toBeInTheDocument();
    expect(screen.getByText(/ZZZZ/)).toBeInTheDocument();
  });

  it('marks a vessel with no position fix', async () => {
    const user = userEvent.setup();
    mockSearch([UNPLACED]);
    render(<SearchInput />);
    await user.type(screen.getByRole('textbox'), 'ANHONA');
    const row = await screen.findByRole('option', { name: /ANHONA/ });
    expect(row.textContent).toMatch(/NO FIX/i);
  });

  it('reports the result count', async () => {
    const user = userEvent.setup();
    mockSearch([PLACED, UNPLACED]);
    render(<SearchInput />);
    await user.type(screen.getByRole('textbox'), 'TE');
    expect(await screen.findByText('2 vessels')).toBeInTheDocument();
  });

  it('hands the full result to the parent, position or not', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockSearch([UNPLACED]);
    render(<SearchInput onSelectVessel={onSelect} />);
    await user.type(screen.getByRole('textbox'), 'ANHONA');
    await user.click(await screen.findByRole('option', { name: /ANHONA/ }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ imo: '9354521', latitude: null }),
    ));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- --run src/components/ui/SearchInput.test.tsx`
Expected: FAIL on all eight — the empty state, min-length message, loading indicator, count header, and `NO FIX` chip do not exist yet.

- [ ] **Step 3: Widen the SearchResult interface in both declarations**

The interface is declared twice, identically. In `src/components/ui/SearchInput.tsx:11-18` **and** `src/components/ui/Header.tsx:21-28`, add `shipType`:

```typescript
interface SearchResult {
  imo: string;
  mmsi: string;
  name: string;
  flag: string | null;
  shipType: number;
  latitude: number | null;
  longitude: number | null;
}
```

`flag` also widens to `string | null` — the API has always returned null for most of the fleet, and the old `string` type was simply wrong.

- [ ] **Step 4: Rewrite the SearchInput render body**

In `src/components/ui/SearchInput.tsx`, replace the entire `return (...)` block (lines 108-163) with:

```tsx
  const trimmed = query.trim();
  const showEmptyState = focused && trimmed.length === 0;
  const showMinLength = trimmed.length === 1;

  return (
    <div className="relative phone:w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setFocused(true); setIsOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Name, IMO, or MMSI..."
          aria-label="Search vessels by name, IMO, or MMSI"
          className="w-56 phone:w-full pl-9 pr-8 py-1.5 phone:min-h-[44px] bg-black border border-gray-700 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
        />
        {loading && (
          <span
            data-testid="search-loading"
            aria-hidden="true"
            className="absolute right-8 top-1/2 -translate-y-1/2 w-3 h-3 border border-gray-700 border-t-amber-500 rounded-full animate-spin motion-reduce:animate-none"
          />
        )}
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 w-80 phone:w-full bg-black border border-amber-500/20 shadow-lg z-50 max-h-72 overflow-y-auto"
        >
          {/* Empty + focused. Previously rendered nothing, so there was no way
              to learn that IMO and MMSI are accepted at all. */}
          {showEmptyState && (
            <div className="p-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-amber-500 mb-2">
                Search the fleet
              </p>
              <p className="text-xs text-gray-400 mb-3">
                By vessel name, IMO number, or MMSI. Two characters minimum.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['TENDUA', '9299862', 'front'].map((example) => (
                  <button
                    key={example}
                    type="button"
                    // mousedown, not click: the input's blur would close this
                    // panel before a click ever landed.
                    onMouseDown={(e) => { e.preventDefault(); setQuery(example); }}
                    className="px-2 py-1 phone:min-h-[44px] text-xs font-mono text-amber-500 border border-gray-700 hover:border-amber-500 hover:bg-amber-500/10 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Below the API's two-character floor. Names the exact gap. */}
          {showMinLength && !loading && (
            <p className="p-3 text-xs text-gray-400">
              <span className="text-white">1 more character</span> — search needs at least two.
            </p>
          )}

          {loading && (
            <div aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="px-3 py-2 border-b border-gray-800 last:border-b-0">
                  <span className="block h-2.5 bg-gray-800 animate-pulse motion-reduce:animate-none" />
                  <span className="block mt-1.5 h-2 w-3/5 bg-gray-800 animate-pulse motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          )}

          {!loading && trimmed.length >= 2 && results.length > 0 && (
            <>
              <p className="sticky top-0 bg-black flex items-baseline justify-between px-3 py-1.5 border-b border-amber-500/10 text-[10px] font-mono uppercase tracking-widest text-amber-500">
                <span>{results.length === 1 ? '1 vessel' : `${results.length} vessels`}</span>
                <span className="text-gray-500 tracking-normal normal-case">↑↓ move · ↵ open</span>
              </p>
              {results.map((result, i) => (
                <button
                  key={result.imo}
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => handleSelect(result)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-900 transition-colors border-b border-gray-800 last:border-b-0 ${
                    i === activeIndex ? 'bg-gray-900' : ''
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium">{result.name}</span>
                    {/* A vessel the AIS feed has not placed is selectable, but
                        the user must know before they tap that the map will not
                        move. */}
                    <span
                      className={`text-[9px] font-mono uppercase tracking-wider px-1 border ${
                        result.latitude === null
                          ? 'text-gray-400 border-gray-600'
                          : 'text-green-500 border-green-500/50'
                      }`}
                    >
                      {result.latitude === null ? 'No fix' : 'Tracking'}
                    </span>
                  </span>
                  {/* Built by joining only the fields that exist. The old
                      template interpolated `flag` unconditionally, and flag is
                      null for most of the fleet, so nearly every row ended in a
                      dangling pipe. */}
                  <span className="block text-xs text-gray-400 mt-0.5">
                    {[`IMO ${result.imo}`, `MMSI ${result.mmsi}`, result.flag]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              ))}
            </>
          )}

          {!loading && trimmed.length >= 2 && results.length === 0 && (
            <p className="p-3 text-xs text-gray-400">
              No vessel matches <span className="text-white">{trimmed}</span>.
              <br />
              IMO numbers always resolve exactly — try one of those.
            </p>
          )}
        </div>
      )}
    </div>
  );
```

Add the `focused` state alongside the existing hooks (near line 29):

```typescript
  const [focused, setFocused] = useState(false);
```

Update `clearSearch` (lines 101-106) to keep the panel open, so clearing returns the user to the empty state rather than to nothing:

```typescript
  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(true);
    inputRef.current?.focus();
  };
```

- [ ] **Step 5: Close the dead click**

In `src/app/(protected)/dashboard/page.tsx`, replace `handleSearchSelect` (lines 54-70):

```tsx
  // Handle vessel selection from search.
  //
  // The map-fly path is only available for vessels the AIS feed has actually
  // placed. Before this, the null branch simply fell through and the click did
  // nothing at all — the dropdown closed and the user got no signal. Vessels
  // without a fix now open their dossier instead.
  //
  // `position: null` is already part of VesselWithPosition, and VesselPanel
  // reads every position field through optional chaining with an 'N/A'
  // fallback, so this needs no cast and no panel change.
  const handleSearchSelect = useCallback((result: SearchResult) => {
    if (result.latitude !== null && result.longitude !== null) {
      setMapCenter({ lat: result.latitude, lon: result.longitude, zoom: 10 });
      setTargetVesselImo(result.imo);
      return;
    }

    setSelectedVessel({
      imo: result.imo,
      mmsi: result.mmsi,
      name: result.name,
      flag: result.flag ?? '',
      shipType: result.shipType,
      destination: null,
      lastSeen: new Date(),
      position: null,
    });
  }, [setMapCenter, setTargetVesselImo, setSelectedVessel]);
```

Add `setSelectedVessel` to the store subscriptions near line 22:

```tsx
  const setSelectedVessel = useVesselStore((state) => state.setSelectedVessel);
```

Add the shared `SearchResult` type near the top of the file, replacing the inline parameter type:

```tsx
interface SearchResult {
  imo: string;
  mmsi: string;
  name: string;
  flag: string | null;
  shipType: number;
  latitude: number | null;
  longitude: number | null;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test -- --run src/components/ui/SearchInput.test.tsx`
Expected: PASS, all eight.

- [ ] **Step 7: Verify the dead click against real data**

With `npm run dev` running, confirm the API still returns an unplaced vessel to exercise:

```bash
curl -s 'http://localhost:3000/api/vessels/search?q=an' | head -c 400
```

Then in the browser at `http://localhost:3000/dashboard`, type a query matching a vessel whose `latitude` is `null`, select it, and confirm the vessel panel opens showing `N/A` for speed, heading and course rather than nothing happening.

- [ ] **Step 8: Run everything**

Run: `npm run test -- --run && npm run lint && npm run build && npm run verify:dashboard && npm run verify:fleet`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/SearchInput.tsx src/components/ui/SearchInput.test.tsx src/components/ui/Header.tsx "src/app/(protected)/dashboard/page.tsx"
git commit -m "fix(search): make every state visible, and close the dead click

Search rendered visible output in one of its six states. Focusing the
empty field, typing one character, and waiting for the request all
produced nothing, so there was no way to learn that IMO and MMSI are
accepted or whether anything was happening.

Selecting a vessel the AIS feed had not placed closed the dropdown and
did nothing else -- the lat/lon guard in handleSearchSelect had no else
branch. Those vessels now open their dossier, and are marked NO FIX in
the results so the outcome is predictable before the tap.

Result rows are built by joining only the fields that exist. flag is
null for most of the fleet, and the old template interpolated it
unconditionally, so nearly every row ended in a dangling pipe. Also
corrects the SearchResult flag type to string | null, which is what the
API has always returned, and adds the shipType the API already sends."
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Search: six states | 6 |
| Search: dangling pipe | 6 |
| Search: dead click + type verification | 6 |
| Search: `SearchResult` gains `shipType` in both declarations | 6 |
| Breakpoint mechanism (`phone`/`roomy`/`desk`) | 1 |
| Exception list: pinned rail | 3 |
| Exception list: `DataFreshness` | 2 |
| Exception list: AIS/PRICES/NEWS legend (`StatusChip` desktop row) | 2 |
| Exception list: `FleetTabs` flex-wrap | 4 |
| Dashboard Option A drawer + `RailPanels` | 3 |
| Fleet 4-column tab grid | 4 |
| `MobileBottomNav` → `roomy:hidden` | 2 |
| Analytics + About | 5 |
| Harness: 820×1180, 1180×820, 932×430 | 2 |
| Harness: drawer does not reflow the map | 3 |
| Harness: fleet two rows, none under four | 4 |
| Regression gate 390/360/1440 green throughout | every task |
| `SearchInput.test.tsx` unit coverage | 6 |

No gaps.

**Additions beyond the spec, flagged for the reviewer:**
- `TankerFilter` + `AnomalyFilter` and `MapFilterChips` promoted to `desk:` — measured necessity at 820px (~932px of controls in an 820px viewport). Documented in Global Constraints.
- `scripts/verify-dashboard-layout.mjs:171` selects the filter chips by their literal Tailwind class `.lg\:hidden.absolute`, which the migration renames. Task 3 Step 8 replaces it with `data-testid="map-filter-chips"`. Without this the check would fail confusingly mid-migration.
- Six existing unit tests assert literal class names (`Header.test.tsx:20,25,30,45`, `StatusChip.test.tsx:43`, `MobileBottomNav.test.tsx:28`, `MapFilterChips.test.tsx:16`, `dashboard/page.test.tsx:38`). Each is updated in the task that renames its subject.

**Placeholder scan:** none. Every code step carries complete code; every command carries expected output.

**Type consistency:** `SearchResult` is declared with `shipType: number` and `flag: string | null` in all three locations (`SearchInput.tsx`, `Header.tsx`, `dashboard/page.tsx`) as of Task 6. `IntelDrawer` takes `{ children: ReactNode }` in its definition (Task 3 Step 5), its test (Step 2), and its call site (Step 6). `RailPanels` takes no props in all three places. `data-testid` values are consistent: `intel-drawer`, `intel-drawer-root`, `map-filter-chips`, `panel-rail`, `fleet-tabs`, `mobile-sheet`.

**Sequencing note:** Task 2 deliberately leaves two harness checks failing, closed by Task 3. This is the one place where a commit is not fully green — it is the failing test that drives the next task, and it is called out in both Task 2 Step 9 and its commit message.
