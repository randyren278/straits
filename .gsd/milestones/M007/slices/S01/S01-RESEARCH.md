# S01 — Research

**Date:** 2026-03-20

## Summary

This slice is straightforward UI work with zero unknowns. The `AnomalyTable` component already has a collapsible toggle via `useState<boolean>(true)` — changing that default to `false` is a one-line edit. The sanctioned vessels list is a new component that filters the existing `anomalies` array (already fetched in `FleetPage`) for `isSanctioned === true`, which the `/api/anomalies` endpoint already returns via a `LEFT JOIN` on the sanctions table.

No new API work, no new data fetching, no new state management. Both changes are purely presentational, operating on data that's already available in the page component.

## Recommendation

Two tasks: (1) flip the default expanded state in `AnomalyTable`, (2) create a `SanctionedVessels` component and wire it into `FleetPage` above the anomaly groups. Follow the existing Bloomberg terminal aesthetic exactly — `border border-amber-500/20`, `bg-black`, `font-mono`, `text-xs uppercase tracking-widest`. Use the same table column pattern from `AnomalyTable` for visual consistency.

## Implementation Landscape

### Key Files

- `src/components/fleet/AnomalyTable.tsx` — Line 49: `useState<boolean>(true)` → change to `false`. That's the entire change for default-collapsed behavior.
- `src/app/(protected)/fleet/page.tsx` — The page component that fetches anomalies and renders grouped `AnomalyTable`s. Needs: (a) filter sanctioned anomalies from the `anomalies` state, (b) render the new `SanctionedVessels` component above the anomaly groups, (c) deduplicate sanctioned vessels by IMO (a vessel may have multiple anomalies).
- `src/components/fleet/SanctionedVessels.tsx` — **New file.** A terminal-style panel listing sanctioned vessels. Receives a deduplicated array of sanctioned anomaly records. Displays: vessel name, IMO, flag, risk score, sanction risk category. Should use a red/amber accent to visually distinguish from standard anomaly tables (e.g. `border-red-500/30` header accent, `text-red-400` label).
- `src/types/anomaly.ts` — Already has `isSanctioned?: boolean` and `sanctionRiskCategory?: string | null` on the `Anomaly` interface. No changes needed.
- `src/app/api/anomalies/route.ts` — Already returns `isSanctioned` and `sanctionRiskCategory` via SQL JOIN. No changes needed.

### Build Order

1. **Task 1: Default-collapse `AnomalyTable`** — One-line change in `AnomalyTable.tsx`. Can be verified independently.
2. **Task 2: `SanctionedVessels` component + page wiring** — Create the new component, then update `FleetPage` to filter and render it above the anomaly groups. The deduplication logic (group by IMO, pick the most recent anomaly or aggregate) goes in `FleetPage`.

These two tasks are independent and can be built in parallel.

### Verification Approach

1. Load `/fleet` in the browser — all anomaly tables should render collapsed (only headers visible, chevrons pointing right).
2. Click a table header — it should expand to show the table rows.
3. If any sanctioned vessels exist in the DB, the "Sanctioned Vessels" section should appear at the top with red accent styling, above all anomaly groups.
4. If no sanctioned vessels exist, the section should either not render or show an empty state.
5. TypeScript compilation: `npx tsc --noEmit` should pass with no new errors.
