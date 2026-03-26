# S02: Dead Code Removal — UAT

**Milestone:** M010
**Written:** 2026-03-26T20:07:51.828Z

# S02: Dead Code Removal — UAT

**Milestone:** M010
**Written:** 2026-03-26

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: This slice only deleted files and verified build integrity — no runtime behavior changed. All validation is structural (compilation, reference scan, filesystem state).

## Preconditions

- Repository checked out with S02 changes applied
- Node.js and npm available
- No running dev server needed (this is a build-time verification)

## Smoke Test

Run `npx tsc --noEmit` — should exit 0 with no output. This confirms the build is clean after all deletions.

## Test Cases

### 1. TypeScript compilation is clean

1. Run `npx tsc --noEmit`
2. **Expected:** Exit code 0, no errors or warnings printed

### 2. All 14 target files are deleted

1. Check each file path:
   - `src/components/map/VesselLayer.tsx`
   - `src/components/map/TrackLayer.tsx`
   - `src/components/fleet/AnomalyMatrix.tsx`
   - `src/components/fleet/__tests__/AnomalyMatrix.test.tsx`
   - `src/lib/map/tracks.ts`
   - `src/lib/map/tracks.test.ts`
   - `src/proxy.ts`
   - `src/lib/sanctions/matcher.ts`
   - `src/lib/sanctions/matcher.test.ts`
   - `src/lib/auth.ts`
   - `src/lib/auth.test.ts`
   - `src/lib/auth/auth.test.ts`
   - `src/app/login/page.tsx`
   - `src/app/api/auth/login/route.ts`
2. **Expected:** None of these files exist on disk

### 3. Empty directories are removed

1. Check these directory paths:
   - `src/lib/sanctions/`
   - `src/lib/auth/`
   - `src/app/login/`
   - `src/app/api/auth/`
2. **Expected:** None of these directories exist

### 4. Protected directories retain live files

1. List contents of `src/lib/map/`
2. **Expected:** Contains `filter.ts`, `filter.test.ts`, `geojson.ts`, `geojson.test.ts`
3. List contents of `src/components/fleet/__tests__/`
4. **Expected:** Contains `AnomalyTable.test.tsx`, `SanctionedVessels.test.tsx`

### 5. No dangling references to deleted symbols

1. Run `rg -l 'VesselLayer|TrackLayer|AnomalyMatrix|tracks|proxy|matcher|auth' src/ -g '*.ts' -g '*.tsx' --no-ignore-vcs | grep -v node_modules | grep -v 'opensanctions\|sanctions/db\|sanctions/types\|db/sanctions\|types/anomaly\|detection/\|constants/'`
2. Inspect each match
3. **Expected:** All matches are false positives — substring matches like `authority`, `updateTrackLayer`, `sanctioningAuthority` in live code. No actual import or usage of any deleted module.

## Edge Cases

### .next cache contains stale route types

1. If `npx tsc --noEmit` fails with errors referencing `/login` or `/api/auth/login` route types
2. Run `rm -rf .next` then retry `npx tsc --noEmit`
3. **Expected:** Compilation succeeds after cache clear

## Failure Signals

- `npx tsc --noEmit` exits with errors referencing deleted files or their symbols
- Any of the 14 deleted files still exist on disk
- Any of the 4 empty directories still exist
- Live files missing from protected directories (src/lib/map/, src/components/fleet/__tests__/)
- A real import statement referencing a deleted module appears in the rg scan

## Not Proven By This UAT

- Runtime behavior — no application features changed, so no runtime testing needed
- Whether the deleted code should have been preserved — that was decided in D002 (auth) and the S02 planning phase
- Whether other dead code exists beyond these 14 files — this slice addressed the known inventory only

## Notes for Tester

The rg scan in test case 5 will return ~4 files. All are false positives from substring matches. Inspect the actual match lines — they reference `authority` (a sanctions field), `updateTrackLayer` (a local function in VesselMap), and `sanctioningAuthority` (a sanctions API field). None are imports or usages of the deleted modules.
