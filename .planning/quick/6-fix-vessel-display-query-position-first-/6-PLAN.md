---
phase: quick-6
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/sanctions.ts
  - src/stores/vessel.ts
  - src/lib/map/filter.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "Ships with positions but no IMO appear on the map"
    - "tankersOnly filter hides IMO-less vessels (unclassifiable)"
    - "tankersOnly is true on first page load"
  artifacts:
    - path: "src/lib/db/sanctions.ts"
      provides: "Position-first query with nullable vessel metadata"
    - path: "src/stores/vessel.ts"
      provides: "tankersOnly defaults to true"
  key_links:
    - from: "src/lib/db/sanctions.ts"
      to: "vessel_positions"
      via: "DISTINCT ON (mmsi) primary source"
      pattern: "SELECT DISTINCT ON \\(mmsi\\)"
---

<objective>
Fix two vessel display bugs: rewrite the DB query to source from vessel_positions first (so
IMO-less ships appear), and default tankersOnly to true so the app opens on tankers.

Purpose: Ships broadcasting PositionReport without prior ShipStaticData are currently invisible.
The map should show all vessels with recent positions, enriching with metadata where available.

Output: Updated sanctions.ts (position-first query + nullable types), updated vessel.ts store
default, updated filter.ts to handle null shipType.
</objective>

<execution_context>
@/Users/randyren/.claude/get-shit-done/workflows/execute-plan.md
@/Users/randyren/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite getVesselsWithSanctions to query position-first</name>
  <files>src/lib/db/sanctions.ts</files>
  <action>
Rewrite `getVesselsWithSanctions` in `src/lib/db/sanctions.ts`:

1. Change `VesselSanctionsRow` interface — make these fields nullable (they come from vessels v
   which may not match): `imo: string | null`, `name: string | null`, `flag: string | null`,
   `shipType: number | null`. Keep `mmsi: string` and position fields non-null (they are the
   primary source).

2. Change `VesselWithSanctions` — it extends `VesselWithPosition` which extends `Vessel`.
   `Vessel` has non-nullable imo/name/flag/shipType. Add an override interface that allows
   nullable vessel fields. The cleanest approach: do NOT extend `VesselWithPosition`. Instead
   define `VesselWithSanctions` independently:

   ```ts
   export interface VesselWithSanctions {
     imo: string | null;
     mmsi: string;
     name: string | null;
     flag: string | null;
     shipType: number | null;
     destination: string | null;
     lastSeen: Date | null;
     isSanctioned: boolean;
     sanctioningAuthority: string | null;
     sanctionReason: string | null;
     anomalyType?: string | null;
     anomalyConfidence?: string | null;
     anomalyDetectedAt?: Date | null;
     position: {
       time: Date;
       mmsi: string;
       imo: string | null;
       latitude: number;
       longitude: number;
       speed: number | null;
       course: number | null;
       heading: number | null;
       navStatus: number | null;
       lowConfidence: boolean;
     };   // always non-null — every row came from vessel_positions
   }
   ```

3. Rewrite the SQL query to be position-first:

   ```sql
   SELECT
     p.mmsi,
     p.latitude, p.longitude, p.speed, p.course, p.heading,
     p.nav_status    AS "navStatus",
     p.low_confidence AS "lowConfidence",
     p.time,
     v.imo, v.name, v.flag,
     v.ship_type     AS "shipType",
     v.destination,
     v.last_seen     AS "lastSeen",
     CASE WHEN s.imo IS NOT NULL THEN true ELSE false END AS "isSanctioned",
     s.sanctioning_authority AS "sanctioningAuthority",
     s.reason        AS "sanctionReason",
     a.anomaly_type  AS "anomalyType",
     a.confidence    AS "anomalyConfidence",
     a.detected_at   AS "anomalyDetectedAt"
   FROM (
     SELECT DISTINCT ON (mmsi)
       mmsi, latitude, longitude, speed, course, heading,
       nav_status, low_confidence, time
     FROM vessel_positions
     ORDER BY mmsi, time DESC
   ) p
   LEFT JOIN vessels v ON v.mmsi = p.mmsi
   LEFT JOIN vessel_sanctions s ON v.imo = s.imo
   LEFT JOIN vessel_anomalies a ON v.imo = a.imo AND a.resolved_at IS NULL
   ${tankersOnly
     ? 'WHERE v.ship_type IS NOT NULL AND v.ship_type BETWEEN 80 AND 89'
     : ''}
   ORDER BY p.time DESC
   ```

   Key differences from original:
   - Primary source: vessel_positions (every ship with a position appears)
   - tankersOnly: requires ship_type IS NOT NULL AND BETWEEN 80 AND 89 (IMO-less ships excluded)
   - Non-tankersOnly: all vessels regardless of ship_type (IMO-less ships shown in gray)

4. Update the `.map()` transform to match the new nullable types. The `position` field is always
   present (never null) since every row came from vessel_positions. Use `p.latitude` etc directly.
   The row always has valid lat/lon from the CTE.
  </action>
  <verify>npx tsc --noEmit 2>&1 | head -30</verify>
  <done>No TypeScript errors in sanctions.ts or any file importing VesselWithSanctions. Query
  uses vessel_positions as primary source. tankersOnly filter checks IS NOT NULL.</done>
</task>

<task type="auto">
  <name>Task 2: Fix nullable shipType in filter.ts and VesselMap click handler</name>
  <files>src/lib/map/filter.ts, src/components/map/VesselMap.tsx</files>
  <action>
Two downstream fixes needed after VesselWithSanctions becomes nullable:

**src/lib/map/filter.ts:**
The function signature `filterTankers<T extends VesselWithPosition>` will break because
VesselWithSanctions no longer extends VesselWithPosition. Update the generic constraint:

```ts
export function filterTankers<T extends { shipType: number | null }>(
  vessels: T[],
  tankersOnly: boolean
): T[] {
  if (!tankersOnly) return vessels;
  return vessels.filter((v) => v.shipType != null && v.shipType >= 80 && v.shipType <= 89);
}
```

The `!= null` check handles both null and undefined (IMO-less vessels are excluded from tanker
filter, consistent with the DB-level behavior).

**src/components/map/VesselMap.tsx:**
In the click handler where a VesselWithSanctions is reconstructed from feature properties,
several fields are now nullable. Update the reconstructed object to match the new interface:

```ts
const vessel: VesselWithSanctions = {
  imo: props?.imo || null,           // was: props?.imo || ''
  mmsi: props?.mmsi || '',
  name: props?.name || null,         // was: props?.name || ''
  flag: props?.flag || null,         // was: props?.flag || ''
  shipType: props?.shipType ?? null, // was: props?.shipType || 0
  destination: props?.destination || null,
  lastSeen: new Date(),
  isSanctioned: props?.isSanctioned || false,
  sanctioningAuthority: props?.sanctioningAuthority || null,
  sanctionReason: null,
  anomalyType: props?.anomalyType || null,
  anomalyConfidence: props?.anomalyConfidence || null,
  position: { ... }  // leave position block unchanged
};
```

Also check if VesselPanel or other components render `vessel.name`, `vessel.imo`, `vessel.flag`,
`vessel.shipType` — if they do, add null fallbacks (e.g., `vessel.name ?? 'Unknown'`,
`vessel.imo ?? 'N/A'`) where the value is displayed as text. Run `npx tsc --noEmit` to find any
remaining type errors and fix them.
  </action>
  <verify>npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"</verify>
  <done>Zero TypeScript errors across the project. filterTankers handles null shipType. VesselMap
  click handler reconstructs vessel with nullable fields.</done>
</task>

</tasks>

<verification>
After both tasks:
```bash
npx tsc --noEmit
npm run build 2>&1 | tail -20
```
Both must succeed with no errors. The store already has `tankersOnly: true` at line 66 of
`src/stores/vessel.ts` — confirmed during file read, no change needed there.
</verification>

<success_criteria>
- Zero TypeScript errors: `npx tsc --noEmit` exits 0
- Position-first query: `getVesselsWithSanctions` uses `SELECT DISTINCT ON (mmsi) FROM vessel_positions` as CTE
- tankersOnly filter: uses `v.ship_type IS NOT NULL AND v.ship_type BETWEEN 80 AND 89`
- Non-tanker mode: returns all vessels including those with NULL ship_type
- filterTankers: handles null shipType without crashing
- tankersOnly store default: already `true` (confirmed in vessel.ts line 66 — no change needed)
</success_criteria>

<output>
After completion, create `.planning/quick/6-fix-vessel-display-query-position-first-/6-SUMMARY.md`
</output>
