# S01: Default-Collapsed Tables & Sanctions Priority List

**Goal:** Anomaly tables on `/fleet` default to collapsed, and a prominent "Sanctioned Vessels" section appears at the top of the page.
**Demo:** Load `/fleet` — all anomaly group tables are collapsed (chevron-right, no rows visible). Above them, a red-accented "SANCTIONED VESSELS" panel lists any vessels with `isSanctioned === true`, deduplicated by IMO.

## Must-Haves

- `AnomalyTable` initializes with `expanded = false` (collapsed by default).
- Clicking an `AnomalyTable` header still toggles it open/closed.
- A new `SanctionedVessels` component renders above the anomaly groups on the fleet page.
- `SanctionedVessels` filters from the existing `anomalies` state — no new API calls.
- Sanctioned vessels are deduplicated by IMO (a vessel with multiple anomalies appears once).
- The sanctioned section uses red accent styling (`border-red-500/30`, `text-red-400`) to visually distinguish from amber anomaly tables.
- The sanctioned section hides entirely when no sanctioned vessels exist.
- `npx tsc --noEmit` passes with zero new errors.

## Verification

- `npx tsc --noEmit` — TypeScript compilation passes.
- `npx vitest run src/components/fleet/__tests__/AnomalyTable.test.tsx` — AnomalyTable defaults to collapsed.
- `npx vitest run src/components/fleet/__tests__/SanctionedVessels.test.tsx` — SanctionedVessels renders, deduplicates, and hides when empty.

## Tasks

- [ ] **T01: Collapse AnomalyTable by default and add component test** `est:20m`
  - Why: Users visiting `/fleet` should see a dense overview without scrolling through expanded tables. Flipping the default state and adding a test locks the behavior.
  - Files: `src/components/fleet/AnomalyTable.tsx`, `src/components/fleet/__tests__/AnomalyTable.test.tsx`
  - Do: Change `useState<boolean>(true)` to `useState<boolean>(false)` on line ~49 of `AnomalyTable.tsx`. Create a Vitest + React Testing Library test that renders `AnomalyTable` with mock anomalies and asserts: (1) the table body is not visible by default, (2) clicking the header button expands it, (3) the `aria-expanded` attribute reflects the state. Follow the existing Vitest config (`environment: 'happy-dom'`, `@testing-library/react`).
  - Verify: `npx vitest run src/components/fleet/__tests__/AnomalyTable.test.tsx`
  - Done when: Test passes; `AnomalyTable` renders collapsed by default.

- [ ] **T02: Create SanctionedVessels component and wire into FleetPage** `est:30m`
  - Why: Sanctioned vessels are the highest-priority intelligence item and must be immediately visible at the top of the fleet overview, not buried inside anomaly groups.
  - Files: `src/components/fleet/SanctionedVessels.tsx`, `src/app/(protected)/fleet/page.tsx`, `src/components/fleet/__tests__/SanctionedVessels.test.tsx`
  - Do: (1) Create `SanctionedVessels.tsx` — a terminal-style panel that receives a deduplicated array of `Anomaly` records where `isSanctioned === true`. Display columns: vessel name, IMO, flag, risk score, sanction risk category. Use `border-red-500/30` border, `bg-black`, `text-red-400` header label, `font-mono text-xs uppercase tracking-widest` — matching Bloomberg aesthetic. If the array is empty, return `null` (render nothing). (2) In `FleetPage`, filter `anomalies` for `isSanctioned === true`, deduplicate by IMO (keep the entry with the highest `riskScore`, or first if tied), and render `<SanctionedVessels>` above the anomaly groups `<div>`. (3) Write a Vitest + RTL test for `SanctionedVessels`: renders vessel data, deduplicates by IMO, returns null for empty array. **Skill hint:** load `react-best-practices` skill for component patterns.
  - Verify: `npx vitest run src/components/fleet/__tests__/SanctionedVessels.test.tsx && npx tsc --noEmit`
  - Done when: SanctionedVessels renders at top of `/fleet` with red accent, deduplicates by IMO, hides when empty, TypeScript compiles clean.

## Files Likely Touched

- `src/components/fleet/AnomalyTable.tsx`
- `src/components/fleet/SanctionedVessels.tsx`
- `src/app/(protected)/fleet/page.tsx`
- `src/components/fleet/__tests__/AnomalyTable.test.tsx`
- `src/components/fleet/__tests__/SanctionedVessels.test.tsx`
