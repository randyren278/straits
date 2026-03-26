---
estimated_steps: 28
estimated_files: 14
skills_used: []
---

# T01: Delete 14 dead files and 4 empty directories, verify clean build

Delete all orphaned components, dead lib modules, unwired auth scaffolding, and their tests. Then remove directories that become empty. Verify TypeScript still compiles and no dangling references remain.

**Dead components (3 files):**
- `src/components/map/VesselLayer.tsx` (36 lines)
- `src/components/map/TrackLayer.tsx` (71 lines)
- `src/components/fleet/AnomalyMatrix.tsx` (132 lines)

**Dead component tests (1 file):**
- `src/components/fleet/__tests__/AnomalyMatrix.test.tsx` (164 lines)

**Dead lib modules (5 files):**
- `src/lib/map/tracks.ts` (39 lines)
- `src/lib/map/tracks.test.ts` (113 lines)
- `src/proxy.ts` (15 lines)
- `src/lib/sanctions/matcher.ts` (53 lines)
- `src/lib/sanctions/matcher.test.ts` (94 lines)

**Unwired auth scaffolding (5 files):**
- `src/lib/auth.ts` (30 lines)
- `src/lib/auth.test.ts` (45 lines)
- `src/lib/auth/auth.test.ts` (27 lines)
- `src/app/login/page.tsx` (70 lines)
- `src/app/api/auth/login/route.ts` (41 lines)

**Directories to remove after file deletion (empty):**
- `src/lib/sanctions/`
- `src/lib/auth/`
- `src/app/login/`
- `src/app/api/auth/` (including `login/` subdirectory)

**IMPORTANT — do NOT delete these directories (they contain live files):**
- `src/lib/map/` — still has `filter.ts`, `filter.test.ts`, `geojson.ts`, `geojson.test.ts`
- `src/components/fleet/__tests__/` — still has `AnomalyTable.test.tsx`, `SanctionedVessels.test.tsx`

Decision D002 authorizes full auth deletion.

## Inputs

- ``src/components/map/VesselLayer.tsx` — dead component to delete`
- ``src/components/map/TrackLayer.tsx` — dead component to delete`
- ``src/components/fleet/AnomalyMatrix.tsx` — dead component to delete`
- ``src/components/fleet/__tests__/AnomalyMatrix.test.tsx` — dead test to delete`
- ``src/lib/map/tracks.ts` — dead module to delete`
- ``src/lib/map/tracks.test.ts` — dead test to delete`
- ``src/proxy.ts` — dead module to delete`
- ``src/lib/sanctions/matcher.ts` — dead module to delete`
- ``src/lib/sanctions/matcher.test.ts` — dead test to delete`
- ``src/lib/auth.ts` — dead module to delete`
- ``src/lib/auth.test.ts` — dead test to delete`
- ``src/lib/auth/auth.test.ts` — dead test to delete`
- ``src/app/login/page.tsx` — dead page to delete`
- ``src/app/api/auth/login/route.ts` — dead API route to delete`

## Expected Output

- ``src/components/map/VesselLayer.tsx` — deleted`
- ``src/components/map/TrackLayer.tsx` — deleted`
- ``src/components/fleet/AnomalyMatrix.tsx` — deleted`
- ``src/components/fleet/__tests__/AnomalyMatrix.test.tsx` — deleted`
- ``src/lib/map/tracks.ts` — deleted`
- ``src/lib/map/tracks.test.ts` — deleted`
- ``src/proxy.ts` — deleted`
- ``src/lib/sanctions/matcher.ts` — deleted`
- ``src/lib/sanctions/matcher.test.ts` — deleted`
- ``src/lib/auth.ts` — deleted`
- ``src/lib/auth.test.ts` — deleted`
- ``src/lib/auth/auth.test.ts` — deleted`
- ``src/app/login/page.tsx` — deleted`
- ``src/app/api/auth/login/route.ts` — deleted`

## Verification

npx tsc --noEmit && echo 'tsc clean' && rg -l 'VesselLayer|TrackLayer|AnomalyMatrix|tracks|proxy|matcher|auth' src/ -g '*.ts' -g '*.tsx' --no-ignore-vcs | grep -v node_modules | grep -v 'opensanctions\|sanctions/db\|sanctions/types\|db/sanctions\|types/anomaly\|detection/\|constants/' | sort
