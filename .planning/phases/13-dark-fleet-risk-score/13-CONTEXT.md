# Phase 13: Dark Fleet Risk Score - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement a per-vessel dark fleet risk score (0–100) with factor breakdown, stored in a new `vessel_risk_scores` table. A 30-minute cron job recomputes scores for vessels with recent anomaly activity. Expose scores via a new `GET /api/vessels/[imo]/risk` endpoint. No new UI — Phase 14 consumes the API to display in the panel.

Covers RISK-01 and RISK-02 only. Panel display deferred to Phase 14.

</domain>

<decisions>
## Implementation Decisions

### Scoring Model & Weights
- Weight distribution: going-dark frequency 40pts, sanctions status 25pts, flag state risk 15pts, STS events 10pts, loitering history 10pts
- Going-dark factor: 8pts per event, capped at 5 events = full 40pts
- Flag state risk: hardcoded high-risk flag list (Iran, Russia, Venezuela, North Korea, Panama, Cameroon, Comoros) — 15pts for high-risk flag, 0 otherwise
- No score decay — anomaly history remains relevant regardless of age; keep model simple

### Score Storage & Update Trigger
- New `vessel_risk_scores` table: `(imo TEXT PRIMARY KEY, score INT NOT NULL DEFAULT 0, factors JSONB NOT NULL, computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`
- RISK-02 implementation: 30-minute cron job recomputes scores for all vessels with anomaly activity (joins `vessel_anomalies`)
- Only vessels with ≥1 anomaly event are stored in `vessel_risk_scores` — zero-score vessels excluded until first event
- Factor breakdown JSONB format: `{ goingDark: N, flagRisk: N, sanctions: N, loitering: N, sts: N }` — integers, sum ≤ 100

### API Exposure
- New endpoint: `GET /api/vessels/[imo]/risk` — returns `{ score: number, factors: { goingDark, flagRisk, sanctions, loitering, sts }, computedAt: string }`
- For vessels with no anomaly history: return `{ score: 0, factors: { goingDark: 0, flagRisk: 0, sanctions: 0, loitering: 0, sts: 0 }, computedAt: null }` (per RISK-01 success criteria)
- `/api/vessels` list endpoint unchanged — risk score fetched separately per-vessel by Phase 14 panel

### Claude's Discretion
- Exact SQL query for aggregating anomaly counts per type per vessel
- Whether to run sanctions check via existing `src/lib/sanctions.ts` or query `vessel_anomalies` for active sanctions anomalies
- Cron registration approach (follow existing `detection-jobs.ts` pattern)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/detection/repeat-going-dark.ts` — reference for querying going_dark event counts from `vessel_anomalies`
- `src/lib/db/anomalies.ts` — `upsertAnomaly()`, `resolveAnomaly()` patterns
- `src/lib/db/schema.sql` — add `vessel_risk_scores` DDL here
- `src/services/ais-ingester/detection-jobs.ts` — register risk score cron here (`*/30 * * * *`)
- `src/lib/sanctions.ts` — existing sanctions matching logic for flag/sanctions lookups

### Established Patterns
- All detectors: `async function returning Promise<number>` (count processed)
- Cron registration: `cron.schedule('*/30 * * * *', async () => { ... })` in `detection-jobs.ts`
- API routes: `src/app/api/vessels/[imo]/` pattern already used for vessel detail
- JSONB details stored as typed interfaces

### Integration Points
- `src/lib/db/schema.sql` — add `vessel_risk_scores` table DDL
- `src/services/ais-ingester/detection-jobs.ts` — register `computeRiskScores()` in `*/30` cron
- `src/app/api/vessels/[imo]/risk/route.ts` — new Next.js API route
- `src/lib/db/` — new `risk-scores.ts` for DB operations

</code_context>

<specifics>
## Specific Ideas

- Factor breakdown stored as integers matching the weight caps (goingDark max 40, flagRisk max 15, sanctions max 25, loitering max 10, sts max 10)
- For sanctions factor: check if vessel has an active anomaly of any sanctions-related type OR is matched in sanctions DB — use `vessel_anomalies` for simplicity (active anomaly = sanctioned)
- For loitering factor: count active OR resolved loitering anomalies in last 90 days — 10pts if any, 0 otherwise (binary, not scaled)
- For STS factor: count sts_transfer anomalies — 10pts if any, 0 otherwise (binary)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
