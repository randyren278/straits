# M009: 

## Vision
Ensure all display views (map, fleet, chokepoints, anomalies) use a consistent 7-day staleness window so every vessel visible in one tab is visible in all tabs. Fix the Mapbox GL expression bug that silently drops vessels with null shipType.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Staleness Sync & Map Fix | low | — | ✅ | Map renders all 399 vessels, chokepoints show 7-day counts, zero console warnings |
