---
phase: 12-behavioral-pattern-detection
plan: "02"
subsystem: detection
tags: [anomaly-detection, sts-transfer, repeat-going-dark, cron, behavioral-patterns]
dependency_graph:
  requires: ["12-01"]
  provides: [repeat_going_dark-anomalies, sts_transfer-anomalies]
  affects: [vessel_anomalies-table, detection-cron-30min]
tech_stack:
  added: []
  patterns: [haversine-sql, going-dark-detector-pattern, pair-deduplication-imo-gt]
key_files:
  created:
    - src/lib/detection/repeat-going-dark.ts
    - src/lib/detection/sts-transfer.ts
  modified:
    - src/services/ais-ingester/detection-jobs.ts
decisions:
  - "Repeat going-dark uses direct SQL UPDATE for auto-resolve rather than calling resolveAnomaly() per-vessel — one query handles all IMOs not in threshold set"
  - "STS: b.imo > a.imo join condition (not LEAST/GREATEST DISTINCT ON) chosen as primary dedup — simpler, same result"
  - "INTERVAL string interpolation used for WINDOW_DAYS constant — avoids parameterized interval casting complexity"
metrics:
  duration: "~2 min"
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_changed: 3
---

# Phase 12 Plan 02: Repeat Going-Dark and STS Transfer Detectors Summary

Implemented two behavioral pattern detectors — `detectRepeatGoingDark` (3+ dark events in 30 days flags confirmed evasion pattern) and `detectStsTransfers` (haversine SQL pair-finding within 0.5nm flags suspected cargo rendezvous for both vessels) — then registered both in the 30-minute cron schedule with alert generation.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Implement repeat going-dark and STS transfer detectors | 9781a41 | src/lib/detection/repeat-going-dark.ts, src/lib/detection/sts-transfer.ts |
| 2 | Register new detectors in cron schedule | 56609b7 | src/services/ais-ingester/detection-jobs.ts |

## What Was Built

**`src/lib/detection/repeat-going-dark.ts`**
- `detectRepeatGoingDark(): Promise<number>` — queries `vessel_anomalies` for going_dark events (both active and resolved) in the last 30 days, groups by IMO, returns vessels with COUNT >= 3
- Upserts `repeat_going_dark` anomaly with `confidence: 'confirmed'` and details including count, window, and chronological event list
- Auto-resolves existing `repeat_going_dark` anomalies for vessels that have fallen below the threshold via a single bulk UPDATE

**`src/lib/detection/sts-transfer.ts`**
- `detectStsTransfers(): Promise<number>` — SQL haversine query finds vessel pairs within 0.926km (0.5nm) where both vessels have positions within the last 30 minutes
- `b.imo > a.imo` join condition ensures each pair is found exactly once (lexicographic deduplication)
- For each pair, upserts TWO anomalies: each vessel gets `sts_transfer` with `confidence: 'suspected'` and details pointing to the other vessel (IMO, name, distance, own position)
- Returns total count (2 per pair)

**`src/services/ais-ingester/detection-jobs.ts`**
- Added imports for both new detectors
- Both called in the `*/30` cron handler after existing detectors
- Console log extended with `repeat_dark` and `sts` counts
- `generateAlertsForNewAnomalies` wired for `repeat_going_dark` and `sts_transfer`
- Header comment updated with PATT-01, PATT-03 requirements
- Startup log updated to mention new detector types

## Decisions Made

- **Bulk auto-resolve SQL**: Used a single `UPDATE ... WHERE imo NOT IN (subquery)` rather than looping through `resolveAnomaly()` per vessel — more efficient and atomically correct.
- **`b.imo > a.imo` dedup**: Join condition `b.imo > a.imo` chosen as primary pair deduplication over the `DISTINCT ON (LEAST, GREATEST)` approach from the plan spec — simpler execution plan, same guarantee.
- **Interval string interpolation**: Constants like `WINDOW_DAYS` and `POSITION_FRESHNESS_MINUTES` interpolated directly into SQL string rather than parameterized — avoids PostgreSQL interval cast syntax with `$1 days`, values are internal constants not user input.

## Deviations from Plan

None — plan executed exactly as written. The `b.imo > a.imo` approach was offered in the plan spec as an alternative to `LEAST/GREATEST DISTINCT ON` and was chosen as the primary implementation.

## Self-Check

Verified:
- `src/lib/detection/repeat-going-dark.ts` — exists, exports `detectRepeatGoingDark`
- `src/lib/detection/sts-transfer.ts` — exists, exports `detectStsTransfers`
- `src/services/ais-ingester/detection-jobs.ts` — modified, contains 4 references to both detector names, 2 references to new anomaly type strings
- `npx tsc --noEmit` — passes cleanly
- Commits 9781a41 and 56609b7 — both present
