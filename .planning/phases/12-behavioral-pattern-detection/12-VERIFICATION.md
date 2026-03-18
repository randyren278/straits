---
phase: 12-behavioral-pattern-detection
verified: 2026-03-18T15:00:00Z
status: passed
score: 14/14 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 9/10
  gaps_closed:
    - "Vessel pairs within 0.5nm with positions in last 30 minutes get sts_transfer anomalies (PATT-03 semantic gap: 30-minute freshness window vs. sustained co-location)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Verify AnomalyBadge renders correctly for new types in UI"
    expected: "repeat_going_dark shows red-600 REPEAT badge; sts_transfer shows purple-600 STS badge"
    why_human: "Cannot programmatically verify visual rendering of React components"
  - test: "Verify destination change and proximity event tables are live-applied to the database"
    expected: "vessel_destination_changes and vessel_proximity_events tables exist in the production/staging database with correct columns and indexes"
    why_human: "Schema DDL in schema.sql requires manual or automated migration run — cannot verify DB state from code alone"
---

# Phase 12: Behavioral Pattern Detection — Verification Report

**Phase Goal:** Detect and alert on behavioral patterns that indicate evasion: repeated going-dark events on the same vessel and ship-to-ship transfers at sea.
**Verified:** 2026-03-18T15:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 03 closed PATT-03 semantic gap)

---

## Re-verification Summary

The initial verification (2026-03-18T06:30:00Z) found one semantic gap: PATT-03 required STS transfer detection "for 30+ minutes" but the implementation only enforced a 30-minute position-freshness window (data recency), not a sustained co-location duration. A gap-closure plan (12-03) was created and executed. This re-verification confirms the gap is closed and no regressions were introduced.

**Commits added since initial verification:**
- `c83e515` — feat(12-03): enforce 30-minute sustained proximity for STS transfer detection
- `536f748` — docs(12-03): complete STS sustained proximity enforcement plan

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | AnomalyType union includes repeat_going_dark and sts_transfer | ✓ VERIFIED | `src/types/anomaly.ts`: both types present in union |
| 2  | vessel_destination_changes table exists with correct schema | ✓ VERIFIED | `src/lib/db/schema.sql` lines 185-194: table DDL with id, imo, previous_destination, new_destination, changed_at columns + index |
| 3  | Destination changes are logged when a vessel's AIS destination changes mid-voyage | ✓ VERIFIED | `src/services/ais-ingester/index.ts`: `INSERT INTO vessel_destination_changes` wired with pre-upsert SELECT and post-upsert comparison |
| 4  | NULL-to-value destination transitions are ignored | ✓ VERIFIED | `index.ts`: `existing.rows[0].destination != null && v.destination != null` guard present |
| 5  | Vessels with 3+ going-dark events in 30 days get a repeat_going_dark anomaly | ✓ VERIFIED | `src/lib/detection/repeat-going-dark.ts`: SQL with `HAVING COUNT(*) >= 3` confirmed |
| 6  | repeat_going_dark anomaly auto-resolves when count drops below 3 | ✓ VERIFIED | `repeat-going-dark.ts`: bulk UPDATE `resolved_at = NOW()` for IMOs not in threshold subquery |
| 7  | vessel_proximity_events table tracks when vessel pairs are first observed within 0.5nm | ✓ VERIFIED | `src/lib/db/schema.sql` lines 198-204: table DDL with (imo_a, imo_b, first_seen_at, last_seen_at), PK (imo_a, imo_b) |
| 8  | STS transfer anomaly only fires when a pair has been within 0.5nm for 30+ minutes | ✓ VERIFIED | `sts-transfer.ts` line 107: `WHERE last_seen_at - first_seen_at >= INTERVAL '30 minutes'`; line 115: `if (!sustainedPairs.has(pairKey)) continue` |
| 9  | Proximity events are upserted (updated last_seen_at) on every cron run while pair remains close | ✓ VERIFIED | `sts-transfer.ts` line 93: `ON CONFLICT (imo_a, imo_b) DO UPDATE SET last_seen_at = NOW()` |
| 10 | Stale proximity events are cleaned up when pairs are no longer within 0.5nm | ✓ VERIFIED | `sts-transfer.ts` line 100: `DELETE FROM vessel_proximity_events WHERE last_seen_at < NOW() - INTERVAL '35 minutes'` |
| 11 | STS alerts flag BOTH vessels in the pair | ✓ VERIFIED | `sts-transfer.ts` lines 128-151: two separate upsertAnomaly calls per pair (vessel A and vessel B) |
| 12 | STS pairs are deduplicated (no A-B and B-A double logging) | ✓ VERIFIED | `sts-transfer.ts` line 75: `JOIN vessels b ON b.imo > a.imo`; same ordering enforced in vessel_proximity_events PK |
| 13 | Both new detectors run on the */30 cron schedule | ✓ VERIFIED | `detection-jobs.ts`: `detectRepeatGoingDark()` and `detectStsTransfers()` both called in the `*/30` cron handler |
| 14 | TypeScript compiles without errors | ✓ VERIFIED | `npx tsc --noEmit` exits 0 with no output |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/anomaly.ts` | Extended AnomalyType union + RepeatGoingDarkDetails + StsTransferDetails | ✓ VERIFIED | All interfaces present and exported; unions include both new types |
| `src/lib/db/schema.sql` | vessel_destination_changes DDL + vessel_proximity_events DDL | ✓ VERIFIED | Both tables present; index at line 194; PK at line 203 |
| `src/services/ais-ingester/index.ts` | Destination change detection in upsertVessel path | ✓ VERIFIED | Pre-upsert SELECT, case-insensitive comparison, INSERT, try/catch isolation all present |
| `src/lib/detection/repeat-going-dark.ts` | detectRepeatGoingDark() function | ✓ VERIFIED | Exports `detectRepeatGoingDark(): Promise<number>`; HAVING COUNT >= 3; auto-resolve SQL present |
| `src/lib/detection/sts-transfer.ts` | detectStsTransfers() with sustained proximity tracking | ✓ VERIFIED | Three-step process (upsert, delete, duration-gated fire); SUSTAINED_PROXIMITY_MINUTES = 30; 5 references to vessel_proximity_events |
| `src/services/ais-ingester/detection-jobs.ts` | Cron registration for both new detectors + alert generation | ✓ VERIFIED | Both imported and called in */30 handler; generateAlertsForNewAnomalies for both new types |
| `src/components/ui/AnomalyBadge.tsx` | Badge support for new anomaly types | ✓ VERIFIED | BADGE_CONFIG includes repeat_going_dark (red-600) and sts_transfer (purple-600) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/ais-ingester/index.ts` | vessel_destination_changes | INSERT on destination change | ✓ WIRED | `INSERT INTO vessel_destination_changes` present |
| `src/lib/detection/repeat-going-dark.ts` | `src/lib/db/anomalies.ts` | upsertAnomaly calls + direct SQL auto-resolve | ✓ WIRED | upsertAnomaly called per vessel; auto-resolve uses direct SQL UPDATE (resolveAnomaly import is dead code — no functional impact) |
| `src/lib/detection/sts-transfer.ts` | vessel_proximity_events | UPSERT + DELETE + SELECT duration check | ✓ WIRED | 5 references confirmed: INSERT, ON CONFLICT, DELETE, SELECT, duration filter |
| `src/lib/detection/sts-transfer.ts` | `src/lib/db/anomalies.ts` | upsertAnomaly only after 30-min duration confirmed | ✓ WIRED | upsertAnomaly calls inside `!sustainedPairs.has(pairKey)` guard |
| `src/services/ais-ingester/detection-jobs.ts` | `src/lib/detection/repeat-going-dark.ts` | import and cron invocation | ✓ WIRED | Imported and called in */30 cron |
| `src/services/ais-ingester/detection-jobs.ts` | `src/lib/detection/sts-transfer.ts` | import and cron invocation | ✓ WIRED | Imported and called in */30 cron |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| PATT-01 | 12-01, 12-02 | System identifies vessels that have gone dark 3+ times in the past 30 days and marks them as repeat offenders | ✓ SATISFIED | `detectRepeatGoingDark()` queries vessel_anomalies for going_dark events HAVING COUNT >= 3 in 30 days; upserts repeat_going_dark with confidence 'confirmed'; auto-resolves when count drops below threshold |
| PATT-02 | 12-01 | System detects when a vessel changes its declared AIS destination while underway and logs each change with timestamps | ✓ SATISFIED | `upsertVessel()` logs to vessel_destination_changes with changed_at timestamp; NULL-to-value transitions ignored; case-insensitive comparison |
| PATT-03 | 12-01, 12-02, 12-03 | System detects when two vessels are within 0.5nm of each other for 30+ minutes and flags as a potential ship-to-ship transfer | ✓ SATISFIED | 0.5nm threshold (0.926km haversine); vessel_proximity_events tracks first_seen_at per pair; anomaly only fires when `last_seen_at - first_seen_at >= 30 minutes`; both vessels flagged; pairs deduplicated via `b.imo > a.imo` |

All three requirements fully satisfied. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/detection/repeat-going-dark.ts` | 11 | `resolveAnomaly` imported but never called (dead import) | ℹ Info | No functional impact; auto-resolve uses direct SQL UPDATE which is more efficient. Lint warning only. |

No TODO/FIXME/placeholder comments, stub implementations, or empty handlers found in any phase 12 files.

---

### Human Verification Required

#### 1. AnomalyBadge Visual Rendering

**Test:** Open the vessel detail panel or watchlist for a vessel with a `repeat_going_dark` or `sts_transfer` anomaly and inspect the badge.
**Expected:** repeat_going_dark renders a red-600 badge labeled "REPEAT" with a Radio icon; sts_transfer renders a purple-600 badge labeled "STS" with an AlertTriangle icon.
**Why human:** Cannot verify React component visual rendering programmatically.

#### 2. Database Schema Migration Applied

**Test:** Connect to the live/staging database and run `\d vessel_destination_changes` and `\d vessel_proximity_events` in psql.
**Expected:** Both tables exist with correct columns. vessel_destination_changes has (id, imo, previous_destination, new_destination, changed_at) with index idx_dest_changes_imo_time. vessel_proximity_events has (imo_a, imo_b, first_seen_at, last_seen_at) with PK (imo_a, imo_b).
**Why human:** schema.sql contains the DDL but the migration must be manually applied — codebase verification cannot confirm database state.

---

## Gap Closure Confirmation

**Closed gap:** PATT-03 "30+ minutes together" semantic mismatch.

The previous implementation used a 30-minute position-freshness window — a data-recency check, not a sustained co-location timer. A single coincident AIS ping could trigger the alert.

Plan 03 closed this by adding a `vessel_proximity_events` tracking table (`schema.sql` lines 196-204) with `(imo_a, imo_b, first_seen_at, last_seen_at)` and a composite PK. The refactored `detectStsTransfers()` now follows a three-step process each cron run:

1. UPSERT proximity events for all currently-close pairs (updating `last_seen_at`)
2. DELETE stale events where `last_seen_at < NOW() - 35 minutes` (pairs that drifted apart)
3. Fire `upsertAnomaly` only for pairs where `last_seen_at - first_seen_at >= 30 minutes`

This enforces the literal requirement text. A pair must persist across multiple cron runs spanning 30+ minutes before an anomaly is raised.

---

_Verified: 2026-03-18T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after: 12-03 gap-closure plan_
