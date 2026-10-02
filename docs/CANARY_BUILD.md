# Plan: Straits Canary Intelligence Workbench
Planned: 2026-10-01 · Executor protocol: v1

## Objective
Build and deploy five evidence-based maritime investigation workflows to canary.straits.randyren.org without promoting experimental code to production.

## Success criteria
1. Canary serves the canary branch over HTTPS, identifies itself, discourages indexing, and leaves the master deployment unchanged.
2. Canary can read observed vessel data but its database role cannot modify public production tables; test writes use an isolated schema.
3. At least one additional free primary data source is integrated with source timestamps, provenance, failure states, and documented limitations.
4. Claim checks and passage comparisons expose the underlying observations, time window, and uncertainty; unsupported questions and insufficient coverage are not manufactured into verdicts.
5. Parallel Seas runs an explicit, editable route-delay scenario and distinguishes assumptions from observations.
6. Coverage diagnostics compare vessel gaps with regional collection evidence without equating signal loss with deliberate evasion.
7. Users can follow a question, revisit changes, open a stable shared investigation, and navigate its evidence/story view.
8. Relevant tests, lint, types, build, API probes, and actual computer-use journeys pass on the canary deployment.

## Non-goals
- Promoting canary to master or changing the production harvester.
- Purchasing data or promising global, continuous AIS coverage.
- Unvalidated cargo manifests, causal claims, or calibrated forecasts.

## Context & constraints
Next.js 16 / React 19 / MapLibre / Postgres. Existing live observations remain authoritative source records. Coding is delegated to Luna high; root reviews changes and commits sequentially. User-owned artifacts are preserved. User has authorized implementation, commits, canary push/deployment, and computer-use testing.

## Assumptions
- A1: Existing Vercel project and domain can host a branch domain; credentials verified at initial inspection.
- A2: A restricted role and dedicated schema provide write isolation while sharing database compute. Query bounds and caching limit canary load.
- A3: Public investigation workflows can begin with deterministic questions and explicit scenario assumptions; free-form claims are interpreted conservatively.

## Phase map
P1 + P2 → P3 → P4 → P5 → P6 → P7. Source research and isolated adapter implementation can run alongside P1; their runtime integration waits for P1. Root reviews and commits each chunk sequentially.

## Phase 1 — Canary foundation
Deliverables: branch routing, environment gates, noindex, isolated write tables, restricted database role and verification scripts, CI branch coverage, working investigations shell.
Checkpoint: targeted foundation tests; `npm run typecheck`; `npm run build`; `node --env-file=.env.canary.local scripts/verify-canary-db.mjs`; live canary health/UI after push.

## Phase 2 — Additional sourced observations
Deliverables: primary-source research matrix, bounded source adapter(s), timestamp/unit validation, source availability UI and provenance.
Checkpoint: adapter fixture tests including unavailable/malformed/stale responses; actual upstream probe; API response shows real source timestamp and source URL.

## Phase 3 — Claim checks and passage cohorts
Deliverables: explicit question catalog, windowed evidence API, regional passages with conservative quality rules, group comparisons, map evidence links.
Checkpoint: crossing fixtures for complete/incomplete/gap/turnback cases; API input validation and insufficiency tests; browser question → result → evidence navigation.

## Phase 4 — Parallel Seas
Deliverables: editable route-delay scenarios with baseline/scenario comparison, transparent calculations, shareable configuration, distinct assumed and observed values.
Checkpoint: deterministic distance/time scenario tests; invalid input tests; browser controls change both map and numerical comparison.

## Phase 5 — Coverage diagnostics
Deliverables: vessel and peer observation gaps, regional collection context, bounded interpretations, drilldowns.
Checkpoint: fixtures distinguish isolated gaps, regional silence and inadequate history; browser region/vessel drilldown works without labeling gaps as proven wrongdoing.

## Phase 6 — Followable investigations and stories
Deliverables: persisted evidence snapshots, stable share URLs, follow/unfollow, material-change comparison, annotated story steps and embeds.
Checkpoint: snapshot immutability and persistence tests; follow/revisit roundtrip; stable shared URL; browser story controls and evidence links.

## Phase 7 — End-to-end canary acceptance
Deliverables: deployment receipts, sequential commit history, source limitations and operator documentation, computer-use verification record.
Checkpoint: `npm run ci`; deployed health/API checks; restricted-role verification; computer-use journeys across all five workflows at desktop and compact layouts; production URL remains on original production deployment.

## Executor Protocol v1 (binding)
1. Execute phases in dependency order. Never start a phase whose dependencies' checkpoints have not PASSED.
2. At every checkpoint: run every check and capture the real output. Codex checks run directly; no Claude stop hooks are installed.
3. Report per-check PASS/FAIL and evidence. A claim of done without output is not done.
4. Fix failures before proceeding. Re-run checks affected by the final edits.
5. Escalate external access blockers precisely while continuing independent authorized work.
6. Do not weaken a verifier to conceal a failure.
7. Execution and canary publishing are already authorized; promotion to production is outside this task.
8. Completion requires the final checkpoint. Partial deployment is reported as partial.

## Execution record
- Initial inspection: only pre-existing untracked `artifacts/`; production branch is `master`; created `canary` branch. Vercel and DNS access verified. Production database 156 MB at inspection; no production data changes made.
