---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "README describes the 6 AIS coverage regions by name and coordinates"
    - "README intro no longer implies only 3 chokepoints are covered"
    - "AIS ingester section explains what regions are monitored and why"
  artifacts:
    - path: "README.md"
      provides: "Updated coverage documentation"
      contains: "Persian Gulf"
  key_links: []
---

<objective>
Update README.md to document the 6 regional AIS bounding boxes added in quick task 7, replacing the outdated 3-chokepoint framing.

Purpose: Operators and contributors should understand what geographic area is being tracked and why — currently the README says "Hormuz, Bab el-Mandeb, Suez" which understates the actual coverage.
Output: README with a Coverage Areas section listing all 6 regions with coordinates and purpose.
</objective>

<execution_context>
@/Users/randyren/.claude/get-shit-done/workflows/execute-plan.md
@/Users/randyren/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

The 6 bounding boxes currently configured in src/services/ais-ingester/index.ts:
1. Full Persian Gulf — lat 23–30, lon 47–57.5 — Ras Tanura, Kharg Island, Kuwait, UAE loading terminals
2. Gulf of Oman + Arabian Sea west — lat 22–26, lon 55–66 — tankers exiting Strait of Hormuz
3. Arabian Sea transit — lat 8–25, lon 60–78 — east-bound routes to India and Asia
4. Full Red Sea — lat 12–30, lon 32–45 — entire Red Sea corridor
5. Gulf of Aden — lat 11–14, lon 42–52 — exits from Bab-el-Mandeb strait
6. Suez + Eastern Mediterranean — lat 29.5–37, lon 28–37 — Suez Canal northbound exits

AISStream.io subscription uses these as the BoundingBoxes filter — vessels outside all boxes are not received.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update README coverage documentation</name>
  <files>README.md</files>
  <action>
Make two targeted edits to README.md:

1. Update the opening paragraph (line 3) — change "across the Middle East and major export routes (Hormuz, Bab el-Mandeb, Suez)" to something like "across the Middle East and major export routes, from Persian Gulf loading terminals through the Strait of Hormuz, Arabian Sea, Red Sea, and Suez Canal".

2. Expand the "Start the AIS Ingester" section (around line 102) by adding a "Coverage Areas" subsection AFTER the startup log block. Insert this content between the log block and the "Vessel positions will start appearing" line:

```
#### Coverage Areas

The ingester subscribes to 6 regional bounding boxes via AISStream.io:

| Region | Lat | Lon | Purpose |
|--------|-----|-----|---------|
| Full Persian Gulf | 23–30°N | 47–57.5°E | Loading terminals: Ras Tanura, Kharg Island, Kuwait, UAE |
| Gulf of Oman + Arabian Sea (west) | 22–26°N | 55–66°E | Tankers exiting Strait of Hormuz |
| Arabian Sea (transit) | 8–25°N | 60–78°E | East-bound routes to India and Asia |
| Full Red Sea | 12–30°N | 32–45°E | Entire Red Sea corridor |
| Gulf of Aden | 11–14°N | 42–52°E | Exits from Bab-el-Mandeb strait |
| Suez + Eastern Mediterranean | 29.5–37°N | 28–37°E | Suez Canal northbound exits |

Vessels outside all 6 boxes are not received from AISStream.io. To adjust coverage, edit the `BOUNDING_BOXES` array in `src/services/ais-ingester/index.ts`.
```

No other changes. Do not reformat or reflow unrelated sections.
  </action>
  <verify>
    <automated>grep -c "Persian Gulf" /Users/randyren/Developer/tanker-tracker/README.md && grep -c "Coverage Areas" /Users/randyren/Developer/tanker-tracker/README.md</automated>
  </verify>
  <done>README contains a Coverage Areas table with all 6 regions and the intro no longer implies only 3 chokepoints.</done>
</task>

</tasks>

<verification>
grep -A 30 "Coverage Areas" /Users/randyren/Developer/tanker-tracker/README.md
</verification>

<success_criteria>
- README Coverage Areas table lists all 6 bounding boxes with lat/lon ranges and purpose
- Intro paragraph reflects expanded regional scope
- No other README content is altered
</success_criteria>

<output>
After completion, create `.planning/quick/8-update-documentation-to-reflect-expanded/8-SUMMARY.md` with what was changed.
</output>
