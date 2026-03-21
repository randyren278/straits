# Quick Task: Vessel Clustering + Ingester Cron Fix

**Date:** 2026-03-21
**Branch:** gsd/quick/1-since-all-of-the-ships-end-up-reporting

## What Changed

### Vessel Clustering & Spiderfy (co-located ship display)
- Enabled Mapbox GL built-in clustering on the vessel GeoJSON source (50px radius, max zoom 16)
- Added cluster circle layer with graduated sizes (16–40px for 2–200 vessels) and composition-based coloring (red for anomalies/sanctions, amber for tanker-majority, gray for mixed)
- Aggregated `tankerCount`, `anomalyCount`, `sanctionedCount` via Mapbox `clusterProperties` for smart cluster coloring
- Implemented **spiderfy** module: when clusters can't be broken by zooming further (vessels at identical coordinates in ports/anchorages), clicking fans them out in concentric rings with connecting leg lines
- Spider circles preserve full vessel color logic and are clickable for vessel selection
- Cluster hover shows Bloomberg-style popup with vessel composition breakdown
- Auto-clears spider legs on zoom, data refresh, and map background click
- Added dark terminal CSS for cluster popups

### Ingester Cron Fix (missed execution warning)
- **Root cause #1: Duplicate cron registration** — `connect()` runs on every WebSocket reconnect, re-calling `startDetectionJobs()` and `startRefreshJobs()`. After N reconnects, N copies of every cron job run simultaneously.  
  **Fix:** Added idempotency guard (`started` flag) to both functions.
- **Root cause #2: Sequential blocking** — The `*/30` cron ran 6 heavy detectors sequentially. Total wall time could exceed 15+ minutes, blocking `node-cron`'s timer.  
  **Fix:** Run independent detectors in parallel via `Promise.allSettled()`. Only `computeRiskScores` (dependent on anomaly data) remains sequential. Alert generation also parallelized.
- Added timing logs for observability and individual detector failure logging.

## Files Modified
- `src/components/map/VesselMap.tsx` — Clustering source config, cluster layers, spiderfy interaction, hover popup
- `src/lib/map/spiderfy.ts` — New module: radial fan-out geometry, Mapbox layer management
- `src/lib/map/spiderfy.test.ts` — 7 unit tests for spider position algorithm
- `src/app/globals.css` — Cluster popup CSS (Bloomberg dark aesthetic)
- `src/services/ais-ingester/detection-jobs.ts` — Idempotency guard, parallel detection, timing logs
- `src/services/ais-ingester/refresh-jobs.ts` — Idempotency guard, test reset export
- `src/services/ais-ingester/refresh-jobs.test.ts` — Updated to reset guard between test cases

## Verification
- `npx tsc --noEmit` — Zero type errors across entire project
- `npx vitest run src/lib/map/spiderfy.test.ts` — 7/7 pass (position count, center spread, zoom scaling, uniqueness, multi-ring, single vessel, large clusters)
- `npx vitest run src/services/ais-ingester/refresh-jobs.test.ts` — 4/4 pass + 3 todo (idempotency guard properly reset between tests)
