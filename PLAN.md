# Plan: Tanker Tracker — Council Feature Build (12 features, e2e)
Planned: 2026-07-24 · Executor protocol: v1 (embedded below, binding)

## Objective
Ship the twelve council-selected features end-to-end — from the risk-scoring correctness fix through the dormant-pipeline activations, detection-precision layers, persistent-intelligence stores, analyst exports, aggregate signals, and synthesis/prediction — each behind a machine-verifiable checkpoint, committed in phase-sized chunks.

## Success criteria (re-verified by the FINAL checkpoint)
1. `npx vitest run` exits 0 with **more** test files than the pre-build baseline (every feature adds at least one test).
2. `npx tsc --noEmit` exits 0 (no type regressions across all new code).
3. `npx eslint src/` exits 0.
4. `npm run build` exits 0 (production Next.js build succeeds).
5. `src/lib/db/schema.sql` applies to a fresh Postgres idempotently (second apply = no error), including the new `vessel_rendezvous` table, the `distance_km`/centroid columns on `vessel_proximity_events`, the fleet-level (nullable-IMO) alert support, and the persisted `nav_status` path.
6. Every one of the 12 features is present, provable by the per-feature grep/marker checks in its phase, and none regresses another (full suite green).

## Non-goals
- No authentication/login gate (the dashboard stays open per CLAUDE.md).
- No new external paid data sources; everything exploits data already ingested (AIS, FRED, OpenSanctions, RSS).
- No ML libraries — STS prediction is pure kinematics.
- No live-AIS behavior change to the ingester's connection/subscription (only detection logic + new archival).
- No redesign of the Bloomberg aesthetic; UI additions match existing components.
- Council-cut scope stays cut: no sub-0.5nm proximity expansion, no majority-low_confidence anomaly discounting, no standalone fleet rendezvous page, no print-CSS dossier, no @vercel/og card, no Guardafui chokepoint (Gulf of Aden only), no divergence "trading call" language, no LLM narrative pass.

## Context & constraints
Environment: macOS (darwin), Node/Next.js 16 + Turbopack, React 19, TS 5, Tailwind v4 · Stack: MapLibre GL + CARTO, PostgreSQL/TimescaleDB (`tanker-ts` container on :5432, creds postgres/password/tanker_tracker), Zustand, Recharts, vitest (happy-dom, mocked pg pool) · Deadline: none · Access: full repo; `.env.local` is permission-denied and MUST NOT be read/committed; only `.env.example` is tracked.

## Assumptions
- A1: Unit tests mock the pg pool (`vi.mock('pg')`) — no test needs a live DB. → **fact** (verified in alerts.test.ts, status/route.test.ts, refresh-jobs.test.ts).
- A2: All chokepoint consumers iterate `Object.values(CHOKEPOINTS)` / `Object.keys(CHOKEPOINTS)` generically; only `stores/analytics.ts:40` hard-lists defaults. → **fact** (verified).
- A3: The `tanker-ts` container is reachable for the schema-idempotency check with the README creds. → validated at CP-1 (schema check runs there first).
- A4: `nav_status` + `low_confidence` columns already exist on `vessel_positions`; `nav_status` is parsed by the ingester and selected by `positions.ts` but hardcoded `null` in three GeoJSON builders. → **fact** (verified schema.sql:44-45, parser.ts:31, positions.ts:48-50).
- A5: The `alerts` table + `getAlertsWithVessels(userId)` + `/api/alerts` + store `setAlerts/markAlertRead/unreadCount` all exist and are unused by `NotificationBell.tsx` (which fetches `/api/anomalies`). → **fact** (verified).
- A6: `npm run build` is the slowest check (~minutes); it runs only on schema/heavy phases and CP-FINAL, not every phase. → accepted design choice.

## Phase map
```
P0 ──► P1 ──►┬─► P4 ──►┐
             ├─► P5     ├─► P7 ──► CP-FINAL
             ├─► P6 ────┘
P0 ──► P2 (∥ P1)   P2 feeds P6 (Gulf of Aden → SPC)
P0 ──► P3 (∥ P1)
```
- P0 blocks all. P1 (risk keystone) blocks P4, P5, P6, P7 (they read/extend the risk score).
- P2, P3 depend only on P0 and run parallel to P1.
- P4 (ledger) blocks P7 (STS prediction needs ledger ground truth).
- P6 (SPC + fleet-alert schema + destination-flip) benefits from P2's Gulf of Aden and blocks P7's situation brief.

## Execution notes (binding for this build)
- **Autonomous:** the user pre-authorized execution ("do not ask me for approval once plan has been generated; build e2e"). All checkpoints are `human_gate: false`. Do not pause for approval.
- **Decisions → councils, not the user:** if a genuine design fork surfaces mid-build (ambiguous threshold, schema-shape choice, conflicting approaches), resolve it by running a short multi-agent council via the Workflow tool (independent proposals → adversarial critique → synthesis) and proceed with the winner. Record the decision in the phase commit message. Never block on the user.
- **Subagent-driven:** implement each phase by dispatching focused subagents (one per slice where phases have sub-slices). The checkpoint runner is the arbiter of done.
- **Commit per phase:** after a checkpoint PASSES, commit with `feat(P<n>): <summary>` (or `fix(P1):` for the keystone). Reasonable chunk = one passing phase. Do not push unless asked.

---

## Phase 0 — Green baseline + verification harness
**Goal:** A recorded, reproducible green starting state and the checkpoint machinery installed, so every later phase is measured against a known-good baseline.
**Depends on:** —
**Tasks:**
1. Install `scripts/checkpoint_runner.py` (from the skill bundle) and merge the Stop hook into `.claude/settings.json` (create if absent, never clobber existing keys).
2. Record the current test-file count to `.checkpoints/baseline_testfiles.txt` via the count command below.
3. Confirm the full suite, typecheck, and lint are green on untouched `master`.
**Deliverables:** `scripts/checkpoint_runner.py`, `.claude/settings.json` (Stop hook), `.checkpoints/baseline_testfiles.txt`

```yaml
checkpoint:
  id: CP-0
  phase: "Green baseline"
  halt: true
  max_attempts: 3
  human_gate: false
  checks:
    - name: suite-green
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot"
      expect: "exit 0"
    - name: typecheck-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx tsc --noEmit"
      expect: "exit 0"
    - name: lint-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx eslint src/"
      expect: "exit 0"
    - name: baseline-recorded
      run: "cd /Users/randyren/Developer/tanker-tracker && mkdir -p .checkpoints && find src -name '*.test.ts' -o -name '*.test.tsx' | wc -l | tr -d ' ' | tee .checkpoints/baseline_testfiles.txt"
      expect: "exit 0"
    - name: schema-applies-idempotent
      run: "cd /Users/randyren/Developer/tanker-tracker && docker exec -i tanker-ts psql -U postgres -d tanker_tracker -v ON_ERROR_STOP=1 < src/lib/db/schema.sql && docker exec -i tanker-ts psql -U postgres -d tanker_tracker -v ON_ERROR_STOP=1 < src/lib/db/schema.sql"
      expect: "exit 0"
```

---

## Phase 1 — Identity-First Risk Baseline (keystone fix)
**Goal:** Sanctioned / high-risk hulls receive a non-zero risk score the instant they appear, even with zero anomalies — correcting the flagship leaderboard, `/risk` API, and exports for exactly the vessels the app exists to catch.
**Depends on:** CP-0
**Tasks:**
1. Rewrite `computeRiskScores` in `src/lib/detection/risk-score.ts` to seed the driving set from `(SELECT DISTINCT imo FROM vessel_anomalies) UNION (SELECT imo FROM vessel_sanctions WHERE risk_category IN ('sanction','mare.shadow;poi'))`, then LEFT JOIN anomalies + sanctions + `vessels.flag` onto it. Keep the existing factor weights; a zero-anomaly sanctioned vessel must yield `sanctions:25` (+ `flagRisk:15` if applicable).
2. Add `src/lib/detection/risk-score.test.ts`: mock `pool.query` to return a sanctioned, zero-anomaly row and assert `upsertRiskScore` is called with `factors.sanctions === 25` and `score >= 25`; assert an anomalous non-sanctioned vessel still scores its anomaly factors.
3. (Council-cut: skip `countries` persistence — flag state already covered by `HIGH_RISK_FLAGS`.)
**Deliverables:** modified `src/lib/detection/risk-score.ts`, new `src/lib/detection/risk-score.test.ts`

```yaml
checkpoint:
  id: CP-1
  phase: "Risk keystone"
  halt: true
  max_attempts: 4
  human_gate: false
  checks:
    - name: risk-test-passes
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot src/lib/detection/risk-score.test.ts"
      expect: "exit 0"
    - name: seeds-from-sanctions
      run: "cd /Users/randyren/Developer/tanker-tracker && grep -Eiq 'union' src/lib/detection/risk-score.ts && grep -q 'vessel_sanctions' src/lib/detection/risk-score.ts"
      expect: "exit 0"
    - name: suite-green
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot"
      expect: "exit 0"
    - name: typecheck-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx tsc --noEmit"
      expect: "exit 0"
    - name: lint-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx eslint src/"
      expect: "exit 0"
```

---

## Phase 2 — Activate dormant pipelines (Alert Inbox + analytics controls + Gulf of Aden)
**Goal:** Three self-contained wins that surface capability already built: the per-user alert feed reaches the bell, the two dead analytics controls work, and Gulf of Aden becomes a first-class chokepoint.
**Depends on:** CP-0 (parallel to P1)
**Tasks (three slices):**
1. **Alert Inbox:** repoint `src/components/ui/NotificationBell.tsx` to fetch `/api/alerts` with the `X-User-Id` header (userId via `useLocalStorage('tanker_tracker_user_id')`, same pattern as `WatchlistPanel.tsx`); drive `alerts`/`unreadCount` from the Zustand store (`setAlerts`); render vessel name + unread dot; mark-read on click via `POST /api/alerts/[id]/read`; jump-to-map via `setTargetVesselImo`. Add `NotificationBell.test.tsx` (happy-dom) asserting it requests `/api/alerts` with the header and renders returned alerts.
2. **Analytics controls:** in `src/app/(protected)/analytics/page.tsx` replace the hardcoded `priceSymbol=WTI` with the store's `priceSymbol`, and branch traffic fetching on the store's `viewMode` (`route` → `groupBy=route`). Wire the existing toggle UI. (Council-cut: no divergence "call".)
3. **Gulf of Aden:** add a `gulf_of_aden` entry to `src/lib/geo/chokepoints-constants.ts` (bounds lat 11–14, lon 43–48, solidly inside AIS coverage) and add it to `stores/analytics.ts` default `selectedChokepoints`. Add `chokepoints-constants.test.ts` asserting the key exists with numeric bounds and that `Object.values` length increased.
**Deliverables:** modified `NotificationBell.tsx`, `analytics/page.tsx`, `chokepoints-constants.ts`, `stores/analytics.ts`; new `NotificationBell.test.tsx`, `chokepoints-constants.test.ts`

```yaml
checkpoint:
  id: CP-2
  phase: "Dormant activation"
  halt: true
  max_attempts: 4
  human_gate: false
  checks:
    - name: new-tests-pass
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot src/components/ui/NotificationBell.test.tsx src/lib/geo/chokepoints-constants.test.ts"
      expect: "exit 0"
    - name: bell-hits-alerts-api
      run: "cd /Users/randyren/Developer/tanker-tracker && grep -q '/api/alerts' src/components/ui/NotificationBell.tsx && grep -qi 'x-user-id' src/components/ui/NotificationBell.tsx"
      expect: "exit 0"
    - name: price-toggle-unhardcoded
      run: "cd /Users/randyren/Developer/tanker-tracker && ! grep -q 'priceSymbol=WTI' 'src/app/(protected)/analytics/page.tsx'"
      expect: "exit 0"
    - name: aden-chokepoint-added
      run: "cd /Users/randyren/Developer/tanker-tracker && grep -q 'gulf_of_aden' src/lib/geo/chokepoints-constants.ts"
      expect: "exit 0"
    - name: suite-green
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot"
      expect: "exit 0"
    - name: typecheck-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx tsc --noEmit"
      expect: "exit 0"
    - name: lint-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx eslint src/"
      expect: "exit 0"
```

---

## Phase 3 — Detection precision (nav_status layer + position integrity + teleport detector)
**Goal:** Cut false positives using the unused `nav_status`, mark GPS-degraded contacts visually, and add a high-confidence kinematic `spoofed_position` detector.
**Depends on:** CP-0 (parallel to P1)
**Tasks:**
1. Thread `navStatus` through the three GeoJSON builders (`VesselMap.tsx:217`, `ClusterPanel.tsx:117`, `ChokepointWidget.tsx:75`) and `geojson.ts` instead of hardcoding `null`; add a 16-entry decode map.
2. Suppress loitering/speed anomalies when `nav_status` ∈ {1 at-anchor, 5 moored} **and** the status is fresh (position within 15 min); edit `loitering.ts` + the speed detector to SELECT `nav_status`. Add a "declared-moored-but-moving" contradiction badge in `VesselPanel.tsx` (weak tell, display-only).
3. Add `spoofed_position` to the `AnomalyType` union + `ANOMALY_TYPE_LABELS` + badge; add a teleport detector (implied speed > 50kt between consecutive positions via existing haversine) writing that anomaly type. (Council-cut: no majority-low_confidence discounting.)
4. Render low-confidence dots distinctly (data-driven `circle-stroke-width`/opacity keyed on `lowConfidence`, replacing the hardcoded `1` at `VesselMap.tsx:310`).
5. Tests: `nav-status-suppression.test.ts` (at-anchor fresh → no loitering anomaly; stale status → not suppressed) and `teleport.test.ts` (>50kt jump → spoofed_position; normal speed → none).
**Deliverables:** modified geojson/map/panel/detector files, `src/types/anomaly.ts`; new `nav-status-suppression.test.ts`, `teleport.test.ts`

```yaml
checkpoint:
  id: CP-3
  phase: "Detection precision"
  halt: true
  max_attempts: 4
  human_gate: false
  checks:
    - name: precision-tests-pass
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot src/lib/detection/nav-status-suppression.test.ts src/lib/detection/teleport.test.ts"
      expect: "exit 0"
    - name: spoofed-type-registered
      run: "cd /Users/randyren/Developer/tanker-tracker && grep -q 'spoofed_position' src/types/anomaly.ts"
      expect: "exit 0"
    - name: navstatus-not-hardcoded-null
      run: "cd /Users/randyren/Developer/tanker-tracker && test $(grep -rc 'navStatus: null' src/components src/lib/map | awk -F: '{s+=$2} END {print s}') -eq 0"
      expect: "exit 0"
    - name: suite-green
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot"
      expect: "exit 0"
    - name: typecheck-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx tsc --noEmit"
      expect: "exit 0"
    - name: lint-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx eslint src/"
      expect: "exit 0"
```

---

## Phase 4 — Rendezvous Ledger (persist proximity + known-associates + repeat-partner risk)
**Goal:** Stop discarding co-location events; archive each sustained rendezvous with distance + sanctions-at-encounter, surface per-vessel "Known Associates", and add a repeat-partner risk factor.
**Depends on:** CP-1 (repeat-partner factor extends the risk score)
**Tasks:**
1. Schema: add `vessel_rendezvous` (imo_a, imo_b, first_seen_at, last_seen_at, min_distance_km, centroid_lat, centroid_lon, a_sanctioned, b_sanctioned) and add `distance_km` to `vessel_proximity_events`; all `IF NOT EXISTS`.
2. In `sts-transfer.ts`, capture `distanceKm` at detection and archive completed events into `vessel_rendezvous` (joining `vessel_sanctions` at archive time) **before** the cleanup delete.
3. Add `GET /api/vessels/[imo]/associates` and a "Known Associates" block in `FleetVesselDetail` (reusing the existing detail component); render the previously-dropped `StsTransferDetails` fields (`otherName`, `distanceKm`).
4. Add a repeat-rendezvous risk factor (binary, e.g. +5 for ≥2 encounters in 90 days) to `RiskFactors` + `computeRiskScores` (safe now that P1 seeds sanctioned vessels).
5. Tests: `rendezvous-archive.test.ts` (archive INSERT fires before delete, sanctions stamped) and a risk-factor test for the new factor. (Council-cut: no sub-threshold expansion, no standalone ledger page.)
**Deliverables:** modified `schema.sql`, `sts-transfer.ts`, `risk-score.ts`, `risk-scores.ts`, `FleetVesselDetail`; new API route + `rendezvous-archive.test.ts`

```yaml
checkpoint:
  id: CP-4
  phase: "Rendezvous ledger"
  halt: true
  max_attempts: 4
  human_gate: false
  checks:
    - name: ledger-tests-pass
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot src/lib/detection/rendezvous-archive.test.ts"
      expect: "exit 0"
    - name: archives-not-just-deletes
      run: "cd /Users/randyren/Developer/tanker-tracker && grep -q 'vessel_rendezvous' src/lib/detection/sts-transfer.ts"
      expect: "exit 0"
    - name: schema-has-rendezvous
      run: "cd /Users/randyren/Developer/tanker-tracker && grep -q 'vessel_rendezvous' src/lib/db/schema.sql"
      expect: "exit 0"
    - name: schema-applies-idempotent
      run: "cd /Users/randyren/Developer/tanker-tracker && docker exec -i tanker-ts psql -U postgres -d tanker_tracker -v ON_ERROR_STOP=1 < src/lib/db/schema.sql && docker exec -i tanker-ts psql -U postgres -d tanker_tracker -v ON_ERROR_STOP=1 < src/lib/db/schema.sql"
      expect: "exit 0"
    - name: suite-green
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot"
      expect: "exit 0"
    - name: typecheck-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx tsc --noEmit"
      expect: "exit 0"
    - name: lint-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx eslint src/"
      expect: "exit 0"
```

---

## Phase 5 — Dark-Fleet Dossier Export + anomaly-detail rendering
**Goal:** One-click structured per-vessel brief, and the anomaly detail numbers (deviation°, gap minutes, STS distance/partner) rendered wherever anomalies show — reading the now-correct risk factors.
**Depends on:** CP-1 (correct factors); coordinates with P4's detail render (P5 owns the full render fix).
**Tasks:**
1. Render anomaly `details` fields by type in `VesselPanel.tsx` and `FleetVesselDetail` (`deviationDegrees`, `gapMinutes`/`goingDarkCount`, `distanceKm`, `otherName`) instead of generic strings.
2. Add `GET /api/export/vessel/[imo]` aggregating the existing `/risk`, `/history`, `/positions` endpoints into one JSON download; add an export button to `VesselPanel`.
3. Test `export-vessel.test.ts`: mock the three sources, assert the route returns a JSON object containing identity, factor breakdown, and anomaly detail numbers. (Council-cut: no print-CSS, no permalink.)
**Deliverables:** modified `VesselPanel.tsx`, `FleetVesselDetail`; new `src/app/api/export/vessel/[imo]/route.ts`, `export-vessel.test.ts`

```yaml
checkpoint:
  id: CP-5
  phase: "Dossier export"
  halt: true
  max_attempts: 4
  human_gate: false
  checks:
    - name: export-test-passes
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot src/app/api/export/vessel/**/*.test.ts"
      expect: "exit 0"
    - name: export-route-exists
      run: "cd /Users/randyren/Developer/tanker-tracker && test -f 'src/app/api/export/vessel/[imo]/route.ts'"
      expect: "exit 0"
    - name: detail-fields-rendered
      run: "cd /Users/randyren/Developer/tanker-tracker && grep -Rqi 'deviationDegrees\\|distanceKm\\|otherName' src/components/panels"
      expect: "exit 0"
    - name: suite-green
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot"
      expect: "exit 0"
    - name: typecheck-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx tsc --noEmit"
      expect: "exit 0"
    - name: lint-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx eslint src/"
      expect: "exit 0"
```

---

## Phase 6 — Aggregate signals (SPC index + fleet-level alerts + destination-flip detector)
**Goal:** The app's first non-vessel-specific disruption signal — a z-scored chokepoint-throughput band that can alert — plus intent-vs-action correlation on destination flips.
**Depends on:** CP-1; benefits from CP-2 (Gulf of Aden). Blocks P7.
**Tasks:**
1. **Fleet-level alerts:** make `alerts.imo` nullable (or add a `system` alert path) so an IMO-less chokepoint alert has a home; `IF NOT EXISTS` migration + type update. Test the insert path.
2. **SPC index:** compute rolling mean/stddev **at query time** over daily chokepoint counts (window function), emit a z-score with a **cold-start guard** (≥14 days data or no band); render a control band on the analytics chart; fire a fleet-level alert when throughput is below the lower band ≥2 consecutive days. (Council-cut: no continuous aggregate, no COG laden/ballast split now.)
3. **Destination-flip sequence:** detector joining `vessel_destination_changes` → subsequent `going_dark`/`deviation`/`sts_transfer` within N hours (SQL window), writing a `composite_diversion` anomaly with a frequency/confidence threshold; add a junk-destination regex flag. (Council-cut: defer toward/away chokepoint aggregation; no sanctioned-port list.)
4. Tests: `spc-index.test.ts` (z-score math + cold-start returns null band), `destination-flip.test.ts` (flip-then-dark within window → composite_diversion; routine reroute → none).
**Deliverables:** modified `schema.sql`, `db/analytics.ts`, analytics chart, `db/alerts.ts`; new detector module + `spc-index.test.ts`, `destination-flip.test.ts`

```yaml
checkpoint:
  id: CP-6
  phase: "Aggregate signals"
  halt: true
  max_attempts: 4
  human_gate: false
  checks:
    - name: aggregate-tests-pass
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot src/lib/detection/spc-index.test.ts src/lib/detection/destination-flip.test.ts"
      expect: "exit 0"
    - name: composite-type-registered
      run: "cd /Users/randyren/Developer/tanker-tracker && grep -q 'composite_diversion' src/types/anomaly.ts"
      expect: "exit 0"
    - name: schema-applies-idempotent
      run: "cd /Users/randyren/Developer/tanker-tracker && docker exec -i tanker-ts psql -U postgres -d tanker_tracker -v ON_ERROR_STOP=1 < src/lib/db/schema.sql && docker exec -i tanker-ts psql -U postgres -d tanker_tracker -v ON_ERROR_STOP=1 < src/lib/db/schema.sql"
      expect: "exit 0"
    - name: suite-green
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot"
      expect: "exit 0"
    - name: typecheck-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx tsc --noEmit"
      expect: "exit 0"
    - name: lint-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx eslint src/"
      expect: "exit 0"
```

---

## Phase 7 — Synthesis & prediction (Situation Brief + STS CPA nowcast)
**Goal:** The analyst hand-off artifact (timestamped chokepoint SITREP composing the now-correct signals) and a predictive STS rendezvous nowcast gated on the ledger's ground truth.
**Depends on:** CP-4 (ledger), CP-6 (SPC + counts). Reads CP-1 risk.
**Tasks:**
1. **Situation Brief:** `GET /api/brief/[chokepoint]` composing vessel/tanker counts, anomaly breakdown, top-risk vessels present (correct scores), prices, GPS-jamming ratio, and news **ranked by the dormant `relevance_score`** (swap `getLatestNews` ORDER BY); extend export to emit markdown/text. (Council-cut: no @vercel/og, no LLM pass.)
2. **STS CPA prediction:** dead-reckon consecutive positions to project closest-point-of-approach; gate on deceleration into the transfer speed band + a sanctioned/high-risk party; write `sts_predicted` only behind a guard requiring the ledger to exist (do not enable the alert until ≥30 days history — ship the detector + backtest harness against `vessel_rendezvous`, alert disabled by a flag).
3. Tests: `situation-brief.test.ts` (composes sections, news ordered by relevance_score) and `cpa-predict.test.ts` (converging tracks + deceleration + sanctioned party → prediction; diverging → none).
**Deliverables:** new `src/app/api/brief/[chokepoint]/route.ts`, CPA detector module, `situation-brief.test.ts`, `cpa-predict.test.ts`; modified `db/news.ts` (relevance ordering)

```yaml
checkpoint:
  id: CP-7
  phase: "Synthesis & prediction"
  halt: true
  max_attempts: 4
  human_gate: false
  checks:
    - name: synthesis-tests-pass
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot src/app/api/brief/**/*.test.ts src/lib/detection/cpa-predict.test.ts"
      expect: "exit 0"
    - name: brief-route-exists
      run: "cd /Users/randyren/Developer/tanker-tracker && test -f 'src/app/api/brief/[chokepoint]/route.ts'"
      expect: "exit 0"
    - name: news-ranked-by-relevance
      run: "cd /Users/randyren/Developer/tanker-tracker && grep -qi 'relevance_score' src/lib/db/news.ts"
      expect: "exit 0"
    - name: suite-green
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot"
      expect: "exit 0"
    - name: typecheck-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx tsc --noEmit"
      expect: "exit 0"
    - name: lint-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx eslint src/"
      expect: "exit 0"
```

---

## Final checkpoint
```yaml
checkpoint:
  id: CP-FINAL
  phase: "End-to-end acceptance"
  halt: true
  max_attempts: 3
  human_gate: false
  checks:
    - name: full-suite-green
      run: "cd /Users/randyren/Developer/tanker-tracker && npx vitest run --reporter=dot"
      expect: "exit 0"
    - name: more-tests-than-baseline
      run: "cd /Users/randyren/Developer/tanker-tracker && test $(find src -name '*.test.ts' -o -name '*.test.tsx' | wc -l | tr -d ' ') -gt $(cat .checkpoints/baseline_testfiles.txt)"
      expect: "exit 0"
    - name: typecheck-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx tsc --noEmit"
      expect: "exit 0"
    - name: lint-clean
      run: "cd /Users/randyren/Developer/tanker-tracker && npx eslint src/"
      expect: "exit 0"
    - name: production-build
      run: "cd /Users/randyren/Developer/tanker-tracker && npm run build"
      expect: "exit 0"
    - name: schema-applies-idempotent
      run: "cd /Users/randyren/Developer/tanker-tracker && docker exec -i tanker-ts psql -U postgres -d tanker_tracker -v ON_ERROR_STOP=1 < src/lib/db/schema.sql && docker exec -i tanker-ts psql -U postgres -d tanker_tracker -v ON_ERROR_STOP=1 < src/lib/db/schema.sql"
      expect: "exit 0"
    - name: all-twelve-features-present
      run: "cd /Users/randyren/Developer/tanker-tracker && grep -Eiq 'union' src/lib/detection/risk-score.ts && grep -q '/api/alerts' src/components/ui/NotificationBell.tsx && grep -q 'gulf_of_aden' src/lib/geo/chokepoints-constants.ts && grep -q 'spoofed_position' src/types/anomaly.ts && grep -q 'composite_diversion' src/types/anomaly.ts && grep -q 'vessel_rendezvous' src/lib/db/schema.sql && test -f 'src/app/api/export/vessel/[imo]/route.ts' && test -f 'src/app/api/brief/[chokepoint]/route.ts' && grep -qi 'relevance_score' src/lib/db/news.ts"
      expect: "exit 0"
```

---

## Executor Protocol v1 (binding)

1. Execute phases in dependency order. Never start a phase whose dependencies' checkpoints have not PASSED.
2. At every `checkpoint` with `halt: true`: STOP. Run every check exactly as written — when `scripts/checkpoint_runner.py` is present, use `python scripts/checkpoint_runner.py run <CP-ID>`, which executes the checks and prints the report. Capture the real output.
3. Emit a Checkpoint Report (format below) with per-check PASS/FAIL and pasted evidence. A claim of "done" without pasted output is not done.
4. All checks pass → mark the phase complete and proceed. Any check fails → diagnose, fix the *work*, then re-run ALL checks in the checkpoint, not just the failed one.
5. After `max_attempts` failed attempts: halt the entire run. Emit a Failure Report (format below) and escalate. Do not continue to later phases.
6. Never edit, weaken, skip, or reinterpret a check to make it pass. If you believe a check itself is wrong, halt and say so explicitly in a Failure Report — changing the verifier is a human decision, not an executor decision.
7. `human_gate: true` → even on all-pass, stop and wait for explicit human approval before proceeding.
8. The project is complete only when CP-FINAL passes. CP-FINAL re-verifies the Success criteria from a clean state.

### Checkpoint Report format
```
## Checkpoint Report — CP-<n> (<phase>) — attempt <k>/<max>
- <check-name>: PASS|FAIL
  $ <command>
  <first/last relevant lines of real output>
Verdict: PASS → proceeding to <next phase> | FAIL → <next action>
```

### Failure Report format
```
## Failure Report — CP-<n> after <max> attempts
Failing checks + evidence: <...>
What was tried: <...>
Current hypothesis: <...>
Needed to unblock: <decision | access | fix to check | scope change>
```
