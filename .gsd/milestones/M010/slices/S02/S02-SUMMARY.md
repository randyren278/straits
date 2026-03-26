---
id: S02
parent: M010
milestone: M010
provides:
  - Clean codebase with no orphaned components, dead lib modules, or unwired auth scaffolding
requires:
  []
affects:
  []
key_files:
  - src/components/map/VesselLayer.tsx (deleted)
  - src/components/map/TrackLayer.tsx (deleted)
  - src/components/fleet/AnomalyMatrix.tsx (deleted)
  - src/components/fleet/__tests__/AnomalyMatrix.test.tsx (deleted)
  - src/lib/map/tracks.ts (deleted)
  - src/lib/map/tracks.test.ts (deleted)
  - src/proxy.ts (deleted)
  - src/lib/sanctions/matcher.ts (deleted)
  - src/lib/sanctions/matcher.test.ts (deleted)
  - src/lib/auth.ts (deleted)
  - src/lib/auth.test.ts (deleted)
  - src/lib/auth/auth.test.ts (deleted)
  - src/app/login/page.tsx (deleted)
  - src/app/api/auth/login/route.ts (deleted)
key_decisions:
  - D002 authorized full auth scaffolding deletion
  - Cleared .next cache to remove stale route type declarations for deleted App Router pages
patterns_established:
  - When deleting Next.js App Router pages, clear .next/ cache to purge stale route type declarations
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M010/slices/S02/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-03-26T20:07:51.828Z
blocker_discovered: false
---

# S02: Dead Code Removal

**Deleted 14 orphaned files (930 lines) and 5 empty directories — dead components, dead lib modules, and unwired auth scaffolding — with zero dangling references and a clean TypeScript build.**

## What Happened

Identified and deleted 14 files across three categories: dead components (VesselLayer, TrackLayer, AnomalyMatrix and its test — 403 lines), dead lib modules (tracks.ts, tracks.test.ts, proxy.ts, sanctions/matcher.ts, sanctions/matcher.test.ts — 314 lines), and unwired auth scaffolding (auth.ts, auth.test.ts, auth/auth.test.ts, login/page.tsx, api/auth/login/route.ts — 213 lines). Removed 4 empty directories left behind (src/lib/sanctions/, src/lib/auth/, src/app/login/, src/app/api/auth/). Had to clear the .next cache because Next.js route type generation retained stale type declarations for the deleted /login and /api/auth/login App Router pages. After cache clearing, TypeScript compiled clean. A ripgrep scan for all deleted symbol names found only false positives — substring matches like `authority`, `updateTrackLayer`, and `sanctioningAuthority` in live code that have no relation to the deleted modules. Protected directories (src/lib/map/ and src/components/fleet/__tests__/) retained all their live files.

## Verification

1. `npx tsc --noEmit` passes clean (exit 0, no output). 2. `rg` scan for deleted symbol names across src/ finds zero real references — only false-positive substring matches (authority, updateTrackLayer, sanctioningAuthority). 3. All 14 target files confirmed absent from filesystem. 4. All 4 target directories confirmed removed. 5. Protected directories (src/lib/map/, src/components/fleet/__tests__/) retain their live files (filter.ts, filter.test.ts, geojson.ts, geojson.test.ts, AnomalyTable.test.tsx, SanctionedVessels.test.tsx).

## Requirements Advanced

None.

## Requirements Validated

- R007 — All 14 orphaned files deleted (930 lines), 4 empty directories removed, npx tsc --noEmit clean, rg scan confirms zero dangling references. See D005.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

Had to clear .next cache directory because Next.js route type generation cached type declarations for deleted /login and /api/auth/login routes, causing TypeScript compilation errors until the cache was purged.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `src/components/map/VesselLayer.tsx` — Deleted — orphaned component (36 lines)
- `src/components/map/TrackLayer.tsx` — Deleted — orphaned component (71 lines)
- `src/components/fleet/AnomalyMatrix.tsx` — Deleted — orphaned component (132 lines)
- `src/components/fleet/__tests__/AnomalyMatrix.test.tsx` — Deleted — test for deleted component (164 lines)
- `src/lib/map/tracks.ts` — Deleted — dead lib module (39 lines)
- `src/lib/map/tracks.test.ts` — Deleted — test for dead module (113 lines)
- `src/proxy.ts` — Deleted — dead proxy module (15 lines)
- `src/lib/sanctions/matcher.ts` — Deleted — dead sanctions matcher (53 lines)
- `src/lib/sanctions/matcher.test.ts` — Deleted — test for dead matcher (94 lines)
- `src/lib/auth.ts` — Deleted — unwired auth module (30 lines)
- `src/lib/auth.test.ts` — Deleted — test for unwired auth (45 lines)
- `src/lib/auth/auth.test.ts` — Deleted — duplicate test for unwired auth (27 lines)
- `src/app/login/page.tsx` — Deleted — unwired login page (70 lines)
- `src/app/api/auth/login/route.ts` — Deleted — unwired auth API route (41 lines)
