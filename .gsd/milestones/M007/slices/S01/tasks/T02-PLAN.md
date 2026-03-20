---
estimated_steps: 5
estimated_files: 3
---

# T02: Create SanctionedVessels component and wire into FleetPage

**Slice:** S01 — Default-Collapsed Tables & Sanctions Priority List
**Milestone:** M007

## Description

Create a new `SanctionedVessels` component that displays a red-accented, terminal-style panel listing all sanctioned vessels. Wire it into the fleet page above the anomaly group tables. The component receives a pre-filtered, deduplicated array of `Anomaly` records — all filtering and deduplication logic lives in `FleetPage`.

No new API calls or backend changes are needed. The `/api/anomalies` endpoint already returns `isSanctioned` and `sanctionRiskCategory` fields via SQL JOIN.

**Relevant skill:** `react-best-practices` — load for component patterns.

## Steps

1. Create `src/components/fleet/SanctionedVessels.tsx`:
   - Props: `{ vessels: Anomaly[] }` — expects an already-deduplicated array of sanctioned anomaly records.
   - If `vessels.length === 0`, return `null` (render nothing).
   - Render a panel with Bloomberg terminal aesthetic:
     - Outer `div`: `border border-red-500/30 bg-black`
     - Header bar: `bg-gray-900/50 px-4 py-3` with a red dot indicator and `text-red-400 text-xs font-mono uppercase tracking-widest` label: "SANCTIONED VESSELS" with count `[{n}]`.
     - Table with columns: Vessel Name, IMO, Flag, Risk Score, Sanction Category.
     - Column headers: `text-xs font-mono uppercase tracking-widest text-red-400/70 font-normal`.
     - Row text: `text-sm font-mono text-gray-300` for vessel name, `text-gray-400` for other fields.
     - Risk score colored: `text-red-400` if ≥70, `text-amber-400` if ≥40, `text-green-400` otherwise.
   - Import `Anomaly` type from `@/types/anomaly`.

2. Update `src/app/(protected)/fleet/page.tsx`:
   - Import `SanctionedVessels` from `@/components/fleet/SanctionedVessels`.
   - After `const groups = groupByType(anomalies);`, compute the sanctioned vessels:
     ```ts
     const sanctionedVessels = (() => {
       const sanctioned = anomalies.filter(a => a.isSanctioned);
       const byImo = new Map<string, Anomaly>();
       for (const a of sanctioned) {
         const existing = byImo.get(a.imo);
         if (!existing || (a.riskScore ?? 0) > (existing.riskScore ?? 0)) {
           byImo.set(a.imo, a);
         }
       }
       return Array.from(byImo.values());
     })();
     ```
   - Render `<SanctionedVessels vessels={sanctionedVessels} />` inside the `{!loading && !error && anomalies.length > 0 && (...)}` block, **above** the `<div className="space-y-4">` that contains the anomaly groups. Wrap both in a fragment or add the SanctionedVessels before the existing div with a `mb-4` spacer if needed.

3. Create `src/components/fleet/__tests__/SanctionedVessels.test.tsx`:
   - Test 1: renders vessel data correctly — pass 2 mock sanctioned anomalies, assert vessel names and IMOs appear in the document.
   - Test 2: deduplicates by IMO — this tests the `FleetPage` dedup logic, so either test the dedup function directly or pass pre-deduped data and verify count.
   - Test 3: returns null for empty array — render with `vessels={[]}`, assert nothing is in the document (use `container.firstChild` is `null` or similar).
   - Test 4: displays count badge — assert `[2]` appears when 2 vessels passed.

4. Run tests and TypeScript check.

## Must-Haves

- [ ] `SanctionedVessels` component exists with red accent styling.
- [ ] Component returns `null` when no sanctioned vessels.
- [ ] `FleetPage` deduplicates sanctioned anomalies by IMO (keeps highest risk score).
- [ ] `SanctionedVessels` renders above anomaly groups on the fleet page.
- [ ] Component test file exists and passes.
- [ ] `npx tsc --noEmit` passes with no new errors.

## Verification

- `npx vitest run src/components/fleet/__tests__/SanctionedVessels.test.tsx` — all tests pass.
- `npx tsc --noEmit` — no type errors.
- `grep -q 'SanctionedVessels' src/app/\(protected\)/fleet/page.tsx` — component is wired into the page.

## Inputs

- `src/app/(protected)/fleet/page.tsx` — the fleet page to modify (add SanctionedVessels rendering)
- `src/types/anomaly.ts` — `Anomaly` type with `isSanctioned`, `sanctionRiskCategory`, `vesselName`, `flag`, `riskScore` fields
- `src/components/fleet/AnomalyTable.tsx` — reference for Bloomberg terminal styling patterns

## Expected Output

- `src/components/fleet/SanctionedVessels.tsx` — new component displaying sanctioned vessels
- `src/app/(protected)/fleet/page.tsx` — modified: imports SanctionedVessels, computes deduplicated list, renders above anomaly groups
- `src/components/fleet/__tests__/SanctionedVessels.test.tsx` — new test file validating rendering, empty state, and count display
