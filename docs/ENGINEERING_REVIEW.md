# Straits Engineering Review

> Production-readiness and feature audit, August 2026.

This review compares the public product claims, architecture documentation, API surface, tests, and implementation layout. The goal is not to reward feature count; it is to identify whether Straits behaves like a system a senior engineer could safely operate and extend.

## Executive assessment

Straits already has a strong domain core. It is substantially beyond a dashboard mock-up: the repository contains an AIS ingestion service, a PostgreSQL/TimescaleDB persistence layer, a suite of interpretable maritime anomaly detectors, risk scoring, sanctions/news/price enrichment, a rich map UI, historical analytics, per-vessel intelligence, exports, alerts, and a bounded production harvester.

The largest gap was engineering governance rather than product ambition. Before this hardening pass, the default branch had no CI workflow or required quality gate, deployment could proceed from an unchecked push, liveness/readiness were conflated with data freshness, and the deployed dashboard had no real authentication boundary. This branch addresses those gaps with CI, CodeQL, Dependabot, HTTP hardening, deployment probes, and an opt-in shared-password/JWT gate.

## Capability audit

| Capability | Implementation evidence | Test / validation posture | Assessment |
| --- | --- | --- | --- |
| Real-time AIS ingestion | `src/services/ais-ingester/index.ts`; AIS parser/filter modules | AIS parser/filter tests; ingester-specific tests | Implemented |
| Bounded production harvesting | `src/services/ais-ingester/harvest-once.ts` | timeout/retry/fallback/outage tests | Implemented; operational dependency remains |
| Vessel identity model | IMO-keyed vessel DB model, MMSI resolution | DB/type tests | Implemented |
| Live vessel map | MapLibre components + GeoJSON transforms | map/filter/GeoJSON tests; layout verifier | Implemented |
| Chokepoint monitoring | geo constants/queries for Hormuz, Bab el-Mandeb, Suez, Gulf of Aden | chokepoint tests | Implemented |
| Going-dark detection | `src/lib/detection/going-dark.ts` | dedicated detector tests | Implemented |
| Loitering detection | `src/lib/detection/loitering.ts` | dedicated detector + nav-status suppression tests | Implemented |
| Route / speed deviation | `src/lib/detection/deviation.ts` | dedicated detector tests | Implemented |
| GPS spoof / teleport detection | `src/lib/detection/teleport.ts` | dedicated detector tests | Implemented |
| STS transfer detection | `src/lib/detection/sts-transfer.ts` | detector/rendezvous tests | Implemented |
| Repeat rendezvous / associates | rendezvous archive + vessel associates API/UI | dedicated archive tests | Implemented |
| Destination-flip / composite diversion | `src/lib/detection/destination-flip.ts` + pipeline wiring | dedicated detector tests | Implemented |
| CPA predictive STS nowcast | `src/lib/detection/cpa-predict.ts` | dedicated prediction tests | Implemented but alert-gated pending precision validation |
| Composite dark-fleet risk score | `src/lib/detection/risk-score.ts`, materialized score DB module | risk-score tests | Implemented |
| Sanctions intelligence | OpenSanctions loader + sanctions DB joins | sanctions tests | Implemented |
| Oil-price context | FRED primary + Alpha Vantage fallback | price fetcher/DB tests | Implemented |
| Geopolitical news | Google News RSS ingestion + relevance scoring | news fetcher/DB tests | Implemented |
| Historical traffic analytics | analytics DB/API + Recharts pages | analytics/route tests | Implemented |
| SPC throughput anomaly band | `src/lib/detection/spc-index.ts` | detector tests | Implemented |
| Watchlist + alert inbox | API routes + Zustand/UI | DB/component tests | Implemented; identity is lightweight unless deployment auth is enabled |
| Chokepoint SITREP | `/api/brief/[chokepoint]` | API composition covered by lower-level modules | Implemented |
| Fleet CSV/JSON export | `/api/export` | API/query layer | Implemented |
| Per-vessel dossier export | `/api/export/vessel/[imo]` | API/query layer | Implemented |
| Responsive fleet/dashboard UI | protected pages + components | Playwright layout verifiers and component tests | Implemented |
| Source freshness status | `/api/status` | route tests | Implemented |
| Process liveness | `/api/health` | route contract test | Added in hardening pass |
| Dependency readiness | `/api/ready` | success/failure route tests | Added in hardening pass |
| Deployment authentication | `src/proxy.ts`, login API/UI, signed JWT cookie | auth/session tests | Added in hardening pass; enabled only when secrets are configured |
| Continuous integration | `.github/workflows/ci.yml` | GitHub Actions | Added in hardening pass |
| Static security analysis | `.github/workflows/codeql.yml` | CodeQL | Added in hardening pass |
| Dependency maintenance | `.github/dependabot.yml` | Dependabot | Added in hardening pass |

## What stands out technically

### 1. The project has a real data plane

The standalone WebSocket ingester and the bounded harvesting path make this a distributed system, not only a Next.js application. The ingest path performs parsing, quality filtering, identity resolution, persistence, enrichment, detection, scoring, and alert generation.

### 2. The intelligence is explainable

Most signals are deterministic and inspectable: Haversine distance, timing windows, coverage zones, navigation status, destination changes, statistical-process-control bands, and closest-point-of-approach kinematics. This is a good fit for a high-consequence intelligence UI because every score can be traced to evidence.

### 3. Identity-first risk is a strong domain decision

Using IMO as the hull identity and treating sanctions as an immediate risk contribution avoids the common failure mode where a disciplined sanctioned vessel appears "safe" merely because it has not triggered a behavioral detector recently.

### 4. The codebase has unusually good feature-level test coverage for a portfolio project

The repository has targeted tests across parsing, filters, database access, geo functions, anomaly detectors, UI components, and service behavior. The missing piece was making that body of tests an unavoidable merge/deploy gate.

## Production-readiness gaps found

### P0 — CI and protected delivery

**Before:** `master` accepted direct pushes with no required checks, while Vercel deploys from `master`.

**Hardening:** CI now runs lint, strict typechecking, deterministic Vitest, production build, and dependency audit. CodeQL adds a separate security scan. Dependabot maintains npm and GitHub Actions dependencies.

**Remaining operator action:** configure GitHub branch protection/rulesets for `master` after the workflows have produced their first check names. Require the CI quality/build checks and CodeQL before merge, disallow force pushes, and prefer pull-request-only changes.

### P0 — Deployment access boundary

**Before:** the dashboard and APIs were deliberately open; watchlists/alerts relied on a client-provided `X-User-Id`.

**Hardening:** when `JWT_SECRET` and a real bcrypt `PASSWORD_HASH` are configured, Next.js Proxy protects all product pages and APIs. Login mints an HTTP-only, SameSite signed session cookie. Health/readiness/status endpoints remain public for monitoring. Without those secrets, local/demo behavior remains open.

**Remaining operator action:** configure both production secrets and rotate them through the deployment secret manager. For a multi-user commercial product, replace the shared gate with first-class identity (OIDC/Auth.js/Clerk/etc.) and server-derived user IDs.

### P1 — Live AIS depends on a personal workstation

The deployed database is currently fed by a macOS LaunchAgent running the bounded harvester. This is ingenious for a demo, but it is a single-host availability dependency and is the clearest remaining difference between a strong portfolio deployment and a production service.

**Recommended next architecture:** containerize the always-on ingester and deploy it to a small persistent worker (Fly.io, Railway, Render worker, ECS/Fargate, Kubernetes, or similar), with restart policy, secrets, resource limits, and external uptime monitoring. Keep `harvest-once.ts` as a disaster-recovery/manual catch-up tool.

### P1 — No durable job ownership / distributed scheduling

Detection and enrichment cron jobs live inside the ingester process. If multiple ingesters ever run, duplicate schedules become a coordination problem. Today a local `started` flag prevents duplicates only within one process.

**Recommended next architecture:** introduce Postgres advisory locks or a durable job scheduler so exactly one worker owns each scheduled detector/refresh cycle. Record job executions and failures in a `pipeline_runs` table.

### P1 — Materialized risk scores can silently become stale

Risk scoring happens after detector execution. If scoring fails after anomalies succeed, the UI can serve stale materialized scores.

**Recommended next architecture:** write a score `computed_at`, expose its age in diagnostics, and make score recomputation idempotent/retryable. A periodic reconciliation job should rebuild scores independently of anomaly detection.

### P1 — Sanctions refresh cleanup is not fail-safe

The refresh path removes entries missing from the latest upstream dataset. A syntactically valid but truncated upstream download could therefore delete good intelligence.

**Recommended next architecture:** stage sanctions into a versioned table, validate row-count/coverage invariants, then atomically promote the snapshot. Never reconcile destructive deletions from an unvalidated download.

### P2 — Operational telemetry is still thin

Health/readiness now provide deploy probes, but there is not yet a durable metrics/tracing layer.

**Recommended next architecture:** structured JSON logs with request/job correlation IDs, OpenTelemetry traces, pipeline counters/latencies, error-rate monitoring, and alerts on AIS freshness, job failures, DB latency, and stale risk scores.

### P2 — Hardcoded operational geography

Coverage zones, chokepoints, and anchorages are code constants. That is fast and testable, but changes require a deploy and do not carry provenance/version metadata.

**Recommended next architecture:** keep code defaults but move operational definitions into a versioned configuration table or signed static dataset with source/provenance and an admin validation path.

### P2 — Authentication is intentionally shared, not multi-user

The new gate protects the deployment, but it is not meant to be a complete identity system. The existing client-generated `X-User-Id` should not be treated as authorization in a real multi-user environment.

**Recommended next architecture:** derive user identity from the verified server session and remove trust in arbitrary identity headers.

## Resume / interview value

The project is most compelling when described as an intelligence pipeline rather than a web dashboard. The differentiating story is:

- live maritime telemetry ingestion over WebSocket;
- time-series persistence and dual-engine Postgres portability;
- deterministic anomaly detection over vessel behavior;
- sanctions and geopolitical enrichment;
- explainable composite risk scoring;
- materialized intelligence products (alerts, dossiers, SITREPs, exports);
- real deployment and operations concerns (bounded harvesting, health/readiness, CI, security scanning, auth, RLS).

A senior interviewer will care less about the number of UI panels than whether you can explain failure modes, data provenance, false positives, idempotency, job ownership, security boundaries, and what happens when AIS or the database goes stale. The remaining roadmap above is deliberately aimed at those questions.

## Definition of "production-ready" for Straits

The project should not claim full production readiness until all of the following are true:

1. `master` is protected and all required CI/security checks are enforced.
2. Production auth secrets are configured, or a first-class identity provider replaces the shared gate.
3. The live ingester runs on managed always-on infrastructure rather than a personal workstation.
4. Scheduled jobs have durable ownership, execution history, retry semantics, and alerting.
5. Destructive data refreshes use validated staging + atomic promotion.
6. Risk-score freshness is measured and reconciled independently.
7. External monitoring exercises `/api/health`, `/api/ready`, and `/api/status` with alert thresholds.
8. Recovery procedures for database, ingester, and upstream-source outages are documented and tested.

At the end of this hardening branch, Straits is materially closer: quality and security checks exist, deployment health has explicit contracts, and the application has an enforceable security perimeter when production secrets are configured. The remaining work is primarily infrastructure reliability and observability rather than missing product features.
