# S01: Anomalies Staleness Filter & Data Parity

**Goal:** Fleet tab only shows anomalies for vessels with recent position data (within VESSEL_STALENESS_INTERVAL), matching the map's vessel visibility window.
**Demo:** After this: Fleet tab only shows anomalies for vessels visible on the map. curl comparison confirms anomaly IMOs ⊆ vessel IMOs.

## Tasks
- [x] **T01: Added EXISTS staleness subquery to /api/anomalies using IMO→MMSI bridge join so anomalies only return for vessels with positions within VESSEL_STALENESS_INTERVAL** — The anomalies API route (`/api/anomalies`) returns all unresolved anomalies regardless of vessel position recency. The map filters to vessels seen within 7 days (`VESSEL_STALENESS_INTERVAL`), creating a data parity gap: the fleet tab shows anomalies for vessels that don't appear on the map.

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
  - Estimate: 20m
  - Files: src/app/api/anomalies/route.ts, src/lib/constants/staleness.ts
  - Verify: npx tsc --noEmit && rg 'STALENESS_INTERVAL' src/ | grep -q 'anomalies/route.ts'
