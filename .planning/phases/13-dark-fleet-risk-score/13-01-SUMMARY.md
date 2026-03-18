---
phase: 13-dark-fleet-risk-score
plan: 01
subsystem: api
tags: [risk-score, anomaly-detection, postgresql, node-cron, nextjs]

# Dependency graph
requires:
  - phase: 12-behavioral-pattern-detection
    provides: vessel_anomalies rows for sts_transfer; detection-jobs.ts cron pattern
  - phase: 03-anomaly-detection
    provides: vessel_anomalies table and going_dark/loitering anomaly types
  - phase: 02-intelligence-layers
    provides: vessel_sanctions table for sanctions factor
provides:
  - vessel_risk_scores DDL (imo PK, score INT, factors JSONB, computed_at TIMESTAMPTZ)
  - computeRiskScores() — single-query aggregation returning vessels-scored count
  - upsertRiskScore() / getRiskScore() — risk score DB CRUD
  - GET /api/vessels/[imo]/risk endpoint returning { score, factors, computedAt }
  - 30-minute cron registration for automatic score recomputation
affects:
  - phase-14-vessel-panel (consumes GET /api/vessels/[imo]/risk for panel display)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Single aggregation query (LEFT JOIN vessel_anomalies + vessels + vessel_sanctions, GROUP BY) to avoid N+1 per-vessel queries
    - Binary factors (loitering, STS) scored 0/10; scaled factor (going-dark) scored count*8 capped at 40
    - getRiskScore() returns zero-score default for vessels not in table (no anomaly history)

key-files:
  created:
    - src/lib/db/schema.sql (vessel_risk_scores DDL section)
    - src/lib/db/risk-scores.ts
    - src/lib/detection/risk-score.ts
    - src/app/api/vessels/[imo]/risk/route.ts
  modified:
    - src/lib/db/schema.sql
    - src/services/ais-ingester/detection-jobs.ts

key-decisions:
  - "Single aggregation SQL query across vessel_anomalies + vessels + vessel_sanctions avoids N+1 queries for risk scoring"
  - "Sanctions factor uses vessel_sanctions table JOIN (not anomaly type) — direct source of truth"
  - "Zero-anomaly vessels excluded from vessel_risk_scores table; getRiskScore() returns 0-score default without DB hit"
  - "Next.js 16 async params used: await params before accessing imo in risk/route.ts"

patterns-established:
  - "Risk score computation: export async function returning Promise<number> (count processed) — matches existing detector pattern"
  - "getRiskScore() zero-default pattern: if no row found return all-zero struct — callers never need null checks"

requirements-completed: [RISK-01, RISK-02]

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 13 Plan 01: Dark Fleet Risk Score — Schema, Computation, and API Summary

**Per-vessel dark fleet risk score (0–100) with factor breakdown stored in vessel_risk_scores, recomputed every 30 min via cron, exposed via GET /api/vessels/[imo]/risk**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-18T21:26:03Z
- **Completed:** 2026-03-18T21:34:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- vessel_risk_scores table DDL added to schema.sql with imo PK, score INTEGER, factors JSONB, computed_at TIMESTAMPTZ
- computeRiskScores() uses single aggregation SQL across three tables — no N+1 per-vessel round trips
- Score weights: going-dark 40pts (8/event, cap 5 events), sanctions 25pts, flag risk 15pts (IR/RU/VE/KP/PA/CM/KM), loitering 10pts binary, STS 10pts binary
- getRiskScore() returns zero-score default `{ score: 0, factors: all-zero, computedAt: null }` for vessels with no anomaly history
- Cron registered in existing */30 block after all other detectors; detection-jobs.ts RISK-02 noted in header

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema, DB operations, and risk score computation** - `851e24f` (feat)
2. **Task 2: Cron registration and API endpoint** - `919be9e` (feat)

**Plan metadata:** _(pending final docs commit)_

## Files Created/Modified
- `src/lib/db/schema.sql` - Added Phase 13 section with vessel_risk_scores DDL
- `src/lib/db/risk-scores.ts` - RiskFactors interface, upsertRiskScore(), getRiskScore() with zero-default
- `src/lib/detection/risk-score.ts` - computeRiskScores() with single aggregation query and JS-side factor computation
- `src/app/api/vessels/[imo]/risk/route.ts` - GET endpoint using Next.js 16 async params pattern
- `src/services/ais-ingester/detection-jobs.ts` - Import + registration of computeRiskScores in */30 cron; RISK-02 in header

## Decisions Made
- Single aggregation query chosen over N+1 per-vessel: LEFT JOIN vessel_anomalies + vessels + vessel_sanctions, GROUP BY imo; factor scores computed in JS from row data
- Sanctions factor checks vessel_sanctions table directly (not anomaly type) — this is the authoritative sanctions source
- Zero-anomaly vessels not stored in vessel_risk_scores; getRiskScore() returns 0-score default without a DB miss causing an error

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. The vessel_risk_scores table will be created when schema.sql is re-applied to the database.

## Next Phase Readiness
- GET /api/vessels/[imo]/risk is live and returns `{ score, factors, computedAt }` for all vessels
- Phase 14 (vessel panel display) can consume this endpoint directly
- Risk scores begin populating automatically when the 30-minute cron next fires

---
*Phase: 13-dark-fleet-risk-score*
*Completed: 2026-03-18*
