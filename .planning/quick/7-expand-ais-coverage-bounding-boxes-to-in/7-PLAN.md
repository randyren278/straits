---
phase: quick-7
plan: 7
type: execute
wave: 1
depends_on: []
files_modified:
  - src/services/ais-ingester/index.ts
  - src/lib/db/sanctions.ts
autonomous: true
requirements: [DATA-01, DATA-02]
must_haves:
  truths:
    - "AIS feed receives vessels from full Persian Gulf, not just Hormuz strait entrance"
    - "AIS feed receives vessels transiting Gulf of Oman and Arabian Sea eastbound lanes"
    - "AIS feed receives vessels along the full Red Sea, not just Bab-el-Mandeb strait"
    - "AIS feed receives vessels in Gulf of Aden"
    - "Vessel map query window is 24 hours, not 336 hours"
  artifacts:
    - path: src/services/ais-ingester/index.ts
      provides: "Expanded BoundingBoxes covering 6 regions"
    - path: src/lib/db/sanctions.ts
      provides: "24-hour freshness window for vessel positions"
  key_links:
    - from: src/services/ais-ingester/index.ts
      to: aisstream.io
      via: BoundingBoxes subscription array
      pattern: "BoundingBoxes"
    - from: src/lib/db/sanctions.ts
      to: vessel_positions
      via: SQL interval filter
      pattern: "INTERVAL '24 hours'"
---

<objective>
Expand the AIS ingester subscription from 4 narrow chokepoint-only boxes to 6 broad regional
boxes covering full maritime trade routes. Also revert an accidental change to sanctions.ts
that extended the vessel query window from 24 hours to 336 hours (14 days).

Purpose: The current narrow boxes only capture ships at strait entrances. Loading terminals
(Ras Tanura, Kharg Island, UAE ports), eastbound Asian transit lanes, and the full Red Sea
corridor are all invisible. Expanding coverage will populate the map with the ships that
matter most: loaded tankers departing Persian Gulf terminals and transiting toward Asia/India.

Output: Updated ingester subscription + reverted sanctions query window.
</objective>

<execution_context>
@/Users/randyren/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Expand AIS ingester bounding boxes to full regional coverage</name>
  <files>src/services/ais-ingester/index.ts</files>
  <action>
Replace the `BoundingBoxes` array in the `subscription` object (lines 84-93) with 6 expanded
regional boxes. Keep the existing comment style. The new boxes:

```typescript
BoundingBoxes: [
  // Full Persian Gulf — loading terminals (Ras Tanura, Kharg Island, Kuwait, UAE ports)
  // Extends existing Hormuz box westward to cover the entire gulf
  [[23.0, 47.0], [30.0, 57.5]],
  // Gulf of Oman + Arabian Sea western approaches
  // Tankers exiting Hormuz heading east toward India/Asia
  [[15.0, 55.0], [26.0, 66.0]],
  // Arabian Sea transit corridor — eastbound tanker routes to India/Asia
  [[8.0, 60.0], [25.0, 78.0]],
  // Full Red Sea — extends existing Bab-el-Mandeb box northward to Suez
  [[12.0, 32.0], [30.0, 45.0]],
  // Gulf of Aden — exits from Bab-el-Mandeb heading east
  [[11.0, 42.0], [14.0, 52.0]],
  // Suez Canal + Eastern Mediterranean
  // Unchanged from current coverage
  [[29.5, 31.5], [37.0, 37.0]],
],
```

Note: The Arabian Sea box [[8.0, 60.0], [25.0, 78.0]] is large but AISStream only streams
vessels that broadcast — AIS is mandatory on commercial vessels over 300 GT so throughput
will be high but manageable. The existing `FilterMessageTypes` stays unchanged.

Also update the comment on the subscription object (line 81) to reflect broader coverage:
`// Regional bounding boxes covering Persian Gulf, Gulf of Oman, Arabian Sea, Red Sea, Gulf of Aden, Suez/Eastern Med`
  </action>
  <verify>
    <automated>grep -n "BoundingBoxes" src/services/ais-ingester/index.ts | head -20</automated>
  </verify>
  <done>
subscription.BoundingBoxes contains 6 entries. Persian Gulf box starts at lon 47.0.
Arabian Sea box present. Full Red Sea box starts at lat 12.0, lon 32.0.
  </done>
</task>

<task type="auto">
  <name>Task 2: Revert sanctions.ts vessel query window from 336h back to 24h</name>
  <files>src/lib/db/sanctions.ts</files>
  <action>
In `getVesselsWithSanctions()`, the inner CTE at line 143 currently reads:
  `WHERE time > NOW() - INTERVAL '336 hours'`

Revert it back to:
  `WHERE time > NOW() - INTERVAL '24 hours'`

This was changed in an unstaged edit and should not have been. The 24-hour window is the
correct freshness policy — vessels not seen in 24h are stale and should drop off the map.
336 hours (14 days) would accumulate ghost vessels crowding the map with outdated positions.
  </action>
  <verify>
    <automated>grep -n "INTERVAL" src/lib/db/sanctions.ts</automated>
  </verify>
  <done>Line 143 reads `INTERVAL '24 hours'`, not `336 hours`.</done>
</task>

</tasks>

<verification>
After both tasks:
1. `grep -n "47.0" src/services/ais-ingester/index.ts` — confirms Persian Gulf box starts at lon 47
2. `grep -n "BoundingBoxes" src/services/ais-ingester/index.ts` — confirms 6 boxes present
3. `grep -n "INTERVAL" src/lib/db/sanctions.ts` — confirms 24 hours
4. `npx tsc --noEmit` from project root — no TypeScript errors
</verification>

<success_criteria>
- 6 bounding boxes in ingester subscription covering all described regions
- Full Persian Gulf: lat 23-30, lon 47-57.5
- Gulf of Oman + western Arabian Sea: lat 15-26, lon 55-66
- Arabian Sea eastbound: lat 8-25, lon 60-78
- Full Red Sea: lat 12-30, lon 32-45
- Gulf of Aden: lat 11-14, lon 42-52
- Suez + Eastern Med: lat 29.5-37, lon 31.5-37
- sanctions.ts vessel freshness window is 24 hours
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/quick/7-expand-ais-coverage-bounding-boxes-to-in/7-SUMMARY.md`
with what was changed, the new bounding box coordinates, and commit hash.
</output>
