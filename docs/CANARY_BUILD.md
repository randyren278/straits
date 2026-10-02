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
P1 + P2 → P3; P1 → P4 + P5; P3 → P6; all → P7. Independent source, route-math, and diagnostic modules may be implemented concurrently; their runtime integration waits for the relevant dependencies. Root reviews and commits each chunk sequentially.

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
- P1: `8d2c768` deployed successfully. Full initial check: 861 tests passed, 9 todo; build passed. Restricted role provisioning and repeat provisioning succeeded; runtime probes proved observation reads, denial of production watchlist reads/public writes, and rollback-only canary writes. Canary-specific Vercel Preview environment and branch domain configured. Only the canary hostname has a deployment-protection exception; other previews retain their existing protection.
- P2: `c188bf1` added validated PortWatch and marine adapters. Its deployment correctly failed because a newly shared context helper was omitted from staging; `a6e7e80` included the helper. Four focused test files / 24 tests passed. Actual canary API returned 30 PortWatch rows (latest 2026-09-27) and a modeled marine forecast valid 2026-10-02T06:00Z.
- Dependency repair: `87977dc` patched Next.js/eslint-config-next to 16.3.6 and affected brace-expansion versions. Production dependency audit reports zero vulnerabilities. This revision deployed successfully; CodeQL passed.
- Initial computer-use check: Chrome Guest loaded the deployed map, 5,185+ vessel positions, Suez navigation, vessel search and a vessel deep link. Safari opened the shell but stalled on map hydration in this session; Chrome testing continues and Safari remains an open compatibility check.
- P3/P4: `24becae` and `dddf23b` added bounded claim checks, dated cohorts and the route scenario. Read-only runtime probes covered all four regions with both windows. Review fixed an ambiguous SQL grouping, exposed incomplete historical days, and clarified contacts versus completed passages. Browser checks covered unsupported wording, Suez counts, and vessel map links.
- P5: `722d29e` added the 48-hour collection strip and bounded vessel-gap diagnostics. Ten focused tests and live read-only queries passed. Chrome showed MAERSK EDMONTON's 297-minute retained-fix gap alongside 16 overlapping regional collection windows. Safari phone testing switched to Suez and showed AL NASRIYAH's 50-minute gap and five overlapping collection windows. `11e5c1a` fixes the bottom-navigation overlap found during that test.
- P6/integration: `ab13011` and `8891abb` added shared navigation, cached evidence, immutable annotated stories, embeds and browser-local follows. Restricted-role INSERT/SELECT story probes passed and rolled back; UPDATE and DELETE returned permission denied. The live API rejected caller-supplied evidence, returned 201 on a supported story, and returned identical snapshot JSON on repeated GETs. Embeds alone allow framing; ordinary pages retain DENY.
- P4 browser repair: `3af8350` fixes map container sizing and adds an explicitly labeled route schematic if rendering fails. Earlier CI correctly rejected the constructor error handler's effect lint violation; that was fixed. Safari now visibly renders both geographic routes, switches emphasis, and changes from waiting 12.7 days faster at five days' delay to Cape 7.3 days faster at 25 days' delay.
- P7 automation: `npm run check` passed with 926 tests, 9 todo, lint and type checking. `npm audit --omit=dev --audit-level=high` reported zero vulnerabilities. The final local canary build succeeded after earlier native SWC loading stalls. [CI at 3af8350](https://github.com/randyren278/straits/actions/runs/36973440457) passed schema/migrations, quality checks, dependency audit, canary-preview build and production-gate build; [CodeQL](https://github.com/randyren278/straits/actions/runs/36973440353) passed.
- P7 computer use: Safari created an annotated story through the UI, reopened its stable URL, navigated Assessment → Counts → Vessels → Sources, opened the embed, followed a question, revisited its unchanged baseline, refreshed, and unfollowed it. [Walkthrough snapshot](https://canary.straits.randyren.org/investigations/stories/e7a2d5a2-7136-426d-9435-0f39ab5b869a). Responsive Design Mode at 390×844 verified workspace navigation, following, coverage selectors/details, and the scenario map. Chrome control became intermittent; Safari completed the remaining interaction checks without changing browser security settings.
- Production boundary: live experimental paths return 404 on `straits.randyren.org`; `master` remains `5992269f4e4e1e59f0f7f7afe0d561e74cd869a0` and its domain remains on deployment `dpl_4CcxDCTGGwM9kwcB6hnSGdMnwB3X`. No experimental revision was promoted.
