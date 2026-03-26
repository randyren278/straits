---
id: T01
parent: S02
milestone: M010
provides: []
requires: []
affects: []
key_files: ["src/components/map/VesselLayer.tsx (deleted)", "src/components/map/TrackLayer.tsx (deleted)", "src/components/fleet/AnomalyMatrix.tsx (deleted)", "src/components/fleet/__tests__/AnomalyMatrix.test.tsx (deleted)", "src/lib/map/tracks.ts (deleted)", "src/lib/map/tracks.test.ts (deleted)", "src/proxy.ts (deleted)", "src/lib/sanctions/matcher.ts (deleted)", "src/lib/sanctions/matcher.test.ts (deleted)", "src/lib/auth.ts (deleted)", "src/lib/auth.test.ts (deleted)", "src/lib/auth/auth.test.ts (deleted)", "src/app/login/page.tsx (deleted)", "src/app/api/auth/login/route.ts (deleted)"]
key_decisions: ["Cleared .next cache to remove stale route type declarations for deleted App Router pages"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "npx tsc --noEmit passes clean. rg scan for deleted symbol names finds zero real references. Protected directories (src/lib/map/, src/components/fleet/__tests__/) retain all live files."
completed_at: 2026-03-26T20:06:07.471Z
blocker_discovered: false
---

# T01: Deleted 14 orphaned files (930 lines) and 5 empty directories; TypeScript compiles clean with zero dangling references

> Deleted 14 orphaned files (930 lines) and 5 empty directories; TypeScript compiles clean with zero dangling references

## What Happened
---
id: T01
parent: S02
milestone: M010
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
  - Cleared .next cache to remove stale route type declarations for deleted App Router pages
duration: ""
verification_result: passed
completed_at: 2026-03-26T20:06:07.472Z
blocker_discovered: false
---

# T01: Deleted 14 orphaned files (930 lines) and 5 empty directories; TypeScript compiles clean with zero dangling references

**Deleted 14 orphaned files (930 lines) and 5 empty directories; TypeScript compiles clean with zero dangling references**

## What Happened

Verified all 14 target files existed, confirmed no live code imports them, deleted all files and 5 empty directories. Cleared stale .next route type cache that referenced deleted pages. TypeScript compiles clean. Dangling reference scan returned only false positives (authority, updateTrackLayer, sanctioningAuthority).

## Verification

npx tsc --noEmit passes clean. rg scan for deleted symbol names finds zero real references. Protected directories (src/lib/map/, src/components/fleet/__tests__/) retain all live files.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 3200ms |
| 2 | `rg -l 'VesselLayer|TrackLayer|AnomalyMatrix|tracks|proxy|matcher|auth' src/ -g '*.ts' -g '*.tsx' | grep -v exclusions` | 0 | ✅ pass (false positives only) | 500ms |


## Deviations

Had to clear .next cache directory because Next.js route type generation cached type declarations for deleted /login and /api/auth/login routes.

## Known Issues

None.

## Files Created/Modified

- `src/components/map/VesselLayer.tsx (deleted)`
- `src/components/map/TrackLayer.tsx (deleted)`
- `src/components/fleet/AnomalyMatrix.tsx (deleted)`
- `src/components/fleet/__tests__/AnomalyMatrix.test.tsx (deleted)`
- `src/lib/map/tracks.ts (deleted)`
- `src/lib/map/tracks.test.ts (deleted)`
- `src/proxy.ts (deleted)`
- `src/lib/sanctions/matcher.ts (deleted)`
- `src/lib/sanctions/matcher.test.ts (deleted)`
- `src/lib/auth.ts (deleted)`
- `src/lib/auth.test.ts (deleted)`
- `src/lib/auth/auth.test.ts (deleted)`
- `src/app/login/page.tsx (deleted)`
- `src/app/api/auth/login/route.ts (deleted)`


## Deviations
Had to clear .next cache directory because Next.js route type generation cached type declarations for deleted /login and /api/auth/login routes.

## Known Issues
None.
