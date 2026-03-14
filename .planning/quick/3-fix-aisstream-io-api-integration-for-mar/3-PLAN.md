---
phase: quick-3
plan: 3
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/ais.ts
  - src/lib/ais/parser.ts
  - src/lib/ais/parser.test.ts
  - src/services/ais-ingester/index.ts
autonomous: true
requirements: [DATA-01, DATA-02, DATA-03, DATA-04]

must_haves:
  truths:
    - "PositionReport messages are correctly read from msg.Message.PositionReport not msg.Message"
    - "ShipStaticData messages are correctly read from msg.Message.ShipStaticData not msg.Message"
    - "ShipStaticData field Name (not ShipName) and Type (not ShipType) are used correctly"
    - "MetaData.MMSI is coerced to string at every read site"
    - "Parser tests pass with fixtures matching the real API wire format"
  artifacts:
    - path: "src/types/ais.ts"
      provides: "Correct AISStream.io type definitions"
    - path: "src/lib/ais/parser.ts"
      provides: "Parser using correct nested field paths"
    - path: "src/lib/ais/parser.test.ts"
      provides: "Tests using real API wire format fixtures"
    - path: "src/services/ais-ingester/index.ts"
      provides: "Ingester reading correct nested message paths"
  key_links:
    - from: "src/services/ais-ingester/index.ts processPositionReport"
      to: "msg.Message.PositionReport"
      via: "destructuring"
    - from: "src/services/ais-ingester/index.ts processShipStaticData"
      to: "msg.Message.ShipStaticData"
      via: "destructuring"
    - from: "src/lib/ais/parser.ts parsePositionReport"
      to: "msg.Message.PositionReport"
      via: "field access"
---

<objective>
Fix AISStream.io WebSocket integration so the ingester correctly reads the nested message structure the API actually sends.

Purpose: The API wraps payload data one level deeper than the code assumes — `msg.Message.PositionReport` not `msg.Message`. This means every position and vessel write to the DB is currently using `undefined` values, so no ship data is being stored at all.

Output: Corrected types, parser, parser tests, and ingester — all aligned to the real AISStream.io wire format.
</objective>

<execution_context>
@/Users/randyren/.claude/get-shit-done/workflows/execute-plan.md
@/Users/randyren/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<!-- Real AISStream.io wire format (from API docs):

PositionReport message:
{
  "MessageType": "PositionReport",
  "Message": {
    "PositionReport": {           <-- nested under key matching MessageType
      "Latitude": 66.02695,
      "Longitude": 12.253821666666665,
      "Sog": 0,
      "Cog": 308,
      "TrueHeading": 511,
      "NavigationalStatus": 0,
      "UserID": 259000420,
      "Valid": true
    }
  },
  "MetaData": {
    "MMSI": 259000420,            <-- number, not string
    "ShipName": "AUGUSTSON",
    "latitude": 66.02695,
    "longitude": 12.253821666666665,
    "time_utc": "2022-12-29 18:22:32.318353 +0000 UTC"
  }
}

ShipStaticData message:
{
  "MessageType": "ShipStaticData",
  "Message": {
    "ShipStaticData": {           <-- nested under key matching MessageType
      "ImoNumber": 9353333,
      "Name": "KV FARM",          <-- "Name" NOT "ShipName"
      "Type": 55,                 <-- "Type" NOT "ShipType"
      "Destination": "COASTGUARD",
      "CallSign": "LBHF",
      "UserID": 257069200,
      "Valid": true
    }
  },
  "MetaData": {
    "MMSI": 257069200,
    "ShipName": "KV FARM",
    "time_utc": "2022-12-29 18:22:32.318353 +0000 UTC"
  }
}

Subscription message:
{
  "APIKey": "<key>",
  "BoundingBoxes": [[[lat1, lon1], [lat2, lon2]]],
  "FilterMessageTypes": ["PositionReport", "ShipStaticData"]
}
-->
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix AIS type definitions to match real wire format</name>
  <files>src/types/ais.ts</files>
  <action>
Rewrite `src/types/ais.ts` to match the actual AISStream.io wire format.

Key changes required:
1. `AISMetaData.MMSI` — change type from `string` to `number` (API sends numeric MMSI). Add `ShipName?: string`, `latitude?: number`, `longitude?: number`.
2. `PositionReportMessage` — rename to `PositionReportBody`, add `UserID: number` and `Valid: boolean` fields.
3. `PositionReport` interface — change `Message` from `Message: PositionReportMessage` to `Message: { PositionReport: PositionReportBody }`.
4. `ShipStaticDataMessage` — rename to `ShipStaticDataBody`, change field names: `ShipName` -> `Name`, `ShipType` -> `Type`. Add `CallSign?: string`, `UserID: number`, `Valid: boolean`.
5. `ShipStaticData` interface — change `Message` from `Message: ShipStaticDataMessage` to `Message: { ShipStaticData: ShipStaticDataBody }`.
6. Keep the `AISMessage` discriminated union and exported type aliases. Update all JSDoc comments to match.

The subscription type is fine as-is (APIKey is correct).
  </action>
  <verify>npx tsc --noEmit 2>&1 | head -20</verify>
  <done>TypeScript compiles without errors related to ais.ts type changes</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix parser and update tests to real API fixture shapes</name>
  <files>src/lib/ais/parser.ts, src/lib/ais/parser.test.ts</files>
  <behavior>
    - parsePositionReport with real fixture: msg.Message.PositionReport.Latitude -> result.latitude
    - parsePositionReport with real fixture: msg.Message.PositionReport.Sog -> result.speed
    - parsePositionReport: MetaData.MMSI (number 259000420) -> result.mmsi is string "259000420"
    - parseShipStaticData with real fixture: msg.Message.ShipStaticData.Name -> result.name
    - parseShipStaticData with real fixture: msg.Message.ShipStaticData.Type -> result.shipType
    - parseShipStaticData with real fixture: msg.Message.ShipStaticData.ImoNumber -> result.imo string
    - All existing behavior tests (trim, UNKNOWN default, null destination) preserved
  </behavior>
  <action>
Step 1 — Update `parser.test.ts`: Change ALL test fixtures to use the nested message structure.

For PositionReport fixtures, change:
```
Message: { Latitude: 26.123, Longitude: 56.789, Sog: 12.5, ... }
```
to:
```
Message: { PositionReport: { Latitude: 26.123, Longitude: 56.789, Sog: 12.5, ... } }
```
and change MetaData.MMSI from string `'123456789'` to number `123456789` in all fixtures.

For ShipStaticData fixtures, change:
```
Message: { ImoNumber: 9876543, ShipName: 'TANKER ONE', ShipType: 80, Destination: 'SINGAPORE' }
```
to:
```
Message: { ShipStaticData: { ImoNumber: 9876543, Name: 'TANKER ONE', Type: 80, Destination: 'SINGAPORE' } }
```

Run `npm test -- src/lib/ais/parser.test.ts` — tests should fail (RED) because parser still uses old paths.

Step 2 — Update `parser.ts`: Fix field access to use nested paths.

In `parsePositionReport`: change `msg.Message.Latitude` -> `msg.Message.PositionReport.Latitude`, etc. for all fields (Longitude, Sog, Cog, TrueHeading, NavigationalStatus). Change `msg.MetaData.MMSI` -> `String(msg.MetaData.MMSI)` to coerce number to string.

In `parseShipStaticData`: change `msg.Message.ImoNumber` -> `msg.Message.ShipStaticData.ImoNumber`, `msg.Message.ShipName` -> `msg.Message.ShipStaticData.Name`, `msg.Message.Destination` -> `msg.Message.ShipStaticData.Destination`. Change `msg.MetaData.MMSI` -> `String(msg.MetaData.MMSI)`. The `shipType` field maps from `msg.Message.ShipStaticData.Type` (not ShipType).

Run `npm test -- src/lib/ais/parser.test.ts` — all tests should pass (GREEN).
  </action>
  <verify>
    <automated>npx vitest run src/lib/ais/parser.test.ts</automated>
  </verify>
  <done>All parser tests pass with real-format fixtures. Zero failures.</done>
</task>

<task type="auto">
  <name>Task 3: Fix ingester message processing to use nested paths</name>
  <files>src/services/ais-ingester/index.ts</files>
  <action>
In `processPositionReport(msg)`:
- Change `const m = msg.Message` to `const m = msg.Message.PositionReport`
- Change `msg.MetaData.MMSI` to `String(msg.MetaData.MMSI)` (MMSI arrives as number)
- Change `msg.MetaData.time_utc` to `msg.MetaData.time_utc` (unchanged — field name is correct)
- All other field accesses (`m.Sog`, `m.Latitude`, `m.Longitude`, `m.Cog`, `m.TrueHeading`, `m.NavigationalStatus`) remain the same since they are now on the correctly-nested `m`

In `processShipStaticData(msg)`:
- Change `const m = msg.Message` to `const m = msg.Message.ShipStaticData`
- Change `m.ImoNumber` — unchanged (field name is correct in ShipStaticData)
- Change `m.ShipName` to `m.Name` (API uses "Name" not "ShipName" inside ShipStaticData)
- Change `m.ShipType` to `m.Type` (API uses "Type" not "ShipType" inside ShipStaticData)
- Change `msg.MetaData.MMSI` to `String(msg.MetaData.MMSI)` in the vessel object construction

No other changes needed. The subscription object, database operations, WebSocket connection logic, and reconnect logic are all correct.

After editing, run: `cd /Users/randyren/Developer/tanker-tracker/src/services/ais-ingester && npx tsc --noEmit` to check for TypeScript errors in the ingester. Note the ingester has its own package.json and tsconfig — check if one exists, otherwise just verify no runtime errors by reviewing the diff.
  </action>
  <verify>npx tsc --noEmit && npx vitest run src/lib/ais/</verify>
  <done>
    TypeScript compiles clean. Parser tests pass. Ingester processPositionReport reads from msg.Message.PositionReport and processShipStaticData reads from msg.Message.ShipStaticData with correct field names (Name, Type).
  </done>
</task>

</tasks>

<verification>
Run full test suite to confirm no regressions:

```bash
npx vitest run
```

Manually verify the three critical paths are correct in `index.ts`:
1. `msg.Message.PositionReport.Latitude` (not `msg.Message.Latitude`)
2. `msg.Message.ShipStaticData.Name` (not `msg.Message.ShipName`)
3. `msg.Message.ShipStaticData.Type` (not `msg.Message.ShipType`)
4. `String(msg.MetaData.MMSI)` at both call sites in index.ts
</verification>

<success_criteria>
- All tests in `src/lib/ais/parser.test.ts` pass using real AISStream.io wire format fixtures
- TypeScript compiles without errors (`npx tsc --noEmit`)
- `index.ts` ingester reads `msg.Message.PositionReport` and `msg.Message.ShipStaticData` (grep-verifiable)
- No regression in filter tests (`src/lib/ais/filter.test.ts`)
</success_criteria>

<output>
After completion, create `.planning/quick/3-fix-aisstream-io-api-integration-for-mar/3-SUMMARY.md`
</output>
