# S02 — Research

**Date:** 2026-03-20

## Summary

S02 requires two coordinated changes: a backend API enrichment (adding `shipCategory` to the `/api/anomalies` response) and a new `AnomalyMatrix` frontend component (a grid of Ship Type rows × Anomaly Type columns with amber luminescence scaled by count).

The API change is mechanical — the `SELECT` in `src/app/api/anomalies/route.ts` already JOINs `vessels v` and the `ship_type` classification logic (80-89 = tanker, 70-79 = cargo, else other) already exists in the same file as a filter clause. It just needs a `CASE` expression in the `SELECT` list. The frontend component is a pure display grid that aggregates the anomalies array client-side by `shipCategory × anomalyType`, rendering counts in cells with Tailwind opacity/brightness classes scaled to density. No new libraries needed.

## Recommendation

Build backend-first: add `shipCategory` to the SQL query and the `Anomaly` TypeScript type, then build the `AnomalyMatrix` component that consumes it. The API change is the risk-retiring step (proves the data flows), and the component is pure presentation that can be tested with mock data independent of the API.

## Implementation Landscape

### Key Files

- `src/app/api/anomalies/route.ts` — The SQL query needs a new `CASE` expression in the `SELECT` list to map `v.ship_type` to `'tanker' | 'cargo' | 'other'`. The classification logic already exists in lines 14-22 as `shipTypeClause` for the `WHERE` filter — reuse the same ranges. The column alias should be `"shipCategory"` to match the TypeScript interface.

- `src/types/anomaly.ts` — Add `shipCategory?: 'tanker' | 'cargo' | 'other'` to the `Anomaly` interface. Keep it optional (`?`) since existing anomalies in the DB may have vessels with no `ship_type`. Also export a `ShipCategory` type alias for reuse.

- `src/components/fleet/AnomalyMatrix.tsx` — **New file.** A pure component receiving `anomalies: Anomaly[]`. Aggregates into a `Map<ShipCategory, Map<AnomalyType, number>>`, renders a `<table>` grid. Rows = Ship Types (Tanker, Cargo, Other), Columns = Anomaly Types (6 types from `AnomalyType`). Cell brightness mapped to count via Tailwind classes (e.g. `bg-amber-500/10` for 0, scaling through `/20`, `/40`, `/60`, `/80` for higher counts). Returns `null` if anomalies array is empty.

- `src/app/(protected)/fleet/page.tsx` — Import and render `<AnomalyMatrix anomalies={anomalies} />`. Per S01 forward intelligence, it should slot between the `<SanctionedVessels>` panel and the anomaly group tables `<div>`. The existing JSX structure (lines 107-119) has `<SanctionedVessels>` then `<div className="space-y-4">` with the tables — insert `<AnomalyMatrix>` between them.

- `src/components/fleet/__tests__/AnomalyMatrix.test.tsx` — **New file.** Tests: correct grid dimensions (3 rows × 6 columns), accurate count aggregation, brightness scaling, empty state (returns null), handling of anomalies with missing `shipCategory` (should fall into "other").

### Build Order

1. **T01: API + Type enrichment** — Add `shipCategory` to the SQL `CASE` expression in `route.ts` and the `Anomaly` interface in `anomaly.ts`. This retires the "API Data Completeness" risk from the roadmap. Verify with `npx tsc --noEmit` and by inspecting the SQL output shape.

2. **T02: AnomalyMatrix component + integration** — Build the component, write tests, and wire it into `FleetPage`. The component is a pure function of props — tests use mock `Anomaly[]` data and don't need the API. Verify with `npx vitest run src/components/fleet/__tests__/AnomalyMatrix.test.tsx` and `npx tsc --noEmit`.

### Verification Approach

- `npx tsc --noEmit` — zero type errors after adding `shipCategory` field.
- `npx vitest run src/components/fleet/__tests__/AnomalyMatrix.test.tsx` — all matrix tests pass.
- `npx vitest run src/components/fleet/__tests__/` — all 12 existing S01 tests still pass (regression).
- Manual/visual: the matrix renders a 3×6 grid with amber cells, positioned between sanctions panel and anomaly tables.

## Constraints

- The `Anomaly` type's `shipCategory` must be optional (`?`) — the `vessels` table allows `ship_type` to be `NULL` (`INTEGER` with no `NOT NULL`), so the SQL `CASE` can produce `'other'` for NULL, but keeping the field optional guards against any rows where the JOIN yields no vessel match.
- Tailwind v4 is in use — no `tailwind.config.js` safelist needed; all classes used inline will be detected by the scanner.
- The `ANOMALY_TYPE_LABELS` constant in `AnomalyTable.tsx` is local/non-exported. The matrix component needs the same labels — extract to a shared location or duplicate. Duplication is simpler and the map is small (6 entries); a shared constant is cleaner. Recommend extracting to `src/types/anomaly.ts` or a new `src/components/fleet/constants.ts`.

## Common Pitfalls

- **Amber opacity scaling with Tailwind v4** — Tailwind v4 supports arbitrary values like `bg-amber-500/[0.15]` but dynamically constructing class names (e.g. `` `bg-amber-500/${opacity}` ``) won't be detected by the scanner. Pre-define a set of fixed classes (e.g. an array of 5 tiers) and select by count threshold. Never concatenate Tailwind class fragments at runtime.
- **Missing `shipCategory` in existing tests** — S01's `AnomalyTable.test.tsx` and `SanctionedVessels.test.tsx` use mock `Anomaly` objects without `shipCategory`. Since the field is optional, existing tests won't break, but new mock data for matrix tests should include it.
- **Column header abbreviation** — 6 anomaly type columns + a row header = 7 columns. With full labels ("Repeat Going Dark", "STS Transfer"), the grid may overflow on narrow viewports. Use abbreviated labels (the `AnomalyBadge` already has short forms: DARK, LOITER, ROUTE, DRIFT, REPEAT, STS) or truncate with `truncate` CSS class.
