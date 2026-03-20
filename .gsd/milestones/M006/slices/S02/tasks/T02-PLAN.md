---
estimated_steps: 4
estimated_files: 1
---

# T02: Wire click-to-expand in AnomalyTable and verify full integration

**Slice:** S02 — Inline Vessel Detail & Map Navigation
**Milestone:** M006

## Description

Add click-to-expand behavior to AnomalyTable rows so clicking a vessel row toggles an inline FleetVesselDetail component below it. Only one row should be expanded at a time. This task completes the slice by connecting the FleetVesselDetail component (built in T01) into the fleet page tables and running full build + test verification.

**Relevant skills:** `react-best-practices`

## Steps

1. **Add expansion state to AnomalyTable**:
   - Add `expandedImo: string | null` state via `useState<string | null>(null)` — only one row expanded at a time
   - Import `FleetVesselDetail` from `@/components/fleet/FleetVesselDetail`

2. **Wire click handler on table rows**:
   - Add `onClick` handler to each `<tr>` in the tbody:
     ```
     onClick={() => setExpandedImo(prev => prev === anomaly.imo ? null : anomaly.imo)}
     ```
   - Add `cursor-pointer` class to the `<tr>`
   - Add a selected highlight: when `expandedImo === anomaly.imo`, apply `bg-amber-500/10` instead of the default hover style
   - Ensure the `<tr>` still has its existing `data-imo` and `data-anomaly-id` attributes

3. **Render FleetVesselDetail in expansion row**:
   - After each data `<tr>`, conditionally render a second `<tr>` when `expandedImo === anomaly.imo`:
     ```tsx
     {expandedImo === anomaly.imo && (
       <tr className="border-t border-amber-500/10">
         <td colSpan={6} className="p-0">
           <FleetVesselDetail
             imo={anomaly.imo}
             anomalyDetails={anomaly.details}
             anomalyType={anomaly.anomalyType}
           />
         </td>
       </tr>
     )}
     ```
   - The `colSpan={6}` spans all 6 columns (Vessel Name, IMO, Flag, Risk Score, Confidence, Detected)
   - Use `p-0` on the `<td>` so FleetVesselDetail controls its own padding

4. **Run full verification suite**:
   - `npm run build` — must succeed with zero errors, `/fleet` page in output
   - `npx vitest run` — all existing tests (379+) must pass
   - Structural checks:
     - `grep -q 'expandedImo' src/components/fleet/AnomalyTable.tsx`
     - `grep -q 'FleetVesselDetail' src/components/fleet/AnomalyTable.tsx`
     - `grep -q 'colSpan' src/components/fleet/AnomalyTable.tsx`

## Must-Haves

- [ ] `expandedImo` state tracks which row is expanded (null = none)
- [ ] Clicking a row toggles expansion (same row → collapse, different row → switch)
- [ ] Expanded detail renders in a full-width `<tr>` below the clicked row
- [ ] FleetVesselDetail receives `imo`, `anomalyDetails`, and `anomalyType` props
- [ ] Build succeeds with zero TypeScript errors
- [ ] All existing tests (379+) pass

## Verification

- `npm run build` — zero errors, `/fleet` in build output
- `npx vitest run` — 379+ tests pass, 0 failures
- `grep -q 'expandedImo' src/components/fleet/AnomalyTable.tsx` — expansion state present
- `grep -q 'FleetVesselDetail' src/components/fleet/AnomalyTable.tsx` — component imported and used
- `grep -q 'colSpan' src/components/fleet/AnomalyTable.tsx` — full-width expansion row

## Inputs

- `src/components/fleet/FleetVesselDetail.tsx` — Component built in T01. Expects props: `imo: string`, `anomalyDetails: Anomaly['details']`, `anomalyType: AnomalyType`. Renders the full intelligence dossier with "Show on Map" button.
- `src/components/fleet/AnomalyTable.tsx` — Current state: renders vessel rows with `data-imo` and `data-anomaly-id` attributes, has `expanded` boolean state for section collapse, uses `anomalies: Anomaly[]` prop. The `anomalies` array contains full `details` objects per row.
- `src/types/anomaly.ts` — `AnomalyType` type needed for the `anomalyType` prop.

## Expected Output

- `src/components/fleet/AnomalyTable.tsx` — Modified with `expandedImo` state, click handlers on rows, and conditional FleetVesselDetail rendering in expansion `<tr>`. ~30 lines added.
