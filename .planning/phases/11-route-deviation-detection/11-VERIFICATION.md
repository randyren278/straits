---
phase: 11-route-deviation-detection
verified: 2026-03-17T00:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 11: Route Deviation Detection Verification Report

**Phase Goal:** Users can see when a vessel's heading contradicts its declared destination — surfaced the same way as any other anomaly
**Verified:** 2026-03-17
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                           | Status     | Evidence                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | When a vessel's heading diverges >45 degrees from the bearing to its declared AIS destination for 2+ hours, a route deviation anomaly is created | ✓ VERIFIED | `detectDeviation()` queries 2-hour window with `HAVING COUNT(*) >= 2`, checks `isDeviating()` on all positions, calls `upsertAnomaly` with `anomalyType: 'deviation'` and `confidence: 'suspected'` |
| 2   | Route deviation anomalies appear in the notification bell and on the map via existing anomaly pipeline                                          | ✓ VERIFIED | `generateAlertsForNewAnomalies('deviation')` called in cron; `AnomalyBadge.tsx` handles `'deviation'` type; `VesselMap.tsx` layer filter includes `'deviation'`; `VesselPanel.tsx` displays deviation text |
| 3   | When a vessel's heading returns within 45 degrees of the expected bearing, the deviation anomaly is auto-resolved                               | ✓ VERIFIED | `detectDeviation()` calls `resolveAnomaly(vessel.imo, 'deviation')` in the `else` branch when `allDeviating` is false (deviation.ts line 264) |
| 4   | Nominatim geocoding results are cached in-memory to avoid redundant API calls                                                                   | ✓ VERIFIED | Module-level `geocodeCache = new Map<string, { lat: number; lon: number } | null>()` at deviation.ts line 30; cache checked before fetch, null results also cached on both empty results and fetch error |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                                              | Expected                                                                    | Status     | Details                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `src/lib/detection/deviation.ts`                      | detectDeviation(), geocodeDestination(), isDeviating() with Nominatim, bearing comparison, upsert/resolve logic | ✓ VERIFIED | 269 lines; all three exported functions present; nominatim.openstreetmap.org URL at line 125; User-Agent TankerTracker/1.0 at line 127; DEVIATION_THRESHOLD_DEGREES = 45 at line 24; INTERVAL '2 hours' at line 196 |
| `src/services/ais-ingester/detection-jobs.ts`         | deviation detection registered in 30-minute cron with alert generation      | ✓ VERIFIED | `detectDeviation` imported line 16; called line 44 in `*/30` cron; `generateAlertsForNewAnomalies('deviation')` line 48 |

### Key Link Verification

| From                                           | To                              | Via                              | Status     | Details                                                                        |
| ---------------------------------------------- | ------------------------------- | -------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| `src/lib/detection/deviation.ts`               | `src/lib/geo/haversine.ts`      | `import calculateBearing`        | ✓ WIRED    | Import line 13; called at lines 221 and 236 inside detectDeviation()           |
| `src/lib/detection/deviation.ts`               | `src/lib/db/anomalies.ts`       | `import upsertAnomaly, resolveAnomaly` | ✓ WIRED | Import line 12; upsertAnomaly called lines 86 (speed) and 253 (deviation); resolveAnomaly called line 264 |
| `src/services/ais-ingester/detection-jobs.ts`  | `src/lib/detection/deviation.ts` | `import detectDeviation`        | ✓ WIRED    | Import line 16; called line 44; result stored in `deviationCount`              |
| `src/services/ais-ingester/detection-jobs.ts`  | `src/lib/db/alerts.ts`          | `generateAlertsForNewAnomalies('deviation')` | ✓ WIRED | Called line 48 inside the */30 cron callback                           |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                      | Status       | Evidence                                                                                                                              |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| DEVI-01     | 11-01-PLAN  | System detects when a vessel's recent heading contradicts its declared AIS destination and flags it as a route deviation anomaly | ✓ SATISFIED | detectDeviation() compares heading to bearing-to-destination for all positions in 2-hour window; upserts anomaly with type 'deviation' when all positions deviate; auto-resolves when heading corrects |
| DEVI-02     | 11-01-PLAN  | Route deviation anomalies flow through the existing anomaly pipeline (notification bell, map badge, vessel panel) | ✓ SATISFIED | generateAlertsForNewAnomalies('deviation') wired in cron; AnomalyBadge.tsx handles 'deviation' type; VesselMap.tsx layer filter includes 'deviation'; VesselPanel.tsx renders deviation text |

No orphaned requirements — both DEVI-01 and DEVI-02 are claimed by 11-01-PLAN and verified as satisfied.

### Anti-Patterns Found

No anti-patterns detected.

- No TODO/FIXME/HACK/PLACEHOLDER comments in modified files
- No stub return values (return null / return 0 / return {}) — detectDeviation() queries DB and returns real count
- No empty handlers
- Existing isSpeedAnomaly() and detectSpeedAnomaly() functions confirmed untouched

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| —    | —    | —       | —        | —      |

### Human Verification Required

None. All goal truths are verifiable via static code inspection:

- The detection logic (query, geocode, bearing comparison, threshold) is implemented and fully readable in deviation.ts
- The cron wiring is directly visible in detection-jobs.ts
- The UI pipeline handling of 'deviation' type is confirmed in AnomalyBadge, VesselMap, and VesselPanel

### Commit Verification

Both commits documented in SUMMARY exist in git history:

- `acb1749` — feat(11-01): implement detectDeviation() with Nominatim geocoding and bearing comparison
- `5f4d71d` — feat(11-01): register deviation detection in 30-minute cron with alert generation

TypeScript compilation: `npx tsc --noEmit` passes with zero errors.

### Additional Notes

- The test file `src/lib/detection/deviation.test.ts` was updated as part of Task 2 (noted in SUMMARY as an auto-fixed issue). The test file now mocks `resolveAnomaly` and `calculateBearing` correctly and includes 17 tests covering `isDeviating`, `geocodeDestination`, and `detectDeviation` behavioral cases.
- The geocodeDestination cache is module-level and persists for the process lifetime (per-restart), which matches the stated design decision in 11-CONTEXT.md.
- Shortest-arc angular difference is correctly implemented: `diff > 180 ? 360 - diff : diff` at isDeviating() line 159.

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier)_
