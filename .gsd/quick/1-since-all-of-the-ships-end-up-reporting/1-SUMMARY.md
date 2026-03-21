# Quick Task: Vessel Clustering + Cluster Panel + Ingester Cron Fix

**Date:** 2026-03-21
**Branch:** gsd/quick/1-since-all-of-the-ships-end-up-reporting

## What Changed

### Vessel Clustering (co-located ship display)
- Enabled Mapbox GL built-in clustering on the vessel GeoJSON source (50px radius, max zoom 16)
- Cluster circles with graduated sizes (16–40px for 2–200 vessels) and composition-based coloring (red for anomalies/sanctions, amber for tanker-majority, gray for mixed)
- Aggregated `tankerCount`, `anomalyCount`, `sanctionedCount` via Mapbox `clusterProperties`
- Cluster hover shows Bloomberg-style popup with vessel composition breakdown
- Click-to-zoom expands clusters at lower zoom levels

### Cluster Expand Panel (max-zoom co-located vessels)
- When clicking a cluster that can't zoom further (identical coordinates at port/anchorage), opens a scrollable vessel list panel in the right sidebar
- Bloomberg terminal aesthetic matching existing panels (black bg, amber accents, JetBrains Mono, sharp corners)
- Summary stats bar showing tanker/anomaly/sanctioned counts
- Sorted list: anomalies first → sanctioned → tankers → alphabetical
- Each row: status dot, vessel name, anomaly tag (DARK/LOITER/SPEED/etc), flag, ship type, speed
- Clicking a row selects the vessel (opens VesselPanel, dismisses cluster panel)
- New `clusterVessels` state in Zustand store with mutual exclusion (selecting vessel clears cluster)

### Ingester Cron Fix (missed execution warning)
- **Root cause #1: Duplicate cron registration** — `connect()` re-registers cron jobs on every WebSocket reconnect. Fixed with idempotency guard.
- **Root cause #2: Sequential blocking** — 6 heavy detectors ran sequentially. Fixed with `Promise.allSettled()` parallelization.
- Added timing logs and individual detector failure logging.

## Files Modified
- `src/components/map/VesselMap.tsx` — Clustering source, layers, hover popup, cluster-expand-to-panel logic
- `src/components/panels/ClusterPanel.tsx` — New: scrollable vessel list for expanded clusters
- `src/stores/vessel.ts` — Added `ClusterVessel` type, `clusterVessels` state, `setClusterVessels` action
- `src/app/(protected)/dashboard/page.tsx` — Wired ClusterPanel into right sidebar
- `src/app/globals.css` — Cluster popup CSS
- `src/services/ais-ingester/detection-jobs.ts` — Idempotency guard, parallel detection
- `src/services/ais-ingester/refresh-jobs.ts` — Idempotency guard
- `src/services/ais-ingester/refresh-jobs.test.ts` — Updated for guard reset

## Verification
- `npx tsc --noEmit` — Zero type errors
- `npx vitest run` — 397 tests pass across 37 files (0 failures)
