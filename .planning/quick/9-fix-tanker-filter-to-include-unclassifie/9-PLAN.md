---
phase: quick-9
plan: 9
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/sanctions.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Vessels with NULL ship_type appear on the map in tankers-only mode"
    - "Known non-tankers (cargo, tugs) are still excluded in tankers-only mode"
    - "Selecting a NULL-shipType vessel in VesselPanel shows 'Unknown' not a crash or 'null'"
  artifacts:
    - path: src/lib/db/sanctions.ts
      provides: "Fixed tankersOnly SQL filter"
      contains: "v.ship_type IS NULL OR v.ship_type BETWEEN 80 AND 89"
  key_links:
    - from: src/lib/db/sanctions.ts
      to: "vessel_positions LEFT JOIN vessels"
      via: "tankersOnly WHERE clause"
      pattern: "ship_type IS NULL OR"
---

<objective>
Fix the tankersOnly filter in getVesselsWithSanctions to include vessels with NULL ship_type (ships that have positions but never broadcast ShipStaticData). Currently the filter `WHERE v.ship_type IS NOT NULL AND v.ship_type BETWEEN 80 AND 89` silently drops ~92 vessels. The fix shows unclassified vessels rather than hiding them.

Purpose: Operator visibility — unclassified ships in the Middle East are exactly what you want to see, not silently filter out.
Output: Updated SQL filter; unclassified vessels visible in tankers-only mode labeled "Unknown" in VesselPanel.
</objective>

<execution_context>
@/Users/randyren/.claude/get-shit-done/workflows/execute-plan.md
@/Users/randyren/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/db/sanctions.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix tankersOnly SQL filter to include NULL ship_type</name>
  <files>src/lib/db/sanctions.ts</files>
  <action>
In `getVesselsWithSanctions`, change the tankersOnly conditional WHERE clause from:

```
WHERE v.ship_type IS NOT NULL AND v.ship_type BETWEEN 80 AND 89
```

to:

```
WHERE (v.ship_type IS NULL OR v.ship_type BETWEEN 80 AND 89)
```

The parentheses are required so OR doesn't interact with any future WHERE conditions. This change includes:
1. Vessels with no entry in `vessels` table at all (after LEFT JOIN, v.ship_type is NULL because the entire v.* is NULL)
2. Vessels with a `vessels` record but NULL ship_type (crew didn't broadcast type)

Known non-tankers with explicit types (cargo=70-79, tugs=52, etc.) are still excluded because they have non-NULL ship_type values outside 80-89.

Also update the comment on the query (the one above getVesselsWithSanctions) to note that tankersOnly includes unclassified vessels.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>TypeScript compiles clean; the SQL filter string in sanctions.ts reads `v.ship_type IS NULL OR v.ship_type BETWEEN 80 AND 89`</done>
</task>

<task type="auto">
  <name>Task 2: Verify VesselPanel handles NULL shipType gracefully</name>
  <files>src/components/panels/VesselPanel.tsx</files>
  <action>
Inspect the "Type" field display logic in VesselPanel around line 121. The existing code is:

```tsx
{selectedVessel.shipType != null && selectedVessel.shipType >= 80 && selectedVessel.shipType <= 89
  ? `Tanker (${selectedVessel.shipType})`
  : (selectedVessel.shipType ?? 'Unknown')}
```

This already renders "Unknown" for NULL shipType via `?? 'Unknown'`. No code change needed IF this is confirmed correct.

However, for non-tanker ships with a known type code (e.g., shipType=70), the current fallback renders the raw number `70` — change this branch to also show a human-readable label:

```tsx
{selectedVessel.shipType == null
  ? 'Unknown'
  : selectedVessel.shipType >= 80 && selectedVessel.shipType <= 89
    ? `Tanker (${selectedVessel.shipType})`
    : `Type ${selectedVessel.shipType}`}
```

This makes the NULL case explicit (not relying on `??`) and keeps non-tanker types readable as "Type 70" rather than just "70". The behavior for NULL shipType ("Unknown") is unchanged — just made explicit.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>TypeScript compiles clean; VesselPanel Type field shows "Unknown" for null shipType, "Tanker (8X)" for tanker types, "Type N" for other known types</done>
</task>

</tasks>

<verification>
After both tasks:
1. `npx tsc --noEmit` passes with no errors
2. Grep confirms the filter: `grep -n "ship_type IS NULL" src/lib/db/sanctions.ts`
3. Grep confirms VesselPanel null handling: `grep -n "Unknown" src/components/panels/VesselPanel.tsx`
</verification>

<success_criteria>
- `src/lib/db/sanctions.ts` tankersOnly filter reads `(v.ship_type IS NULL OR v.ship_type BETWEEN 80 AND 89)`
- `src/components/panels/VesselPanel.tsx` Type field shows "Unknown" for NULL shipType explicitly
- TypeScript builds clean
</success_criteria>

<output>
After completion, create `.planning/quick/9-fix-tanker-filter-to-include-unclassifie/9-SUMMARY.md`
</output>
