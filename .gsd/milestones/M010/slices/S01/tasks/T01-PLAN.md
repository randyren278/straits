---
estimated_steps: 23
estimated_files: 2
skills_used: []
---

# T01: Add EXISTS staleness subquery to anomalies API route

The anomalies API route (`/api/anomalies`) returns all unresolved anomalies regardless of vessel position recency. The map filters to vessels seen within 7 days (`VESSEL_STALENESS_INTERVAL`), creating a data parity gap: the fleet tab shows anomalies for vessels that don't appear on the map.

This task adds an EXISTS subquery to the anomalies route SQL using the IMO→MMSI bridge join pattern documented in KNOWLEDGE.md and already implemented in `sanctions.ts`, `positions.ts`, and `chokepoints.ts`.

**Steps:**
1. Read `src/app/api/anomalies/route.ts` to confirm current state (no staleness filter).
2. Add `import { VESSEL_STALENESS_INTERVAL } from '@/lib/constants/staleness';` at the top of the file.
3. Add an EXISTS subquery immediately after `WHERE va.resolved_at IS NULL` and before `${shipTypeClause}`. The subquery pattern (from KNOWLEDGE.md):
   ```sql
   AND EXISTS (
     SELECT 1 FROM vessel_positions vp2
     JOIN vessels v2 ON v2.mmsi = vp2.mmsi
     WHERE v2.imo = va.imo AND v2.imo IS NOT NULL
     AND vp2.time > NOW() - INTERVAL '${VESSEL_STALENESS_INTERVAL}'
   )
   ```
4. Run `npx tsc --noEmit` to confirm compilation.
5. Run `rg "STALENESS_INTERVAL" src/` to confirm anomalies route now appears in the staleness audit. Verify that `positions.ts`, `sanctions.ts`, `chokepoints.ts`, and `anomalies/route.ts` all appear. Verify that `src/lib/detection/` and `src/lib/db/analytics.ts` do NOT appear.
6. Verify `src/lib/detection/` files were not modified: `git diff --name-only src/lib/detection/` should show no changes.

**Constraints:**
- The EXISTS must go BEFORE `${shipTypeClause}` and the optional `imo` parameter so it always applies.
- Use EXISTS (not IN) to avoid row multiplication.
- Include `AND v2.imo IS NOT NULL` guard for vessels with NULL IMO.
- Use template literal interpolation `'${VESSEL_STALENESS_INTERVAL}'` — safe because the constant is a compile-time string.
- Do NOT modify any files in `src/lib/detection/` or `src/lib/db/analytics.ts`.

## Inputs

- ``src/app/api/anomalies/route.ts` — current anomalies route, missing staleness filter`
- ``src/lib/constants/staleness.ts` — source of truth for VESSEL_STALENESS_INTERVAL constant`
- ``src/lib/db/sanctions.ts` — reference implementation of EXISTS staleness subquery pattern`

## Expected Output

- ``src/app/api/anomalies/route.ts` — modified to import VESSEL_STALENESS_INTERVAL and include EXISTS subquery`

## Verification

npx tsc --noEmit && rg 'STALENESS_INTERVAL' src/ | grep -q 'anomalies/route.ts'
