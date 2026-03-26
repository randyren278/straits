# S01: Staleness Sync & Map Fix — UAT

**Milestone:** M009
**Written:** 2026-03-26T18:47:32.734Z

## UAT: Staleness Sync & Map Fix\n\n### Test 1: Map renders all vessels\n- Navigate to /dashboard\n- Wait for data load\n- Zoom out to see full extent\n- **Expected**: Dense clusters of dots near Cyprus/Israel and UAE\n- **Result**: ✅ PASS — 399 vessels visible in two main clusters\n\n### Test 2: No console warnings\n- Open browser DevTools console on /dashboard\n- **Expected**: Zero Mapbox GL expression evaluation warnings\n- **Result**: ✅ PASS — no warnings\n\n### Test 3: Fleet tab data consistency\n- Navigate to /fleet\n- **Expected**: 960 active anomalies displayed, all vessel IMOs present on map\n- **Result**: ✅ PASS — 272 unique IMOs, all ⊆ 399 map vessels\n\n### Test 4: Staleness constants audit\n- Run `rg STALENESS src/`\n- **Expected**: All display queries use constants from staleness.ts\n- **Result**: ✅ PASS — 5 files, all importing from staleness.ts
