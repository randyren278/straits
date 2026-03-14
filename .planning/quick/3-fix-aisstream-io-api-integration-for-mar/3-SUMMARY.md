---
phase: quick-3
plan: 3
subsystem: ais-ingester
tags: [bugfix, ais, ingester, types, parser, wire-format]
dependency_graph:
  requires: []
  provides: [correct-ais-message-parsing, correct-vessel-db-writes]
  affects: [ais-ingester, parser, ais-types]
tech_stack:
  added: []
  patterns: [discriminated-union-types, string-coercion-at-boundary]
key_files:
  created: []
  modified:
    - src/types/ais.ts
    - src/types/__tests__/types.test.ts
    - src/lib/ais/parser.ts
    - src/lib/ais/parser.test.ts
    - src/services/ais-ingester/index.ts
decisions:
  - "AISStream.io wraps payload under Message[MessageType] key — msg.Message.PositionReport not msg.Message"
  - "MetaData.MMSI arrives as number — coerce via String() at every read site, not at type definition level"
  - "ShipStaticData body uses Name (not ShipName) and Type (not ShipType) — different from MetaData field names"
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-14"
  tasks_completed: 3
  files_modified: 5
---

# Quick Task 3: Fix AISStream.io API Integration Summary

**One-liner:** Corrected nested message path bug (`msg.Message.PositionReport` not `msg.Message`) and field name mismatches (`Name`/`Type` not `ShipName`/`ShipType`) that caused all vessel DB writes to store `undefined` values.

## What Was Fixed

The AISStream.io WebSocket API wraps the message payload one level deeper than the code assumed. Every vessel position and static data write to PostgreSQL was inserting `undefined` for all fields (latitude, longitude, speed, vessel name, IMO, etc.), meaning no ship data was actually being stored.

**Root cause:** Three mismatches between the code and the real wire format:

1. **Nested message path** — API sends `msg.Message.PositionReport.Latitude`, code was reading `msg.Message.Latitude`
2. **Nested message path** — API sends `msg.Message.ShipStaticData.Name`, code was reading `msg.Message.ShipName`
3. **Numeric MMSI** — API sends `MetaData.MMSI` as a number, code typed it as `string` and didn't coerce

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix AIS type definitions | 0f4cbc0 | src/types/ais.ts, src/types/__tests__/types.test.ts |
| 2 | Fix parser and update tests (TDD) | 76eda5f | src/lib/ais/parser.ts, src/lib/ais/parser.test.ts |
| 3 | Fix ingester message processing | 7bfc70a | src/services/ais-ingester/index.ts |

## Changes Made

### src/types/ais.ts
- `AISMetaData.MMSI` type changed from `string` to `number`
- `AISMetaData` gains optional `latitude`, `longitude` fields
- `PositionReportMessage` renamed to `PositionReportBody`, adds `UserID` and `Valid` fields
- `PositionReport.Message` retyped from `PositionReportBody` to `{ PositionReport: PositionReportBody }`
- `ShipStaticDataMessage` renamed to `ShipStaticDataBody`, `ShipName` -> `Name`, `ShipType` -> `Type`, adds `CallSign`, `UserID`, `Valid`
- `ShipStaticData.Message` retyped from `ShipStaticDataBody` to `{ ShipStaticData: ShipStaticDataBody }`

### src/lib/ais/parser.ts
- `parsePositionReport`: reads `msg.Message.PositionReport.*` (not `msg.Message.*`)
- `parsePositionReport`: `String(msg.MetaData.MMSI)` coerces number to string
- `parseShipStaticData`: reads `msg.Message.ShipStaticData.*` (not `msg.Message.*`)
- `parseShipStaticData`: uses `m.Name` (not `m.ShipName`), `m.Type` (not `m.ShipType`)
- `parseShipStaticData`: `String(msg.MetaData.MMSI)` coerces number to string

### src/services/ais-ingester/index.ts
- `processPositionReport`: `const m = msg.Message.PositionReport` (was `msg.Message`)
- `processPositionReport`: `String(msg.MetaData.MMSI)` at mmsi field
- `processShipStaticData`: `const m = msg.Message.ShipStaticData` (was `msg.Message`)
- `processShipStaticData`: `m.Name` (was `m.ShipName`), `m.Type` (was `m.ShipType`)
- `processShipStaticData`: `String(msg.MetaData.MMSI)` at mmsi field

## Verification

- TypeScript compiles clean: `npx tsc --noEmit` — 0 errors
- All AIS parser tests pass: 14/14 (parser.test.ts)
- All AIS filter tests pass: 15/15 (filter.test.ts)
- Full test suite: 352/352 passed, 0 regressions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated types test file to match new wire format**
- **Found during:** Task 1
- **Issue:** `src/types/__tests__/types.test.ts` used old flat `Message: { Latitude: ... }` format and `MMSI: string` — would cause TypeScript errors with the corrected types
- **Fix:** Updated all AIS message fixtures to nested format and MMSI to numeric
- **Files modified:** src/types/__tests__/types.test.ts
- **Commit:** 0f4cbc0

## Self-Check: PASSED

All files exist. All commits verified (0f4cbc0, 76eda5f, 7bfc70a). TypeScript compiles clean. 352 tests pass.
