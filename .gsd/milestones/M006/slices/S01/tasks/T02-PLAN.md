---
estimated_steps: 5
estimated_files: 3
---

# T02: Build Fleet page with anomaly-grouped tables and header nav tab

**Slice:** S01 — Default All-Vessels & Fleet Page with Anomaly Tables
**Milestone:** M006

## Description

Create the Fleet page at `/fleet` and the `AnomalyTable` component, then add a "Fleet" tab to the Header navigation. The Fleet page fetches anomalies from `/api/anomalies` (which now returns `vesselName`, `flag`, `riskScore` from T01), groups them by `anomalyType`, and renders collapsible tables per group.

**Relevant skills to load:** `frontend-design` (terminal aesthetic), `react-best-practices` (component patterns).

Follow the existing page pattern: `'use client'` component that renders its own `<Header>` and fetches data via `useEffect` + `useState`. Use the terminal aesthetic: `bg-black`, amber accents (`text-amber-500`, `border-amber-500/20`), `font-mono`, uppercase `tracking-widest` labels, no border-radius (D014).

## Steps

1. **Add Fleet tab to Header** — Edit `src/components/ui/Header.tsx`:
   - Update `activeTab` logic: `pathname === '/fleet' ? 'fleet' : ...` (add before the existing ternary chain)
   - Add a new `<Link href="/fleet">` nav element for "Fleet" tab between "Analytics" and "About", using the same conditional styling pattern as the existing tabs
   - The Header component does not need any prop changes — the Fleet page doesn't need `onSearchSelect` or `onChokepointSelect`

2. **Create AnomalyTable component** — New file `src/components/fleet/AnomalyTable.tsx`:
   - Props: `anomalyType: AnomalyType`, `anomalies: Anomaly[]` (the `Anomaly` type from `@/types/anomaly` — now includes `vesselName`, `flag`, `riskScore`)
   - Render a collapsible section: header shows `AnomalyBadge` + count + chevron toggle
   - Table columns: Vessel Name, IMO, Flag (country code), Risk Score (0–100 or "—"), Detected (formatted timestamp)
   - Use `AnomalyBadge` from `@/components/ui/AnomalyBadge` for the section header
   - Style: `bg-black` background, `border-amber-500/20` borders, `text-gray-300` body text, `text-amber-500` for headers
   - Each row must render all anomaly data so S02 can add click handlers without restructuring
   - Collapsible state via local `useState<boolean>(true)` (default expanded)
   - Import `ChevronDown`/`ChevronRight` from `lucide-react` for toggle icon

3. **Create Fleet page** — New file `src/app/(protected)/fleet/page.tsx`:
   - `'use client'` directive at top
   - Import and render `<Header />` (no props needed — Fleet page doesn't use search or chokepoint callbacks)
   - `useEffect` fetches `GET /api/anomalies` on mount → `useState` for anomalies array, loading, error
   - Group anomalies by `anomalyType` using a `Map<string, Anomaly[]>` or `Object.groupBy` equivalent (use reduce for compatibility)
   - Render one `<AnomalyTable>` per group, ordered by count descending (busiest anomaly type first)
   - Loading state: show "LOADING FLEET DATA..." in amber monospace
   - Error state: show error message in red with retry suggestion
   - Empty state: show "NO ACTIVE ANOMALIES DETECTED" message
   - Page title area: "FLEET OVERVIEW" in amber uppercase tracking-widest, with subtitle showing total anomaly count

4. **Verify build** — Run `npm run build` to confirm TypeScript compiles with no errors across all new and modified files.

5. **Run existing tests** — Run `npx vitest run` to confirm no regressions.

## Must-Haves

- [ ] Header has "Fleet" tab linking to `/fleet` with correct active state styling
- [ ] Fleet page at `src/app/(protected)/fleet/page.tsx` fetches from `/api/anomalies` and groups by `anomalyType`
- [ ] `AnomalyTable` component at `src/components/fleet/AnomalyTable.tsx` renders collapsible table with columns: vessel name, IMO, flag, risk score, detection time
- [ ] Fleet page has loading, error, and empty states
- [ ] Terminal aesthetic followed: bg-black, amber accents, font-mono, uppercase labels, no border-radius
- [ ] `npm run build` passes
- [ ] All existing tests pass

## Verification

- `npm run build` exits 0
- `npx vitest run` exits 0
- `test -f src/app/\(protected\)/fleet/page.tsx` exits 0
- `test -f src/components/fleet/AnomalyTable.tsx` exits 0
- `grep -q "'/fleet'" src/components/ui/Header.tsx` exits 0
- `grep -q 'FLEET' src/app/\(protected\)/fleet/page.tsx` exits 0

## Inputs

- `src/components/ui/Header.tsx` — existing Header with Live Map, Analytics, About tabs. `activeTab` is a ternary: `pathname === '/analytics' ? 'analytics' : pathname === '/about' ? 'about' : 'dashboard'`. Add `/fleet` case.
- `src/types/anomaly.ts` — `Anomaly` interface (from T01) now has `vesselName?: string`, `flag?: string`, `riskScore?: number`
- `src/components/ui/AnomalyBadge.tsx` — existing badge component, accepts `type` (AnomalyType) and `confidence`, renders color-coded badge
- Existing page pattern from `src/app/(protected)/analytics/page.tsx` — `'use client'`, imports `Header`, uses `useEffect` + `useState` for data fetching
- Terminal aesthetic: `bg-black`, `text-amber-500` for accents, `font-mono`, `uppercase tracking-widest` for labels, `border-amber-500/20` for borders. D014: no border-radius.

## Observability Impact

- **New signal**: Fleet page logs fetch errors via `console.error('Fleet page fetch error:', err)` — visible in browser DevTools console
- **Error state UI**: When `/api/anomalies` returns non-200, Fleet page renders red-bordered error message with the API error text — no blank screen or crash
- **Inspection**: Navigate to `/fleet` in browser → verify anomaly tables render grouped by type with vessel metadata columns
- **Failure visibility**: If API is down, Fleet page shows `ERROR: ...` message with retry suggestion text

## Expected Output

- `src/components/ui/Header.tsx` — modified with Fleet tab and `activeTab` case for `/fleet`
- `src/app/(protected)/fleet/page.tsx` — new Fleet page component
- `src/components/fleet/AnomalyTable.tsx` — new collapsible anomaly table component
