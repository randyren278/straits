# S02: Dead Code Removal — Research

**Date:** 2026-03-26

## Summary

Dead code removal for this slice is fully verified and safe. Every file targeted for deletion has been confirmed as having zero live importers (or importers only within the deletion set). The dependency graph is clean — no barrel exports, no indirect references, no shared utilities that would break. Total removal: 930 lines across 14 files and 4 empty directories.

TypeScript compiles clean today (`tsc --noEmit` passes with zero errors), so the verification baseline is established. The only non-obvious dependency was `TrackLayer.tsx` appearing in `VesselMap.tsx` grep results — but that's an internal function named `updateTrackLayer`, not an import of the component.

## Recommendation

Single-task execution: delete all 14 files, remove 4 empty directories, run `tsc --noEmit` to confirm build still passes. This is a single `rm` operation followed by a type check — no code changes, no refactoring, no logic to write. One task is sufficient.

## Implementation Landscape

### Key Files

**Dead components (3 files, 239 lines):**
- `src/components/map/VesselLayer.tsx` (36 lines) — zero importers anywhere in codebase
- `src/components/map/TrackLayer.tsx` (71 lines) — zero importers; `VesselMap.tsx` has an internal `updateTrackLayer` function (unrelated)
- `src/components/fleet/AnomalyMatrix.tsx` (132 lines) — zero importers; `ANOMALY_TYPE_LABELS` it used lives in `src/types/anomaly.ts` and is still consumed by `AnomalyTable.tsx`

**Dead component tests (1 file, 164 lines):**
- `src/components/fleet/__tests__/AnomalyMatrix.test.tsx` (164 lines) — tests only AnomalyMatrix; other tests in `__tests__/` directory remain

**Dead lib modules (4 files, 261 lines):**
- `src/lib/map/tracks.ts` (39 lines) — only imported by dead `TrackLayer.tsx`
- `src/lib/map/tracks.test.ts` (113 lines) — tests only tracks.ts
- `src/proxy.ts` (15 lines) — zero importers
- `src/lib/sanctions/matcher.ts` (53 lines) — only imported by its own test
- `src/lib/sanctions/matcher.test.ts` (94 lines) — tests only matcher.ts

**Unwired auth (4 files, 213 lines):**
- `src/lib/auth.ts` (30 lines) — only imported by `src/app/api/auth/login/route.ts` (also being deleted)
- `src/lib/auth.test.ts` (45 lines) — tests only auth.ts
- `src/lib/auth/auth.test.ts` (27 lines) — tests only auth.ts
- `src/app/login/page.tsx` (70 lines) — standalone page, no other references
- `src/app/api/auth/login/route.ts` (41 lines) — API route, only consumer of auth.ts

**Directories to remove (empty after file deletion):**
- `src/lib/sanctions/` — contains only matcher.ts + test
- `src/lib/auth/` — contains only auth.test.ts
- `src/app/login/` — contains only page.tsx
- `src/app/api/auth/` — contains only `login/` subdirectory

### Build Order

Single pass — all deletions are independent. No ordering constraints. Delete everything, then verify.

### Verification Approach

1. `rm` all 14 files and 4 directories
2. `npx tsc --noEmit` — must pass with zero errors (baseline is clean today)
3. `rg -l "VesselLayer|TrackLayer|AnomalyMatrix|matcher|proxy|auth" src/ -g '*.ts' -g '*.tsx' | grep -v node_modules` — confirm no dangling references remain (expected: only `src/types/anomaly.ts` for the shared `ANOMALY_TYPE_LABELS`, `src/lib/external/opensanctions.ts` for the word "auth" in comments/strings, `src/lib/db/sanctions.ts` etc. for legitimate sanctions usage)
4. Line count delta: should be ~930 lines removed

## Constraints

- `src/components/fleet/__tests__/` directory must NOT be deleted — it still contains `AnomalyTable.test.tsx` and `SanctionedVessels.test.tsx`
- `src/lib/map/` directory must NOT be deleted — it still contains `filter.ts`, `filter.test.ts`, `geojson.ts`, `geojson.test.ts`
- Decision D002 authorizes full auth deletion (no middleware, no guard, no layout)
