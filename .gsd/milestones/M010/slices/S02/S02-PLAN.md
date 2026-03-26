# S02: Dead Code Removal

**Goal:** Remove all orphaned components, dead lib modules, and unwired auth scaffolding — 14 files totaling ~930 lines. Build remains clean.
**Demo:** After this: Build passes clean. No orphaned components or dead modules. ~400 lines removed.

## Tasks
- [x] **T01: Deleted 14 orphaned files (930 lines) and 5 empty directories; TypeScript compiles clean with zero dangling references** — Delete all orphaned components, dead lib modules, unwired auth scaffolding, and their tests. Then remove directories that become empty. Verify TypeScript still compiles and no dangling references remain.

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
  - Estimate: 15m
  - Files: src/components/map/VesselLayer.tsx, src/components/map/TrackLayer.tsx, src/components/fleet/AnomalyMatrix.tsx, src/components/fleet/__tests__/AnomalyMatrix.test.tsx, src/lib/map/tracks.ts, src/lib/map/tracks.test.ts, src/proxy.ts, src/lib/sanctions/matcher.ts, src/lib/sanctions/matcher.test.ts, src/lib/auth.ts, src/lib/auth.test.ts, src/lib/auth/auth.test.ts, src/app/login/page.tsx, src/app/api/auth/login/route.ts
  - Verify: npx tsc --noEmit && echo 'tsc clean' && rg -l 'VesselLayer|TrackLayer|AnomalyMatrix|tracks|proxy|matcher|auth' src/ -g '*.ts' -g '*.tsx' --no-ignore-vcs | grep -v node_modules | grep -v 'opensanctions\|sanctions/db\|sanctions/types\|db/sanctions\|types/anomaly\|detection/\|constants/' | sort
