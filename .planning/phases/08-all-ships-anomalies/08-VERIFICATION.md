---
phase: 08-all-ships-anomalies
verified: 2026-03-17T22:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 8: All-Ships Anomalies Verification Report

**Phase Goal:** Anomaly detection runs on every vessel type in the AIS stream, not just tankers, and users can filter the alerts panel by ship type to focus on the vessel classes they care about
**Verified:** 2026-03-17T22:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                 | Status     | Evidence                                                                                  |
| --- | --------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| 1   | Going-dark detection runs on all vessels, not only ship_type 80-89    | VERIFIED   | `going-dark.ts` L82-92: query has no ship_type clause; confirmed by grep returning 0 hits |
| 2   | Loitering detection runs on all vessels regardless of ship type       | VERIFIED   | `loitering.ts` L87-98: query JOINs vessels with no ship_type WHERE clause                |
| 3   | Speed anomaly detection runs on all vessels regardless of ship type   | VERIFIED   | `deviation.ts` L57-63: query has no ship_type clause                                     |
| 4   | The anomaly/alerts panel displays a ship type filter (All/Tanker/Cargo/Other) | VERIFIED | `NotificationBell.tsx` L16-23, L111-126: FILTER_BUTTONS array + rendered button row      |
| 5   | Selecting a ship type limits visible alerts to that vessel class only  | VERIFIED   | `handleFilterClick` calls `fetchAnomalies(filter)` which builds `?shipType=` URL param   |
| 6   | Selecting 'All' shows every alert regardless of ship type             | VERIFIED   | `fetchAnomalies` omits `?shipType=` param when filter is `'all'` (L37-39)                |
| 7   | Filtering is display-only — detection logic is not changed            | VERIFIED   | Ship-type clause only in `route.ts` GET handler; detection files unchanged in behavior   |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact                                        | Expected                                             | Status     | Details                                                                             |
| ----------------------------------------------- | ---------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `src/lib/detection/going-dark.ts`               | Going-dark detection query without ship_type filter  | VERIFIED   | 129 lines, exports `detectGoingDark`, `shouldFlagAsGoingDark`, `determineConfidence`; no `ship_type BETWEEN` in SQL |
| `src/lib/detection/loitering.ts`                | Loitering detection query without ship_type filter   | VERIFIED   | 143 lines, exports `detectLoitering`, `isLoiteringBehavior`, `calculateCentroid`; no `ship_type BETWEEN` in SQL |
| `src/lib/detection/deviation.ts`                | Speed anomaly detection without ship_type filter     | VERIFIED   | 109 lines, exports `detectSpeedAnomaly`, `isSpeedAnomaly`; no `ship_type BETWEEN` in SQL |
| `src/app/api/anomalies/route.ts`                | GET /api/anomalies with optional ?shipType= filter   | VERIFIED   | 63 lines, exports `GET`; conditional LEFT JOIN + ship_type clause via controlled switch |
| `src/components/ui/NotificationBell.tsx`        | Alert dropdown with ship type filter buttons         | VERIFIED   | 162 lines, exports `NotificationBell`; renders ALL/TANKER/CARGO/OTHER filter buttons with amber active state |

---

### Key Link Verification

| From                                      | To                         | Via                              | Status     | Details                                                                                  |
| ----------------------------------------- | -------------------------- | -------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `src/lib/detection/going-dark.ts`         | `vessel_anomalies` table   | `upsertAnomaly`                  | WIRED      | `upsertAnomaly` imported from `../db/anomalies` and called at L105 for each candidate   |
| `src/lib/detection/loitering.ts`          | `vessel_anomalies` table   | `upsertAnomaly`                  | WIRED      | `upsertAnomaly` imported from `../db/anomalies` and called at L127 for loitering vessels |
| `src/components/ui/NotificationBell.tsx`  | `/api/anomalies`           | `fetch` with `?shipType=` param  | WIRED      | `fetchAnomalies` uses `/api/anomalies?shipType=${filter}` or `/api/anomalies` (L37-39)  |
| `src/app/api/anomalies/route.ts`          | `vessels` table            | `LEFT JOIN vessels`              | WIRED      | `LEFT JOIN vessels v ON v.imo = va.imo` at L32 when `needsJoin` is true                 |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                              | Status    | Evidence                                                                             |
| ----------- | ----------- | ------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------ |
| ANOM-05     | 08-01-PLAN  | Anomaly detection runs on all ship types, not just tankers               | SATISFIED | `ship_type BETWEEN 80 AND 89` absent from all three detection files; tests assert `.not.toContain` |
| ANOM-06     | 08-02-PLAN  | User can filter the anomaly/alerts panel by ship type                    | SATISFIED | NotificationBell renders 4 filter buttons; API accepts `?shipType=` and applies LEFT JOIN |

No orphaned requirements — both phase 8 requirement IDs (ANOM-05, ANOM-06) are declared in plan frontmatter and fully implemented.

---

### Anti-Patterns Found

| File                                      | Lines     | Pattern                         | Severity | Impact                                                                                        |
| ----------------------------------------- | --------- | -------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `src/lib/detection/deviation.ts`          | 15, 20, 39 | JSDoc comments still say "tanker/tankers" | Info   | Comments are cosmetically stale but the SQL query is correct (no ship_type filter). Functional behavior is correct. |
| `src/lib/detection/deviation.test.ts`     | 5, 33, 38, 43, 49, 95, 119, 135 | Test descriptions say "tanker" | Info | Test descriptions were not fully updated to "vessel/all vessels" per plan, but the critical regression-guard test (`does NOT exclude non-tanker vessel`) is present and correct. |

No blockers. No warnings. Both findings are cosmetic comment staleness with zero impact on runtime behavior or correctness.

---

### Human Verification Required

#### 1. Filter button active state rendering

**Test:** Open the dashboard, click the notification bell, then click TANKER, CARGO, and OTHER filter buttons.
**Expected:** Active button renders with amber border (`border-amber-500`), amber text (`text-amber-500`), and amber background tint (`bg-amber-500/10`). Inactive buttons render in gray.
**Why human:** CSS class application requires visual inspection; grep confirms class strings are present but rendering depends on Tailwind purge and browser paint.

#### 2. Filter re-fetch on button click

**Test:** With some active anomalies present, switch between ALL / TANKER / CARGO / OTHER.
**Expected:** Alert list updates to show only anomalies for the selected vessel class. Switching back to ALL restores the full list.
**Why human:** Requires live DB data with mixed vessel types to observe actual filter behavior. Grep confirms fetch URL construction but not server-side filtering correctness under real data.

#### 3. 30-second polling respects active filter

**Test:** Select CARGO filter, then wait 30+ seconds without interaction.
**Expected:** Polling refresh continues to fetch `?shipType=cargo`, not fall back to all anomalies.
**Why human:** Stale-closure behavior via `useRef` is correct in code review (L32, L53, L62), but confirming the interval fires with the right filter requires live observation.

---

### Gaps Summary

No gaps. All automated checks passed.

Both requirement IDs (ANOM-05, ANOM-06) are fully implemented and wired:

- ANOM-05: The `ship_type BETWEEN 80 AND 89` clause is confirmed absent from all three detection files (`going-dark.ts`, `loitering.ts`, `deviation.ts`). Test files include regression guards asserting `.not.toContain('ship_type BETWEEN 80 AND 89')` and positive-detection tests for a cargo vessel (ship_type 72).

- ANOM-06: `GET /api/anomalies` accepts `?shipType=tanker|cargo|other` via a controlled switch that injects a SQL fragment into a LEFT JOIN query. `NotificationBell.tsx` renders four filter buttons (ALL/TANKER/CARGO/OTHER), uses `useRef` to track current filter in the 30-second polling interval, and passes the filter to the fetch URL on each button click and interval tick.

Three items flagged for human verification (visual filter state, live re-fetch, polling filter persistence) — all require a running app with real data to confirm. Automated evidence strongly supports correct implementation.

---

_Verified: 2026-03-17T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
