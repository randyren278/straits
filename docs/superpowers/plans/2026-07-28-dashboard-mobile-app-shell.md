# Dashboard Mobile App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut `/dashboard` mobile chrome from 275px (33% of a 390×844 viewport) to ≤110px and its scroll from 3.11 screens to 1.00, by moving navigation to a bottom bar and every panel into a bottom sheet.

**Architecture:** Mobile stops mirroring desktop. A fixed `MobileBottomNav` renders from the shared `(protected)` layout so all four routes keep navigation. The dashboard's panels move out of a stacked scroll column into a three-detent `MobileSheet`. The header collapses to a single 44px row. Everything is gated behind `max-lg:` / `lg:hidden`; desktop DOM and geometry are unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS v4 (config-free, `@theme` in `globals.css`), Zustand, Vitest 4 + happy-dom + @testing-library/react + user-event, Playwright 1.61.

## Global Constraints

- **Breakpoint:** `lg` = 1024px is the mobile boundary. Mobile-only styling uses `max-lg:`; desktop-only uses `lg:` or `hidden lg:…`.
- **Desktop is unchanged.** No task may alter rendered desktop geometry. Verified against `.ui-baseline/desktop-1440x900.json` via `node scripts/ui-audit.mjs desktop`.
- **Touch targets ≥44×44 CSS px** for every interactive element, including the logo link (currently 20×44 and failing).
- **Hiding uses `display:none`** (Tailwind `hidden` / `max-lg:hidden` / `lg:hidden`), never `visibility` or `opacity`, so exactly one instance of a duplicated control is in the accessibility tree.
- **No absolutely-positioned invisible hit areas over interactive content.** A 44px transparent overlay on the sheet handle swallowed every tap meant for the tabs during mockup development. Make the handle itself the target.
- **One source of truth for the bottom-nav height.** `src/app/globals.css` defines `--straits-nav-h: calc(3.5rem + env(safe-area-inset-bottom))`. The nav, the mobile sheet, the vessel sheet, and the scroll padding on other routes all reference `var(--straits-nav-h)`. Never hardcode `56px` / `bottom-14` for this — on an iPhone the safe-area inset makes the real nav taller than 56px, and a hardcoded offset puts the sheet underneath it.
- **Border-radius is globally zeroed** (`--radius-*: initial` in `src/app/globals.css`). Every `rounded-*` class is a no-op. Do not add rounding; sharp corners are the terminal aesthetic.
- **Terminal palette:** true black, `amber-500` accent, JetBrains Mono via `font-mono`.
- **Tests are colocated** as `src/**/*.test.tsx`. Run with `npx vitest run <path>`.
- **Never modify a check to make it pass.** If a test or verification script fails, fix the code.
- Commit after every task. Lint must stay clean: `npx eslint src/`.

---

## File Structure

**Create**
| File | Responsibility |
|---|---|
| `src/lib/hooks/useSheetDetent.ts` | Sheet open-height state machine (peek/half/full) — pure state, no DOM |
| `src/components/ui/MobileBottomNav.tsx` | Fixed 4-item bottom navigation, `lg:hidden` |
| `src/components/ui/StatusChip.tsx` | Owns `/api/status` polling; renders merged chip on mobile, existing indicator row on desktop |
| `src/components/map/MapFilterChips.tsx` | Tanker + anomaly toggles positioned over the map, `lg:hidden` |
| `src/components/dashboard/MobileSheet.tsx` | Three-detent bottom sheet with Chokepoints/Prices/Intel tabs |
| `scripts/verify-dashboard-layout.mjs` | Playwright measurement suite |

**Modify**
| File | Change |
|---|---|
| `src/components/ui/Header.tsx` | Collapse to one 44px row on mobile; hide nav, filters, chokepoint row |
| `src/app/(protected)/layout.tsx` | Render `MobileBottomNav` |
| `src/app/(protected)/dashboard/page.tsx` | Map fills; panels move into the sheet; vessel sheet clears the nav |
| `src/components/panels/NewsPanel.tsx` | Cap at 8 items with expand control |
| `src/app/(protected)/{fleet,analytics,about}/page.tsx` | `max-lg:pb-14` so content clears the fixed nav |

**Delete**
| File | Reason |
|---|---|
| `src/components/ui/StatusBar.tsx` | Absorbed by `StatusChip` (which owns the single poller). Only `Header.tsx` imports it; it has no tests. |

---

## Task 1: Sheet detent state

**Files:**
- Create: `src/lib/hooks/useSheetDetent.ts`
- Test: `src/lib/hooks/useSheetDetent.test.ts`

**Interfaces:**
- Produces: `type Detent = 'peek' | 'half' | 'full'`; `useSheetDetent(): { detent: Detent; cycle(): void; expand(): void; collapse(): void; isOpen: boolean }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSheetDetent } from './useSheetDetent';

describe('useSheetDetent', () => {
  it('starts at peek and is not open', () => {
    const { result } = renderHook(() => useSheetDetent());
    expect(result.current.detent).toBe('peek');
    expect(result.current.isOpen).toBe(false);
  });

  it('cycles peek -> half -> full -> peek', () => {
    const { result } = renderHook(() => useSheetDetent());
    act(() => result.current.cycle());
    expect(result.current.detent).toBe('half');
    act(() => result.current.cycle());
    expect(result.current.detent).toBe('full');
    act(() => result.current.cycle());
    expect(result.current.detent).toBe('peek');
  });

  it('reports isOpen for any detent above peek', () => {
    const { result } = renderHook(() => useSheetDetent());
    act(() => result.current.expand());
    expect(result.current.detent).toBe('half');
    expect(result.current.isOpen).toBe(true);
  });

  it('collapse returns to peek from any detent', () => {
    const { result } = renderHook(() => useSheetDetent());
    act(() => result.current.cycle());
    act(() => result.current.cycle());
    expect(result.current.detent).toBe('full');
    act(() => result.current.collapse());
    expect(result.current.detent).toBe('peek');
  });

  it('expand from full stays at full rather than wrapping to peek', () => {
    const { result } = renderHook(() => useSheetDetent());
    act(() => result.current.cycle());
    act(() => result.current.cycle());
    act(() => result.current.expand());
    expect(result.current.detent).toBe('full');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/hooks/useSheetDetent.test.ts`
Expected: FAIL — `Failed to resolve import "./useSheetDetent"`

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Bottom-sheet open-height state.
 *
 * `cycle` is what the drag handle calls — it wraps back to peek so a user who
 * keeps tapping always gets back to the map. `expand` clamps at full instead,
 * for callers that must not accidentally close the sheet.
 */
import { useCallback, useState } from 'react';

export type Detent = 'peek' | 'half' | 'full';

const ORDER: Detent[] = ['peek', 'half', 'full'];

export function useSheetDetent() {
  const [detent, setDetent] = useState<Detent>('peek');

  const cycle = useCallback(() => {
    setDetent((prev) => ORDER[(ORDER.indexOf(prev) + 1) % ORDER.length]);
  }, []);

  const expand = useCallback(() => {
    setDetent((prev) => ORDER[Math.min(ORDER.indexOf(prev) + 1, ORDER.length - 1)]);
  }, []);

  const collapse = useCallback(() => setDetent('peek'), []);

  return { detent, cycle, expand, collapse, isOpen: detent !== 'peek' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/hooks/useSheetDetent.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/useSheetDetent.ts src/lib/hooks/useSheetDetent.test.ts
git commit -m "feat(dashboard): add sheet detent state hook"
```

---

## Task 2: Mobile bottom navigation

**Files:**
- Create: `src/components/ui/MobileBottomNav.tsx`
- Test: `src/components/ui/MobileBottomNav.test.tsx`
- Modify: `src/app/globals.css` — add the `--straits-nav-h` token

**Interfaces:**
- Produces: `<MobileBottomNav />` — no props. Reads the active route from `usePathname()`.

Four destinations, in this order and with these exact labels: `/dashboard` "Map", `/analytics` "Analytics", `/fleet` "Fleet", `/about` "About".

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MobileBottomNav } from './MobileBottomNav';

const pathname = vi.hoisted(() => ({ current: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

afterEach(() => { cleanup(); pathname.current = '/dashboard'; });

describe('MobileBottomNav', () => {
  it('renders all four destinations', () => {
    render(<MobileBottomNav />);
    for (const label of ['Map', 'Analytics', 'Fleet', 'About']) {
      expect(screen.getByRole('link', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }
  });

  it('marks only the active route as current', () => {
    pathname.current = '/fleet';
    render(<MobileBottomNav />);
    const current = screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(/fleet/i);
  });

  it('is hidden at desktop widths', () => {
    render(<MobileBottomNav />);
    expect(screen.getByRole('navigation')).toHaveClass('lg:hidden');
  });

  it('gives every destination a 44px minimum tap height', () => {
    render(<MobileBottomNav />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toMatch(/min-h-\[44px\]/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/MobileBottomNav.test.tsx`
Expected: FAIL — `Failed to resolve import "./MobileBottomNav"`

- [ ] **Step 3: Add the shared height token**

In `src/app/globals.css`, after the `@theme { … }` block, add:

```css
/* Total height the mobile bottom nav reserves, including the iPhone home-indicator
   inset. The nav, the dashboard sheet, the vessel sheet, and the scroll padding on
   other routes all read this, so a device with a home indicator can never leave a
   sheet sitting underneath the nav. Resolves to 3.5rem where the inset is 0. */
:root {
  --straits-nav-h: calc(3.5rem + env(safe-area-inset-bottom));
}
```

- [ ] **Step 4: Write the implementation**

The nav is `--straits-nav-h` tall and pads the inset out of its content box, leaving a full 3.5rem for the links.

```tsx
/**
 * Mobile bottom navigation.
 *
 * The header's nav row is hidden below lg; this replaces it and puts the
 * primary destinations in the thumb zone. Rendered from the (protected)
 * layout so every route in the group keeps navigation on a phone.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, BarChart3, Ship, Info } from 'lucide-react';

const DESTINATIONS = [
  { href: '/dashboard', label: 'Map', Icon: Map },
  { href: '/analytics', label: 'Analytics', Icon: BarChart3 },
  { href: '/fleet', label: 'Fleet', Icon: Ship },
  { href: '/about', label: 'About', Icon: Info },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 h-[var(--straits-nav-h)] bg-black border-t border-amber-500/20 pb-[env(safe-area-inset-bottom)]"
    >
      {DESTINATIONS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors ${
              active ? 'text-amber-500' : 'text-gray-500'
            }`}
          >
            <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/ui/MobileBottomNav.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/components/ui/MobileBottomNav.tsx src/components/ui/MobileBottomNav.test.tsx
git commit -m "feat(nav): add mobile bottom navigation"
```

---

## Task 3: Status chip

Merges `DataFreshness` and `StatusBar` on mobile into one element (spec D5), and absorbs `StatusBar`'s desktop rendering so only one `/api/status` poller exists.

**Files:**
- Create: `src/components/ui/StatusChip.tsx`
- Test: `src/components/ui/StatusChip.test.tsx`
- Delete: `src/components/ui/StatusBar.tsx`

**Interfaces:**
- Consumes: `useVesselStore()` from `@/stores/vessel` — field `lastUpdate: Date | null`.
- Produces: `<StatusChip />` — no props. Replaces `<StatusBar />` in `Header.tsx` (done in Task 7).

`/api/status` returns `{ ais, prices, news }`, each `'live' | 'degraded' | 'offline' | null`.

Worst-state precedence, most severe first: `offline` > `degraded` > `live` > `null`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusChip, worstStatus } from './StatusChip';

vi.mock('@/stores/vessel', () => ({
  useVesselStore: () => ({ lastUpdate: new Date(Date.now() - 60_000) }),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ ais: 'live', prices: 'degraded', news: 'live' }),
  })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('worstStatus', () => {
  it('ranks offline above degraded above live', () => {
    expect(worstStatus({ ais: 'live', prices: 'degraded', news: 'offline' })).toBe('offline');
    expect(worstStatus({ ais: 'live', prices: 'degraded', news: 'live' })).toBe('degraded');
    expect(worstStatus({ ais: 'live', prices: 'live', news: 'live' })).toBe('live');
  });

  it('returns null only when every source is unknown', () => {
    expect(worstStatus({ ais: null, prices: null, news: null })).toBeNull();
    expect(worstStatus({ ais: null, prices: 'live', news: null })).toBe('live');
  });
});

describe('StatusChip', () => {
  it('renders one mobile summary and one desktop breakdown', async () => {
    render(<StatusChip />);
    await waitFor(() => expect(screen.getByTestId('status-chip-mobile')).toBeInTheDocument());
    expect(screen.getByTestId('status-chip-mobile')).toHaveClass('lg:hidden');
    expect(screen.getByTestId('status-chip-desktop').className).toMatch(/hidden/);
  });

  it('summarises the worst source state on the mobile chip', async () => {
    render(<StatusChip />);
    await waitFor(() =>
      expect(screen.getByTestId('status-chip-mobile')).toHaveAccessibleName(/degraded/i),
    );
  });

  it('discloses the per-source breakdown when tapped', async () => {
    const user = userEvent.setup();
    render(<StatusChip />);
    await waitFor(() => expect(screen.getByTestId('status-chip-mobile')).toBeInTheDocument());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('status-chip-mobile'));

    const panel = screen.getByRole('dialog');
    expect(panel).toHaveTextContent(/AIS/);
    expect(panel).toHaveTextContent(/Prices/);
    expect(panel).toHaveTextContent(/News/);
  });

  it('polls once, not once per rendered layout', async () => {
    render(<StatusChip />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('still shows a status dot when there is no vessel timestamp', async () => {
    vi.doMock('@/stores/vessel', () => ({ useVesselStore: () => ({ lastUpdate: null }) }));
    render(<StatusChip />);
    await waitFor(() => expect(screen.getByTestId('status-chip-mobile')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/StatusChip.test.tsx`
Expected: FAIL — `Failed to resolve import "./StatusChip"`

- [ ] **Step 3: Write the implementation**

```tsx
/**
 * Merged data-freshness and system-status indicator.
 *
 * On the live site these were two separate widgets 54px apart saying the same
 * thing in two visual languages — amber dots reading as a warning next to a
 * "less than a minute ago" claim. This is one element: a single dot carrying
 * the worst source state, the relative age beside it, and the per-source
 * breakdown behind a tap.
 *
 * It also owns the only /api/status poller. Both layouts render from one
 * component so the hidden one does not double the request rate.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow, isValid } from 'date-fns';
import { useVesselStore } from '@/stores/vessel';

export type SourceStatus = 'live' | 'degraded' | 'offline' | null;

export interface StatusState {
  ais: SourceStatus;
  prices: SourceStatus;
  news: SourceStatus;
}

const SEVERITY: SourceStatus[] = ['offline', 'degraded', 'live'];

export function worstStatus(s: StatusState): SourceStatus {
  const present = [s.ais, s.prices, s.news];
  return SEVERITY.find((level) => present.includes(level)) ?? null;
}

function dotClass(status: SourceStatus): string {
  switch (status) {
    case 'live': return 'bg-amber-500';
    case 'degraded': return 'bg-yellow-400';
    case 'offline': return 'bg-red-500';
    default: return 'bg-gray-600';
  }
}

function labelClass(status: SourceStatus): string {
  return status === 'live' || status === 'degraded' ? 'text-amber-500/60' : 'text-gray-500';
}

const SOURCES: Array<{ key: keyof StatusState; label: string }> = [
  { key: 'ais', label: 'AIS' },
  { key: 'prices', label: 'Prices' },
  { key: 'news', label: 'News' },
];

export function StatusChip() {
  const [status, setStatus] = useState<StatusState>({ ais: null, prices: null, news: null });
  const [open, setOpen] = useState(false);
  const [age, setAge] = useState<string | null>(null);
  const { lastUpdate } = useVesselStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        if (res.ok) setStatus(await res.json());
      } catch {
        // Network error — leave the last known state rather than flashing unknown.
      }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Recomputed on a tick so the impure clock read never happens during render.
  useEffect(() => {
    if (!lastUpdate || !isValid(lastUpdate)) {
      setAge(null);
      return;
    }
    const compute = () => setAge(formatDistanceToNow(lastUpdate, { addSuffix: false }));
    compute();
    const interval = setInterval(compute, 10_000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const worst = worstStatus(status);
  const worstLabel = worst ?? 'unknown';
  const summary = age ? `Systems ${worstLabel}, data updated ${age} ago` : `Systems ${worstLabel}`;

  return (
    <>
      {/* Mobile: one dot, one age, detail on tap. */}
      <div className="lg:hidden relative">
        <button
          type="button"
          data-testid="status-chip-mobile"
          aria-label={summary}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
          className="min-h-[44px] min-w-[44px] px-2 inline-flex items-center gap-1.5"
        >
          <span className={`w-1.5 h-1.5 ${dotClass(worst)}`} />
          {age && <span className="text-xs font-mono text-gray-400">{age}</span>}
        </button>
        {open && (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="System status detail"
            className="absolute right-0 top-full z-50 min-w-[180px] bg-black border border-amber-500/20 p-3 flex flex-col gap-2"
          >
            {SOURCES.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 ${dotClass(status[key])}`} />
                <span className="text-xs font-mono uppercase tracking-wider text-gray-300">{label}</span>
                <span className={`ml-auto text-xs font-mono ${labelClass(status[key])}`}>
                  {status[key] ?? 'unknown'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: unchanged three-indicator row. */}
      <div
        data-testid="status-chip-desktop"
        className="hidden lg:flex items-center gap-3 px-2 border-l border-amber-500/20"
        role="status"
        aria-label="System status indicators"
      >
        {SOURCES.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 ${dotClass(status[key])}`} />
            <span className={`text-xs font-mono uppercase tracking-wider ${labelClass(status[key])}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/StatusChip.test.tsx`
Expected: PASS — 7 tests

- [ ] **Step 5: Delete the absorbed component**

`StatusBar.tsx` has no tests and is imported only by `Header.tsx` (rewired in Task 7). Deleting it here leaves `Header.tsx` with a broken import until Task 7 lands, so do both the delete and the `Header` import swap now:

```bash
git rm src/components/ui/StatusBar.tsx
```

In `src/components/ui/Header.tsx`, change the import on line 17 and the usage on line 124:

```tsx
import { StatusChip } from './StatusChip';
```
```tsx
            <StatusChip />
```

- [ ] **Step 6: Verify nothing still references the deleted file**

Run: `grep -rn "StatusBar" src/ ; npx tsc --noEmit`
Expected: no `StatusBar` matches, and typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add -A src/components/ui/
git commit -m "feat(status): merge freshness and system status into one chip"
```

---

## Task 4: Map filter chips

**Files:**
- Create: `src/components/map/MapFilterChips.tsx`
- Test: `src/components/map/MapFilterChips.test.tsx`

**Interfaces:**
- Consumes: `TankerFilter` from `@/components/ui/TankerFilter`, `AnomalyFilter` from `@/components/ui/AnomalyFilter` — both take no props and read/write `useVesselStore` themselves.
- Produces: `<MapFilterChips />` — no props. Positioned absolutely; its parent must be `relative`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MapFilterChips } from './MapFilterChips';

afterEach(() => cleanup());

describe('MapFilterChips', () => {
  it('renders both map filters', () => {
    render(<MapFilterChips />);
    expect(screen.getByRole('button', { name: /all vessels|tankers only/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anomalies/i })).toBeInTheDocument();
  });

  it('is hidden at desktop widths so the header copy stays authoritative', () => {
    const { container } = render(<MapFilterChips />);
    expect(container.firstElementChild).toHaveClass('lg:hidden');
  });

  it('overlays the map rather than taking layout space', () => {
    const { container } = render(<MapFilterChips />);
    expect(container.firstElementChild).toHaveClass('absolute');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/map/MapFilterChips.test.tsx`
Expected: FAIL — `Failed to resolve import "./MapFilterChips"`

- [ ] **Step 3: Write the implementation**

```tsx
/**
 * Map layer filters, anchored to the map they control.
 *
 * These lived in the header, stacked above the map and costing ~10,200px² of
 * a 390px screen. They are map controls; they belong on the map surface, the
 * way every mobile map app places them.
 *
 * Mobile only — the desktop header keeps its own copy. Both instances are in
 * the DOM but `lg:hidden` / `max-lg:hidden` compute to display:none, so
 * exactly one is ever in the accessibility tree.
 */
'use client';

import { TankerFilter } from '@/components/ui/TankerFilter';
import { AnomalyFilter } from '@/components/ui/AnomalyFilter';

export function MapFilterChips() {
  return (
    <div className="lg:hidden absolute top-3 left-3 z-10 flex gap-2">
      <TankerFilter />
      <AnomalyFilter />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/map/MapFilterChips.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/map/MapFilterChips.tsx src/components/map/MapFilterChips.test.tsx
git commit -m "feat(map): move layer filters onto the map on mobile"
```

---

## Task 5: Cap the intel feed

**Files:**
- Modify: `src/components/panels/NewsPanel.tsx:66-91`
- Test: `src/components/panels/NewsPanel.test.tsx`

**Interfaces:**
- Produces: `NewsPanel` renders at most `VISIBLE_HEADLINES` (8) items until expanded. Export `VISIBLE_HEADLINES` so the verification script and tests share one number.

The panel fetches `/api/news` and renders `data.headlines`. It returns `null` while `loading`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsPanel, VISIBLE_HEADLINES } from './NewsPanel';

const headlines = Array.from({ length: 15 }, (_, i) => ({
  title: `Headline ${i + 1}`,
  source: 'Reuters',
  url: `https://example.com/${i + 1}`,
  publishedAt: new Date(2026, 6, 20).toISOString(),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ headlines }) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('NewsPanel', () => {
  it('caps the list at 8 items even though 15 were returned', async () => {
    render(<NewsPanel />);
    await waitFor(() => expect(screen.getByText('Headline 1')).toBeInTheDocument());
    expect(screen.getAllByRole('link')).toHaveLength(VISIBLE_HEADLINES);
    expect(VISIBLE_HEADLINES).toBe(8);
    expect(screen.queryByText('Headline 9')).not.toBeInTheDocument();
  });

  it('reveals the rest when the expand control is used', async () => {
    const user = userEvent.setup();
    render(<NewsPanel />);
    await waitFor(() => expect(screen.getByText('Headline 1')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /view all 15/i }));

    expect(screen.getAllByRole('link')).toHaveLength(15);
    expect(screen.getByText('Headline 15')).toBeInTheDocument();
  });

  it('offers no expand control when the feed already fits', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => ({ headlines: headlines.slice(0, 5) }),
    })));
    render(<NewsPanel />);
    await waitFor(() => expect(screen.getByText('Headline 1')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /view all/i })).not.toBeInTheDocument();
  });

  it('still collapses the whole panel from its header', async () => {
    const user = userEvent.setup();
    render(<NewsPanel />);
    await waitFor(() => expect(screen.getByText('Headline 1')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /collapse intel feed/i }));
    expect(screen.queryByText('Headline 1')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/panels/NewsPanel.test.tsx`
Expected: FAIL — `VISIBLE_HEADLINES` is not exported, and 15 links render instead of 8.

- [ ] **Step 3: Write the implementation**

Add the export and an `expanded` state near the existing `collapsed` state, then slice the list and add the control. Replace the body of the `{!collapsed && (…)}` block at lines 66-91:

```tsx
/** Ceiling on rendered headlines. The feed had none, so its height scaled with
 *  whatever the API returned — 1020px on a 844px-tall phone. */
export const VISIBLE_HEADLINES = 8;
```

```tsx
  const [expanded, setExpanded] = useState(false);
```

```tsx
      {!collapsed && (
        <div className="overflow-y-auto">
          {headlines.length === 0 ? (
            <p className="px-3 py-2 text-gray-500 text-xs font-mono">No headlines available</p>
          ) : (
            <>
              {(expanded ? headlines : headlines.slice(0, VISIBLE_HEADLINES)).map((item) => (
                <a
                  key={`${item.url}-${item.publishedAt}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${item.title} — ${item.source}`}
                  className="block px-3 py-2 border-b border-amber-500/10 hover:bg-white/5 transition-colors"
                >
                  <p className="text-xs text-gray-200 leading-tight line-clamp-2">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 font-mono">
                    <span>{item.source}</span>
                    <span>-</span>
                    <span>{formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}</span>
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </div>
                </a>
              ))}
              {!expanded && headlines.length > VISIBLE_HEADLINES && (
                <button
                  onClick={() => setExpanded(true)}
                  className="w-full min-h-[44px] px-3 text-xs font-mono uppercase tracking-widest text-amber-500 border-b border-amber-500/20 hover:bg-white/5 transition-colors"
                >
                  View all {headlines.length} →
                </button>
              )}
            </>
          )}
        </div>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/panels/NewsPanel.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 5: Prove the cap test is not vacuous**

Temporarily change `VISIBLE_HEADLINES` to `15` and re-run. Expected: the first two tests FAIL. Revert to `8` and confirm they pass again. This proves the test measures the cap rather than the fixture length.

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/NewsPanel.tsx src/components/panels/NewsPanel.test.tsx
git commit -m "feat(intel): cap the feed at 8 items with an expand control"
```

---

## Task 6: Mobile sheet

**Files:**
- Create: `src/components/dashboard/MobileSheet.tsx`
- Test: `src/components/dashboard/MobileSheet.test.tsx`

The sheet sits directly on top of the bottom nav via `bottom-[var(--straits-nav-h)]` (Task 2). Do not hardcode a pixel offset.

**Interfaces:**
- Consumes: `useSheetDetent()` from `@/lib/hooks/useSheetDetent` (Task 1) — `{ detent, cycle, collapse, isOpen }`, `Detent = 'peek' | 'half' | 'full'`.
- Produces:
  ```ts
  interface Chokepoint { name: string; tankers: number; total: number }
  interface MobileSheetProps {
    chokepoints: Chokepoint[];
    collapsed: boolean;            // forced to peek by the parent (vessel selected)
    children: { prices: ReactNode; intel: ReactNode };
  }
  ```

Tabs, in order, with these exact ids and labels: `choke` "Chokepoints", `prices` "Prices", `intel` "Intel".

Detent heights: `peek` = `h-[88px]`, `half` = `h-[46dvh]`, `full` = `h-[72dvh]`.

Keyboard: arrow keys move between tabs and focus follows selection, matching `FleetTabs`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileSheet } from './MobileSheet';

const chokepoints = [
  { name: 'Hormuz', tankers: 10, total: 23 },
  { name: 'Suez', tankers: 85, total: 161 },
];

function setup(props: Partial<React.ComponentProps<typeof MobileSheet>> = {}) {
  return render(
    <MobileSheet
      chokepoints={chokepoints}
      collapsed={false}
      children={{ prices: <div>PRICES BODY</div>, intel: <div>INTEL BODY</div> }}
      {...props}
    />,
  );
}

afterEach(() => cleanup());

describe('MobileSheet', () => {
  it('starts at peek showing the chokepoint strip and no tabs', () => {
    setup();
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'peek');
    expect(screen.getByTestId('sheet-peek-strip')).toHaveTextContent('Hormuz');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('expands through the detents from the handle', async () => {
    const user = userEvent.setup();
    setup();
    const handle = screen.getByRole('button', { name: /expand panel/i });

    await user.click(handle);
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'half');
    await user.click(handle);
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'full');
    await user.click(handle);
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'peek');
  });

  it('hides the peek strip once tabs are available, so the counts are not shown twice', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /expand panel/i }));

    expect(screen.queryByTestId('sheet-peek-strip')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /chokepoints/i })).toBeInTheDocument();
  });

  it('switches panels and mounts only the selected one', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /expand panel/i }));

    expect(screen.queryByText('INTEL BODY')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /intel/i }));

    expect(screen.getByText('INTEL BODY')).toBeInTheDocument();
    expect(screen.queryByText('PRICES BODY')).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('moves selection with arrow keys and takes focus with it', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /expand panel/i }));

    screen.getByRole('tab', { name: /chokepoints/i }).focus();
    await user.keyboard('{ArrowRight}');

    const prices = screen.getByRole('tab', { name: /prices/i });
    expect(prices).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(prices);
  });

  it('wraps from the last tab to the first', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /expand panel/i }));

    screen.getByRole('tab', { name: /chokepoints/i }).focus();
    await user.keyboard('{ArrowLeft}');

    expect(screen.getByRole('tab', { name: /intel/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('returns to peek when the parent collapses it', () => {
    const { rerender } = setup();
    rerender(
      <MobileSheet
        chokepoints={chokepoints}
        collapsed
        children={{ prices: <div>PRICES BODY</div>, intel: <div>INTEL BODY</div> }}
      />,
    );
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'peek');
  });

  it('keeps the handle a 44px target with no overlay above the tabs', async () => {
    const user = userEvent.setup();
    setup();
    const handle = screen.getByRole('button', { name: /expand panel/i });
    expect(handle.className).toMatch(/h-11|min-h-\[44px\]/);
    expect(handle.className).not.toMatch(/absolute/);

    await user.click(handle);
    expect(screen.getByRole('tab', { name: /prices/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/MobileSheet.test.tsx`
Expected: FAIL — `Failed to resolve import "./MobileSheet"`

- [ ] **Step 3: Write the implementation**

```tsx
/**
 * Dashboard bottom sheet.
 *
 * Replaces the stacked panel column that forced 3.11 screens of scrolling on a
 * phone. Peek shows a chokepoint strip; dragging up reveals tabbed panels.
 *
 * The handle is itself the 44px target. An earlier build used an absolutely
 * positioned transparent hit area across the sheet top, which sat over the tab
 * row and swallowed every tap meant for it — a defect no size check can see.
 */
'use client';

import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useSheetDetent, type Detent } from '@/lib/hooks/useSheetDetent';

export interface Chokepoint {
  name: string;
  tankers: number;
  total: number;
}

export interface MobileSheetProps {
  chokepoints: Chokepoint[];
  /** Forced back to peek by the parent — e.g. a vessel was selected. */
  collapsed: boolean;
  children: { prices: ReactNode; intel: ReactNode };
}

type TabId = 'choke' | 'prices' | 'intel';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'choke', label: 'Chokepoints' },
  { id: 'prices', label: 'Prices' },
  { id: 'intel', label: 'Intel' },
];

const HEIGHT: Record<Detent, string> = {
  peek: 'h-[88px]',
  half: 'h-[46dvh]',
  full: 'h-[72dvh]',
};

export function MobileSheet({ chokepoints, collapsed, children }: MobileSheetProps) {
  const { detent, cycle, collapse, isOpen } = useSheetDetent();
  const [active, setActive] = useState<TabId>('choke');
  const baseId = useId();

  // The vessel sheet and this sheet share the same bottom edge; two stacked
  // sheets is the defect this layout exists to remove.
  useEffect(() => {
    if (collapsed) collapse();
  }, [collapsed, collapse]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const current = TABS.findIndex((t) => t.id === active);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (current + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    if (next === null) return;

    event.preventDefault();
    const nextId = TABS[next].id;
    setActive(nextId);
    // Roving tabindex drops the old button to -1, so focus must follow or the
    // screen-reader cursor is stranded on a tab that is no longer selected.
    document.getElementById(`${baseId}-tab-${nextId}`)?.focus();
  }

  return (
    <div
      data-testid="mobile-sheet"
      data-detent={detent}
      className={`lg:hidden fixed inset-x-0 bottom-[var(--straits-nav-h)] z-30 flex flex-col bg-black border-t border-amber-500 shadow-[0_-8px_24px_rgba(0,0,0,0.85)] transition-[height] duration-200 ${HEIGHT[detent]}`}
    >
      <button
        type="button"
        onClick={cycle}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Collapse panel' : 'Expand panel'}
        className="h-11 shrink-0 w-full flex items-center justify-center"
      >
        <span className="w-9 h-[3px] bg-amber-500/50" />
      </button>

      {!isOpen && (
        <div
          data-testid="sheet-peek-strip"
          className="h-11 shrink-0 flex items-center gap-3 px-4 overflow-x-auto"
        >
          {chokepoints.map((c) => (
            <span key={c.name} className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-500">{c.name}</span>
              <span className="text-sm font-mono text-white">{c.tankers}</span>
              <span className="text-xs font-mono text-gray-500">/{c.total}</span>
            </span>
          ))}
        </div>
      )}

      {isOpen && (
        <>
          <div
            role="tablist"
            aria-label="Dashboard panels"
            onKeyDown={handleKeyDown}
            className="grid grid-cols-3 shrink-0 border-t border-amber-500/20"
          >
            {TABS.map((tab) => {
              const selected = tab.id === active;
              return (
                <button
                  key={tab.id}
                  id={`${baseId}-tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={selected ? `${baseId}-panel-${tab.id}` : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(tab.id)}
                  className={`min-h-[44px] text-xs font-mono uppercase tracking-wider transition-colors ${
                    selected
                      ? 'text-amber-500 bg-amber-500/10 shadow-[inset_0_-2px_0_var(--color-amber-500)]'
                      : 'text-gray-500'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            id={`${baseId}-panel-${active}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${active}`}
            className="flex-1 min-h-0 overflow-y-auto"
          >
            {active === 'choke' && (
              <div>
                {chokepoints.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between min-h-[44px] px-4 border-b border-amber-500/10"
                  >
                    <span className="text-xs font-mono uppercase tracking-wider text-amber-500">{c.name}</span>
                    <span className="text-xs font-mono text-gray-500">
                      <span className="text-sm text-gray-200">{c.tankers}</span> / {c.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {active === 'prices' && children.prices}
            {active === 'intel' && children.intel}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/MobileSheet.test.tsx`
Expected: PASS — 8 tests

- [ ] **Step 5: Prove the wrap test is not vacuous**

Temporarily change the `ArrowLeft` branch to `next = Math.max(current - 1, 0)`. Re-run: the "wraps from the last tab to the first" test must FAIL while the others still pass. Revert and confirm green. A wrap test that never crosses a boundary proves nothing.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/MobileSheet.tsx src/components/dashboard/MobileSheet.test.tsx
git commit -m "feat(dashboard): add mobile bottom sheet with tabbed panels"
```

---

## Task 7: Condense the header on mobile

**Files:**
- Modify: `src/components/ui/Header.tsx`
- Test: `src/components/ui/Header.test.tsx`

**Interfaces:**
- Consumes: `<StatusChip />` (Task 3, already imported there).
- Produces: header renders a single 44px row below `lg`. Its `<nav>`, the filter cluster, and the chokepoint row all carry `max-lg:hidden`.

The logo link is currently 20×44 and fails the tap-target floor; give it `min-w-[44px]`.

`SearchInput` becomes a `lg:` -only inline input; on mobile a search icon button toggles it into a full-width row beneath the bar.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('./StatusChip', () => ({ StatusChip: () => <div data-testid="status-chip" /> }));
vi.mock('./NotificationBell', () => ({ NotificationBell: () => <button>Notifications</button> }));
vi.mock('./ChokepointWidget', () => ({ ChokepointWidgets: () => <div data-testid="chokepoints" /> }));
vi.mock('./SearchInput', () => ({
  SearchInput: () => <input placeholder="Search vessel..." />,
}));
vi.mock('./DataFreshness', () => ({ DataFreshness: () => <span data-testid="freshness" /> }));

afterEach(() => cleanup());

describe('Header', () => {
  it('hides the primary nav below lg, where the bottom bar takes over', () => {
    render(<Header />);
    expect(screen.getByRole('navigation')).toHaveClass('max-lg:hidden');
  });

  it('hides the map filters below lg, where the map chips take over', () => {
    render(<Header />);
    expect(screen.getByTestId('header-controls')).toHaveClass('max-lg:hidden');
  });

  it('hides the chokepoint row below lg, where the sheet takes over', () => {
    render(<Header />);
    expect(screen.getByTestId('header-chokepoints')).toHaveClass('max-lg:hidden');
  });

  it('gives the logo a 44px minimum in both dimensions', () => {
    render(<Header />);
    const logo = screen.getByRole('link', { name: /straits/i });
    expect(logo.className).toMatch(/min-w-\[44px\]/);
    expect(logo.className).toMatch(/min-h-\[44px\]/);
  });

  it('offers search as a toggle on mobile rather than a permanent row', async () => {
    const user = userEvent.setup();
    render(<Header />);

    const toggle = screen.getByRole('button', { name: /search/i });
    expect(toggle).toHaveClass('lg:hidden');
    expect(screen.queryByTestId('mobile-search')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(within(screen.getByTestId('mobile-search')).getByPlaceholderText(/search vessel/i)).toBeInTheDocument();
  });

  it('keeps exactly one status chip', () => {
    render(<Header />);
    expect(screen.getAllByTestId('status-chip')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/Header.test.tsx`
Expected: FAIL — `max-lg:hidden` is absent from the nav; `header-controls` testid does not exist.

- [ ] **Step 3: Write the implementation**

Replace the component body of `src/components/ui/Header.tsx` (from `return (` to the closing `);`) with:

```tsx
  return (
    <header className="bg-black border-b border-amber-500/20">
      <div className="min-h-14 max-lg:min-h-11 flex items-center justify-between px-4 lg:flex-wrap max-lg:h-auto max-lg:flex-col max-lg:items-stretch max-lg:gap-0">
        <div className="flex items-center max-lg:justify-between max-lg:min-h-11 max-lg:w-full">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 shrink-0 min-w-[44px] min-h-[44px]"
          >
            <StraitsMark size={20} className="shrink-0" />
            <h1 className="text-sm font-mono uppercase tracking-widest text-amber-500 max-sm:hidden">Straits</h1>
          </Link>

          {/* Below lg this is replaced by MobileBottomNav, which puts the same
              destinations in the thumb zone instead of the top 33%. */}
          <nav className="max-lg:hidden flex gap-1 ml-6">
            {NAV_ITEMS.map(({ href, label, id }) => (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center whitespace-nowrap px-3 py-1 text-xs font-mono uppercase tracking-wider border transition-colors ${
                  activeTab === id
                    ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                    : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Mobile-only utility cluster, kept on the same 44px row as the mark. */}
          <div className="lg:hidden flex items-center">
            <StatusChip />
            {activeTab === 'dashboard' && (
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-expanded={searchOpen}
                aria-label="Search vessels"
                className="lg:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400"
              >
                <Search className="w-[18px] h-[18px]" aria-hidden="true" />
              </button>
            )}
            <NotificationBell />
          </div>
        </div>

        {/* Desktop control row. Below lg the filters live on the map and the
            status chip has already rendered above, so the whole row is dropped. */}
        <div
          data-testid="header-controls"
          className="max-lg:hidden flex items-center gap-4"
        >
          {activeTab === 'dashboard' && <SearchInput onSelectVessel={onSearchSelect} />}
          <div className="flex items-center gap-4">
            {activeTab === 'dashboard' && (
              <>
                <DataFreshness />
                <TankerFilter />
                <AnomalyFilter />
              </>
            )}
            <NotificationBell />
            <StatusChip />
          </div>
        </div>
      </div>

      {searchOpen && activeTab === 'dashboard' && (
        <div data-testid="mobile-search" className="lg:hidden px-4 py-2 border-t border-amber-500/10">
          <SearchInput onSelectVessel={onSearchSelect} />
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div
          data-testid="header-chokepoints"
          className="max-lg:hidden flex items-start px-4 py-2 border-t border-amber-500/10"
        >
          <div className="w-full">
            <ChokepointWidgets onSelect={onChokepointSelect} />
          </div>
        </div>
      )}
    </header>
  );
```

Above the `return`, replace the `chokepointsOpen` state with `searchOpen`, add the `Search` icon import and the nav table:

```tsx
import { Search } from 'lucide-react';
```
```tsx
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Live Map', id: 'dashboard' },
  { href: '/analytics', label: 'Analytics', id: 'analytics' },
  { href: '/fleet', label: 'Fleet', id: 'fleet' },
  { href: '/about', label: 'About', id: 'about' },
] as const;
```
```tsx
  const [searchOpen, setSearchOpen] = useState(false);
```

Two instances of `NotificationBell` and `StatusChip` now exist — one in the mobile cluster, one in the desktop row. Both are gated by `lg:hidden` / `max-lg:hidden`, which computes to `display:none`, so exactly one is in the accessibility tree at any width. Task 10 asserts this.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/Header.test.tsx`
Expected: PASS — 6 tests

- [ ] **Step 5: Confirm nothing else broke**

Run: `npx vitest run && npx eslint src/ && npx tsc --noEmit`
Expected: all suites pass, eslint exits 0, typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Header.tsx src/components/ui/Header.test.tsx
git commit -m "feat(header): collapse to a single 44px row on mobile"
```

---

## Task 8: Mount the bottom nav across the route group

**Files:**
- Modify: `src/app/(protected)/layout.tsx`
- Modify: `src/app/(protected)/fleet/page.tsx:125`, `src/app/(protected)/analytics/page.tsx:120`, `src/app/(protected)/about/page.tsx:24`
- Test: `src/app/(protected)/layout.test.tsx`

**Interfaces:**
- Consumes: `<MobileBottomNav />` from `@/components/ui/MobileBottomNav` (Task 2).

The three non-dashboard pages scroll the document (`min-h-screen`), so their `<main>` needs bottom padding to clear the 56px fixed bar. The dashboard is `h-dvh` and handles its own spacing in Task 9.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ProtectedLayout from './layout';

vi.mock('next/navigation', () => ({ usePathname: () => '/fleet' }));

afterEach(() => cleanup());

describe('ProtectedLayout', () => {
  it('renders its children', () => {
    render(<ProtectedLayout><p>page body</p></ProtectedLayout>);
    expect(screen.getByText('page body')).toBeInTheDocument();
  });

  it('mounts the bottom nav so every route in the group keeps navigation on mobile', () => {
    render(<ProtectedLayout><p>page body</p></ProtectedLayout>);
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(protected)/layout.test.tsx"`
Expected: FAIL — no navigation element found.

- [ ] **Step 3: Write the implementation**

`src/app/(protected)/layout.tsx`:

```tsx
/**
 * Protected route group layout.
 * Provides a Suspense boundary for loading.tsx, and mounts the mobile bottom
 * navigation so every route in the group keeps its primary destinations when
 * the header's nav row is hidden below lg.
 */
import { MobileBottomNav } from '@/components/ui/MobileBottomNav';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <MobileBottomNav />
    </>
  );
}
```

In each of `fleet/page.tsx:125`, `analytics/page.tsx:120`, `about/page.tsx:24`, add `max-lg:pb-[calc(var(--straits-nav-h)+1rem)]` to the `<main>` className so content clears the fixed bar on every device:

```tsx
      <main className="p-6 max-w-7xl mx-auto max-lg:p-3 max-lg:pb-[calc(var(--straits-nav-h)+1rem)]">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(protected)/layout.test.tsx"`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/layout.tsx" "src/app/(protected)/layout.test.tsx" "src/app/(protected)/fleet/page.tsx" "src/app/(protected)/analytics/page.tsx" "src/app/(protected)/about/page.tsx"
git commit -m "feat(nav): mount the bottom nav across the protected route group"
```

---

## Task 9: Rewire the dashboard

**Files:**
- Modify: `src/app/(protected)/dashboard/page.tsx:59-104`
- Test: `src/app/(protected)/dashboard/page.test.tsx`

**Interfaces:**
- Consumes: `<MobileSheet chokepoints={…} collapsed={…}>{{ prices, intel }}</MobileSheet>` (Task 6), `<MapFilterChips />` (Task 4).

On mobile the map fills the space between the header and the sheet; the panel column is `max-lg:hidden`; the vessel sheet moves from `bottom-0` to `bottom-[var(--straits-nav-h)]` so it clears the nav on every device.

Chokepoint counts come from `/api/chokepoints`, which `ChokepointWidgets` already fetches. Fetch it once in the page and pass the array down, rather than adding a second poller.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DashboardPage from './page';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('@/components/map/VesselMap', () => ({ VesselMap: () => <div data-testid="map" /> }));
vi.mock('@/components/panels/ClusterPanel', () => ({ ClusterPanel: () => null }));
vi.mock('@/components/panels/VesselPanel', () => ({ VesselPanel: () => <div data-testid="vessel-panel" /> }));
vi.mock('@/components/panels/WatchlistPanel', () => ({ WatchlistPanel: () => null }));
vi.mock('@/components/panels/OilPricePanel', () => ({ OilPricePanel: () => <div data-testid="prices" /> }));
vi.mock('@/components/panels/NewsPanel', () => ({ NewsPanel: () => <div data-testid="intel" /> }));
vi.mock('@/components/ui/Header', () => ({ Header: () => <header /> }));

const store = vi.hoisted(() => ({ selectedVessel: null as unknown }));
vi.mock('@/stores/vessel', () => ({
  useVesselStore: () => ({
    selectedVessel: store.selectedVessel,
    setMapCenter: vi.fn(),
    setSelectedVessel: vi.fn(),
  }),
}));

afterEach(() => { cleanup(); store.selectedVessel = null; });

describe('DashboardPage', () => {
  it('renders the mobile sheet', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('mobile-sheet')).toBeInTheDocument();
  });

  it('renders the map filter chips over the map', () => {
    render(<DashboardPage />);
    expect(screen.getByRole('button', { name: /all vessels|tankers only/i })).toBeInTheDocument();
  });

  it('hides the stacked panel column below lg', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('panel-rail')).toHaveClass('max-lg:hidden');
  });

  it('anchors the vessel sheet above the bottom nav, not over it', () => {
    store.selectedVessel = { imo: '9999999', name: 'TEST' };
    render(<DashboardPage />);
    const sheet = screen.getByTestId('vessel-sheet');
    expect(sheet.className).toMatch(/bottom-\[var\(--straits-nav-h\)\]/);
    expect(sheet).not.toHaveClass('bottom-0');
  });

  it('collapses the panel sheet when a vessel is selected', () => {
    store.selectedVessel = { imo: '9999999', name: 'TEST' };
    render(<DashboardPage />);
    expect(screen.getByTestId('mobile-sheet')).toHaveAttribute('data-detent', 'peek');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(protected)/dashboard/page.test.tsx"`
Expected: FAIL — no `mobile-sheet` testid.

- [ ] **Step 3: Write the implementation**

Add the imports and the chokepoint fetch:

```tsx
import { MobileSheet, type Chokepoint } from '@/components/dashboard/MobileSheet';
import { MapFilterChips } from '@/components/map/MapFilterChips';
```

```tsx
  const [chokepoints, setChokepoints] = useState<Chokepoint[]>([]);

  // One fetch for both the desktop widgets and the mobile sheet strip.
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/chokepoints');
        if (!res.ok) return;
        const data = await res.json();
        // Verified against src/app/api/chokepoints/route.ts and the
        // ChokepointData interface in ChokepointWidget.tsx: the response is
        // { chokepoints: [{ id, name, totalVessels, tankerCount }] }.
        setChokepoints(
          (data.chokepoints ?? []).map((c: { name: string; tankerCount: number; totalVessels: number }) => ({
            name: c.name,
            tankers: c.tankerCount,
            total: c.totalVessels,
          })),
        );
      } catch {
        // Leave the strip empty rather than failing the page.
      }
    }
    load();
    const interval = setInterval(load, 60 * 1000);
    return () => clearInterval(interval);
  }, []);
```

Replace the returned JSX from `<main …>` onward:

```tsx
      <main className="flex-1 grid grid-cols-[1fr_320px] overflow-hidden max-lg:flex max-lg:flex-col">
        <ErrorBoundary>
          {/* Mobile: the map fills everything between the header and the sheet.
              It no longer needs min-h, because main no longer scrolls. */}
          <div className="relative overflow-hidden max-lg:flex-1 max-lg:min-h-0">
            <VesselMap />
            <MapFilterChips />
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div
            data-testid="panel-rail"
            className="max-lg:hidden flex flex-col overflow-y-auto bg-black border-l border-amber-500/20 divide-y divide-amber-500/10"
          >
            <ClusterPanel />
            {selectedVessel && <VesselPanel />}
            <WatchlistPanel />
            <OilPricePanel />
            <NewsPanel />
          </div>
        </ErrorBoundary>
      </main>

      <MobileSheet chokepoints={chokepoints} collapsed={!!selectedVessel}>
        {{ prices: <OilPricePanel />, intel: <NewsPanel /> }}
      </MobileSheet>

      {/* Sits above the bottom nav. At bottom-0 the nav would cover its
          controls, and the two would fight for the same edge. */}
      {selectedVessel && (
        <div
          data-testid="vessel-sheet"
          className="hidden max-lg:block fixed inset-x-0 bottom-[var(--straits-nav-h)] z-40 max-h-[60dvh] overflow-y-auto bg-black border-t border-amber-500/40 shadow-[0_-8px_24px_rgba(0,0,0,0.8)]"
        >
          <VesselPanel />
        </div>
      )}
```

Note the root `<div className="h-dvh flex flex-col bg-black">` and the `<Header …>` above stay exactly as they are.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(protected)/dashboard/page.test.tsx"`
Expected: PASS — 5 tests

- [ ] **Step 5: Re-confirm the `/api/chokepoints` field names**

Run: `grep -n "totalVessels\|tankerCount" src/components/ui/ChokepointWidget.tsx`
Expected: the `ChokepointData` interface declares `totalVessels: number` and `tankerCount: number`. If it does not, fix the mapping in Step 3 to match — never change the route.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(protected)/dashboard/page.tsx" "src/app/(protected)/dashboard/page.test.tsx"
git commit -m "feat(dashboard): move panels into the mobile sheet"
```

---

## Task 10: Measured verification suite

**Files:**
- Create: `scripts/verify-dashboard-layout.mjs`
- Modify: `package.json` — add `"verify:dashboard": "node scripts/verify-dashboard-layout.mjs"`

**Interfaces:**
- Consumes: a running server. Defaults to `http://localhost:3000`; override with `BASE_URL`.

Implements every numbered assertion in the spec's Verification section.

- [ ] **Step 1: Write the script**

```js
/**
 * Measured verification for the mobile dashboard app shell.
 *
 * Screenshots are not evidence on this project — a prior audit produced 105
 * findings and still missed four user-visible defects, because a screenshot
 * cannot show below-the-fold content or post-interaction state. Every check
 * here is a number pulled from the live DOM.
 *
 * Usage: npm run verify:dashboard        (requires npm run dev on :3000)
 *        BASE_URL=https://straits.randyren.org npm run verify:dashboard
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const VIEWPORTS = [[390, 844], [360, 800]];
const ROUTES = ['/dashboard', '/fleet', '/analytics', '/about'];
const MAX_CHROME = 110;
const VISIBLE_HEADLINES = 8;

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
};

/** Every control must be the topmost element at its own centre. A correctly
 *  sized button under a transparent overlay is unreachable, and no size check
 *  can see that. */
async function hitTestable(page) {
  return page.evaluate(() => {
    const blocked = [];
    for (const el of document.querySelectorAll('a,button,[role=tab],input,select')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue;
      const top = document.elementFromPoint(cx, cy);
      if (top && !el.contains(top) && !top.contains(el)) {
        blocked.push(`${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)} under ${top.tagName}.${top.className}`.slice(0, 90));
      }
    }
    return blocked;
  });
}

async function run() {
  const browser = await chromium.launch();

  for (const [w, h] of VIEWPORTS) {
    for (const route of ROUTES) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForSelector('nav[aria-label="Primary"]', { timeout: 30000 });
      const tag = `${route}@${w}x${h}`;

      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const hdr = document.querySelector('header');
        const nav = document.querySelector('nav[aria-label="Primary"]');
        const navRect = nav.getBoundingClientRect();
        return {
          chrome: Math.round((hdr ? hdr.getBoundingClientRect().height : 0) + navRect.height),
          navTop: Math.round(navRect.top),
          navBottom: Math.round(navRect.bottom),
          ovfX: de.scrollWidth - window.innerWidth,
          scrollH: de.scrollHeight,
          viewH: window.innerHeight,
          small: [...document.querySelectorAll('a,button,[role=tab],input')]
            .map((e) => ({ t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 22), r: e.getBoundingClientRect() }))
            .filter((o) => o.r.width > 0 && o.r.height > 0 && (o.r.width < 44 || o.r.height < 44))
            .filter((o) => !o.t.includes('CARTO') && !o.t.includes('OpenStreetMap'))
            .map((o) => `${o.t}(${Math.round(o.r.width)}x${Math.round(o.r.height)})`),
        };
      });

      // 1 + 10: chrome budget, and navigation present and on screen.
      check(`${tag}: fixed chrome`, m.chrome <= MAX_CHROME, `${m.chrome}px (limit ${MAX_CHROME})`);
      check(`${tag}: bottom nav on screen`, m.navBottom <= h + 1 && m.navTop < h, `nav spans y=${m.navTop}..${m.navBottom}, viewport ${h}`);

      // 3: horizontal overflow.
      check(`${tag}: no horizontal overflow`, m.ovfX === 0, `${m.ovfX}px`);

      // 4: tap targets.
      check(`${tag}: tap targets >= 44px`, m.small.length === 0, m.small.length ? m.small.join(', ') : 'all pass');

      // 5: nothing is covered by an overlay.
      const blocked = await hitTestable(page);
      check(`${tag}: controls hit-testable`, blocked.length === 0, blocked.length ? blocked.join('; ') : 'none covered');

      // 6: exactly one instance of each duplicated control is exposed.
      const dupes = await page.evaluate(() => {
        const count = (sel) => [...document.querySelectorAll(sel)].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }).length;
        return {
          bell: count('[aria-label*="Notification" i]'),
          status: count('[data-testid^="status-chip"]'),
        };
      });
      check(`${tag}: one visible notification bell`, dupes.bell === 1, `${dupes.bell} visible`);
      check(`${tag}: one visible status element`, dupes.status === 1, `${dupes.status} visible`);

      if (route === '/dashboard') {
        // 2: total height.
        const screens = +(m.scrollH / m.viewH).toFixed(2);
        check(`${tag}: total height`, screens <= 1.0, `${screens} screens`);

        // 7: the sheet cycles and its tabs are clickable in each open detent.
        const sheet = page.locator('[data-testid="mobile-sheet"]');
        const handle = page.locator('[data-testid="mobile-sheet"] button[aria-expanded]').first();
        const detents = [];
        for (let i = 0; i < 3; i++) {
          await handle.click();
          await page.waitForTimeout(320);
          detents.push(await sheet.getAttribute('data-detent'));
          if (i < 2) {
            const tab = page.locator('[role="tab"]', { hasText: 'Prices' });
            const clickable = await tab.count() > 0 && await tab.isEnabled();
            check(`${tag}: tabs reachable at detent ${detents[i]}`, clickable, `Prices tab ${clickable ? 'clickable' : 'NOT clickable'}`);
          }
        }
        check(`${tag}: sheet cycles detents`, JSON.stringify(detents) === '["half","full","peek"]', detents.join(' -> '));

        // 9: intel cap.
        await handle.click();
        await page.waitForTimeout(320);
        await page.click('[role="tab"]:has-text("Intel")');
        await page.waitForTimeout(400);
        const items = await page.$$eval('[role="tabpanel"] a[href^="http"]', (a) => a.length);
        check(`${tag}: intel capped`, items > 0 && items <= VISIBLE_HEADLINES, `${items} items (cap ${VISIBLE_HEADLINES})`);
      }

      await page.close();
    }
  }

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed against ${BASE}`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add the npm script**

In `package.json`, after the `"verify:fleet"` line:

```json
    "verify:dashboard": "node scripts/verify-dashboard-layout.mjs",
```

- [ ] **Step 3: Run it against a dev server**

```bash
npm run dev &
sleep 15
npm run verify:dashboard
```
Expected: every check passes. Any failure is a real defect — fix the component, never the threshold.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-dashboard-layout.mjs package.json
git commit -m "test(dashboard): add measured mobile layout verification"
```

---

## Task 11: Full regression and desktop baseline

**Files:** none created; this task only runs checks and fixes what they surface.

- [ ] **Step 1: Unit suite, lint, typecheck**

```bash
npx vitest run && npx eslint src/ && npx tsc --noEmit
```
Expected: all pass, both commands exit 0.

- [ ] **Step 2: Desktop geometry unchanged**

```bash
node scripts/ui-audit.mjs desktop
```
Expected: `OK desktop …` for every route. A diff here means a `max-lg:` gate leaked into desktop — fix the gate.

- [ ] **Step 3: Existing mobile detectors still clean**

```bash
node scripts/ui-audit.mjs reach && node scripts/ui-audit.mjs hscroll && node scripts/ui-audit.mjs targets
```
Expected: no `FAIL` lines.

- [ ] **Step 4: Fleet page unaffected**

```bash
npm run verify:fleet
```
Expected: the same pass count as before this branch. The bottom nav adds 56px of fixed chrome to `/fleet`; if a height threshold trips, the fix is the `max-lg:pb-[calc(var(--straits-nav-h)+1rem)]` from Task 8, not a threshold change.

- [ ] **Step 5: Dashboard verification**

```bash
npm run verify:dashboard
```
Expected: all checks pass.

- [ ] **Step 6: Close the two open live-site questions from the spec**

With the dev server running, confirm on `/dashboard` at 390×844:

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  await p.goto('http://localhost:3000/dashboard', { waitUntil:'networkidle' });
  await p.waitForTimeout(3000);
  await p.click('[aria-label=\"Search vessels\"]');
  await p.waitForTimeout(300);
  await p.fill('input[placeholder*=\"Search\"]', 'a');
  await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => {
    const box = document.querySelector('[data-testid=\"mobile-search\"] ul, [data-testid=\"mobile-search\"] [role=listbox], [data-testid=\"mobile-search\"] div[class*=absolute]');
    if (!box) return { dropdown: 'none rendered' };
    const r = box.getBoundingClientRect();
    let el = box.parentElement, clip = null;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (/auto|hidden|scroll/.test(cs.overflowX + cs.overflowY)) {
        clip = { tag: el.tagName, bottom: Math.round(el.getBoundingClientRect().bottom) }; break;
      }
      el = el.parentElement;
    }
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), viewportH: innerHeight, clip };
  }));
  await b.close();
})();"
```

Record the result. If the dropdown's `bottom` exceeds its clipping ancestor's `bottom`, it is being cut off — fix by rendering it outside that ancestor, **never** by adding `overflow-*: auto`, which creates a new clipping context and caused a previously shipped invisible-dropdown bug on this project.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix(dashboard): close defects found in final regression"
```

---

## Self-Review

**Spec coverage.** D1 → Task 8. D2 → Task 11 Step 2. D3 → Task 4 + Task 7 (dual instances) and Task 10 check 6. D4 → Task 6 (`collapsed` prop) + Task 9. D5 → Task 3. D6 → Task 5. D7 → Task 7 (`header-chokepoints` hidden) + Task 6 (peek strip and tab). Verification items 1–11 → Task 10 checks and Task 11 steps. Out-of-scope items are named in the spec and no task touches them.

**Two things worth flagging to the reviewer.**

1. Task 3 deletes `StatusBar.tsx` and edits `Header.tsx` in the same commit, which crosses the task boundary — the alternative is leaving `main` with a broken import between Task 3 and Task 7. Fixing the import where the deletion happens is the lesser evil; Task 7 then rewrites that region wholesale.

2. Task 9's chokepoint field mapping was initially inferred as `totalCount` and was **wrong** — the real field is `totalVessels`, confirmed against `ChokepointWidget.tsx`'s `ChokepointData` interface. The plan now carries the verified names, and Step 5 re-checks them because a silent mismatch renders `undefined` in the peek strip.

**Type consistency.** `Detent` is defined in Task 1 and imported in Task 6. `Chokepoint` is exported from `MobileSheet` (Task 6) and imported in Task 9. `VISIBLE_HEADLINES` is exported in Task 5 and referenced by the Task 10 script as a literal `8` — the script cannot import from `src/`, so the number is duplicated there deliberately, with the test in Task 5 asserting `VISIBLE_HEADLINES === 8` to keep them locked together.
