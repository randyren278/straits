---
phase: 13-dark-fleet-risk-score
verified: 2026-03-18T22:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
gaps: []
human_verification: []
---

# Phase 13: Dark Fleet Risk Score Verification Report

**Phase Goal:** Every vessel has a computed 0–100 risk score that reflects its evasion history — and the score stays current as new events occur
**Verified:** 2026-03-18T22:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A vessel with going-dark, sanctions, and loitering history has a risk score reflecting all three factors | VERIFIED | `computeRiskScores()` aggregates all three via single LEFT JOIN query; factors computed in JS and upserted |
| 2 | The risk score recomputes automatically every 30 minutes for vessels with anomaly records | VERIFIED | `detection-jobs.ts` line 50: `const riskCount = await computeRiskScores()` inside `*/30 * * * *` cron block |
| 3 | A vessel with zero anomaly history returns score 0 with all-zero factors from the API | VERIFIED | `getRiskScore()` returns `{ score: 0, factors: { goingDark: 0, flagRisk: 0, sanctions: 0, loitering: 0, sts: 0 }, computedAt: null }` when no row found |
| 4 | Factor breakdown integers sum to the total score and respect individual caps | VERIFIED | `goingDark = Math.min(darkCount * 8, 40)`, binary 10/0 for loitering and STS, 15/0 for flagRisk, 25/0 for sanctions; total = sum of factors; max possible = 40+15+25+10+10 = 100 |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/db/schema.sql` | vessel_risk_scores DDL | VERIFIED | Lines 212–217: `CREATE TABLE IF NOT EXISTS vessel_risk_scores` with imo TEXT PK, score INTEGER, factors JSONB, computed_at TIMESTAMPTZ |
| `src/lib/detection/risk-score.ts` | `computeRiskScores()` function | VERIFIED | 83-line file; exports `computeRiskScores(): Promise<number>`; substantive single-query aggregation implementation |
| `src/lib/db/risk-scores.ts` | DB operations for risk scores | VERIFIED | Exports `upsertRiskScore`, `getRiskScore`, `RiskFactors`; `ON CONFLICT (imo) DO UPDATE` at line 39; zero-default return at lines 67–71 |
| `src/app/api/vessels/[imo]/risk/route.ts` | GET endpoint for risk score | VERIFIED | Exports `GET`; uses Next.js 16 async params pattern (`await params`); calls `getRiskScore(imo)` and returns `NextResponse.json(risk)` |
| `src/services/ais-ingester/detection-jobs.ts` | Cron registration | VERIFIED | Line 19: `import { computeRiskScores } from '../../lib/detection/risk-score'`; line 50: `const riskCount = await computeRiskScores()` in `*/30` block |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `detection-jobs.ts` | `risk-score.ts` | `import computeRiskScores` | WIRED | Line 19: `import { computeRiskScores } from '../../lib/detection/risk-score'`; line 50: called and result stored in `riskCount` |
| `risk-score.ts` | `risk-scores.ts` | `upsertRiskScore` call | WIRED | Line 15: `import { upsertRiskScore } from '../db/risk-scores'`; line 77: `await upsertRiskScore(row.imo, score, factors)` inside loop |
| `risk/route.ts` | `risk-scores.ts` | `getRiskScore` call | WIRED | Line 6: `import { getRiskScore } from '@/lib/db/risk-scores'`; line 15: `const risk = await getRiskScore(imo)` returned as JSON |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RISK-01 | 13-01-PLAN.md | Each vessel has a computed dark fleet risk score (0–100) factoring going-dark frequency, flag state risk, active sanctions, loitering history, and STS events | SATISFIED | `computeRiskScores()` computes all five factors with correct weights; stored in `vessel_risk_scores`; exposed via `GET /api/vessels/[imo]/risk` returning `{ score, factors, computedAt }` |
| RISK-02 | 13-01-PLAN.md | Risk score is recomputed automatically when new anomaly events are detected for a vessel | SATISFIED | `computeRiskScores()` registered in the `*/30 * * * *` cron block in `detection-jobs.ts` alongside all other anomaly detectors; fires every 30 minutes after anomaly detection runs |

No orphaned requirements — all requirements mapped to Phase 13 in REQUIREMENTS.md (RISK-01, RISK-02) are claimed and implemented in 13-01-PLAN.md.

### Anti-Patterns Found

None. No TODOs, FIXMEs, placeholder returns, stub implementations, or empty handlers found in any phase 13 file.

### Human Verification Required

None. All aspects of this phase are verifiable programmatically:
- Schema DDL is textual and fully inspectable
- Computation logic is deterministic and code-readable
- API wiring is confirmed by import + call tracing
- TypeScript compilation passes cleanly (zero errors)

### Additional Verification Notes

**TypeScript compilation:** `npx tsc --noEmit` exits with no output (clean).

**Commit integrity:** Both task commits documented in SUMMARY are present in git log:
- `851e24f` — Schema, DB operations, and risk score computation
- `919be9e` — Cron registration and API endpoint

**Factor weight verification:**
- going-dark: `Math.min(darkCount * 8, 40)` — 8 pts/event, cap at 5 events = 40 max. Correct.
- flagRisk: `HIGH_RISK_FLAGS.includes(row.flag) ? 15 : 0` — array is `['IR', 'RU', 'VE', 'KP', 'PA', 'CM', 'KM']`. Correct.
- sanctions: `isSanctioned ? 25 : 0` via `vessel_sanctions` LEFT JOIN. Correct.
- loitering: binary `loiterCount > 0 ? 10 : 0` with 90-day window (`INTERVAL '90 days'`). Correct.
- STS: binary `stsCount > 0 ? 10 : 0`. Correct.
- Total max: 40 + 15 + 25 + 10 + 10 = 100. Correct.

**RISK-02 nuance:** The plan states "recomputed automatically when new anomaly events are detected." The implementation runs `computeRiskScores()` in the same `*/30` cron block after all detectors run — this is the correct pattern (scores refresh immediately after new anomalies are written). Fully satisfies the requirement.

---

_Verified: 2026-03-18T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
