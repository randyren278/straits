# S01: Anomalies Staleness Filter & Data Parity — Research

**Date:** 2026-03-26
**Depth:** Light — straightforward application of an established codebase pattern

## Summary

The anomalies API route (`/api/anomalies`) lost its EXISTS staleness subquery during a prior refactor. It currently returns all unresolved anomalies regardless of whether the vessel has been seen recently. The map's vessel source (`/api/vessels` → `getVesselsWithSanctions()`) already filters to 7-day position recency, creating a mismatch: the fleet tab shows anomalies for vessels that don't appear on the map.

The fix is a single EXISTS subquery addition using the IMO→MMSI bridge join pattern already documented in KNOWLEDGE.md and already applied in `sanctions.ts` and `chokepoints.ts`. No new patterns, libraries, or architectural decisions needed.

Requirements R001 (vessel staleness) and R002 (chokepoint staleness) need re-validation — the constants are already correctly imported and used in `sanctions.ts`, `positions.ts`, and `chokepoints.ts`. R003 (anomaly staleness) is the primary deliverable.

## Recommendation

Add an EXISTS subquery to the anomalies route SQL, importing `VESSEL_STALENESS_INTERVAL` from `src/lib/constants/staleness.ts`. Use the exact pattern from KNOWLEDGE.md (IMO→MMSI bridge join with NULL guard). Then re-validate R001/R002 by confirming the existing code uses the constant correctly (already verified in this research — just needs formal `rg` audit in the task).

## Implementation Landscape

### Key Files

- `src/app/api/anomalies/route.ts` — **the file to change.** Currently 56 lines. Needs: (1) import `VESSEL_STALENESS_INTERVAL`, (2) add EXISTS subquery after the `WHERE va.resolved_at IS NULL` clause and before the optional `shipTypeClause` / `imo` filter.
- `src/lib/constants/staleness.ts` — source of truth for `VESSEL_STALENESS_INTERVAL = '7 days'`. Read-only for this slice.
- `src/lib/db/sanctions.ts` — reference implementation. `getVesselsWithSanctions()` at line ~165 shows how the staleness interval is used in a subquery against `vessel_positions`. Pattern to follow.
- `src/lib/db/positions.ts` — `getLatestPositions()` uses `VESSEL_STALENESS_INTERVAL` for the map's vessel list. This is what defines "vessels visible on the map."
- `src/lib/geo/chokepoints.ts` — already correctly uses `CHOKEPOINT_STALENESS_INTERVAL`. Read-only for this slice, but confirms R002 is met.
- `src/app/api/vessels/route.ts` — the map's data endpoint. Calls `getVesselsWithSanctions()`. This is the "vessel IMOs" side of the "anomaly IMOs ⊆ vessel IMOs" acceptance check.

### Build Order

1. **Add the EXISTS subquery to anomalies route** — this is the only code change. The subquery joins `vessel_positions` → `vessels` to check that the anomaly's IMO has a recent position within the staleness window.
2. **Run `rg` staleness audit** — confirm no hardcoded intervals remain in display queries. This re-validates R001, R002, R004.
3. **Verify with curl comparison** — fetch `/api/anomalies` and `/api/vessels`, extract IMO sets, confirm anomaly IMOs ⊆ vessel IMOs.

### Verification Approach

1. **TypeScript compilation:** `npx tsc --noEmit` — confirms the import and string interpolation are correct.
2. **Staleness audit:** `rg "STALENESS_INTERVAL" src/` — confirms anomalies route now appears in the list, no new hardcoded intervals.
3. **Curl parity check (requires running DB):** If the dev environment is available:
   ```bash
   # Get anomaly IMOs
   curl -s localhost:3000/api/anomalies | jq '[.anomalies[].imo] | unique'
   # Get vessel IMOs  
   curl -s localhost:3000/api/vessels | jq '[.vessels[].imo // empty] | unique'
   # Confirm anomaly IMOs ⊆ vessel IMOs
   ```
   If DB is not available, the `rg` audit + TypeScript check are sufficient — the SQL pattern is proven in three other files.

## Constraints

- The EXISTS subquery must use template literal interpolation for the interval (`'${VESSEL_STALENESS_INTERVAL}'`), matching the pattern in `sanctions.ts` and `positions.ts`. This is safe because the constant is a compile-time string, not user input.
- The `AND v2.imo IS NOT NULL` guard in the EXISTS subquery is required — some vessels have NULL IMO and can't be correlated through the bridge join.
- Detection intervals in `src/lib/detection/` must not be touched (R005, validated).
- Analytics windows in `src/lib/db/analytics.ts` must not be touched (R006, validated).

## Common Pitfalls

- **Placing the EXISTS after optional clauses** — the subquery must go in the base WHERE before `${shipTypeClause}` and the optional `imo` parameter, so it always applies regardless of filters.
- **Using IN instead of EXISTS** — IN with a subquery can cause row multiplication when vessels have multiple positions. EXISTS short-circuits on first match.
