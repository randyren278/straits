---
phase: 6
slug: data-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run` full suite
- **Before `/gsd:verify-work`:** Full suite must be green + manual smoke test of ingester startup

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-W0 | 01 | 0 | WIRE-05, WIRE-06 | unit stubs | `npm test -- --run` | ❌ Wave 0 creates | ⬜ pending |
| 6-01-T1 | 01 | 1 | WIRE-01 | smoke/manual | `npm run ingester` | ✅ existing | ⬜ pending |
| 6-01-T2 | 01 | 1 | WIRE-02, WIRE-03, WIRE-04 | unit | `npm test -- --run` | ✅ existing | ⬜ pending |
| 6-02-T1 | 02 | 2 | WIRE-05 | unit | `npm test -- --run src/app/api/status/route.test.ts` | ❌ Wave 0 creates | ⬜ pending |
| 6-02-T2 | 02 | 2 | WIRE-06 | unit | `npm test -- --run src/services/ais-ingester/detection-jobs.test.ts` | ❌ Wave 0 creates | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/api/status/route.test.ts` — stubs for WIRE-05 (status endpoint)
- [ ] `src/services/ais-ingester/detection-jobs.test.ts` — stubs for WIRE-06 (cron scheduling)
- [ ] `src/services/ais-ingester/refresh-jobs.test.ts` — stubs for WIRE-02/03/04 (refresh jobs)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AIS ingester starts and logs connected/failed | WIRE-01 | Runtime WebSocket; requires live credentials | Run `npm run ingester`, observe console within 10s |
| Oil prices panel shows real WTI/Brent values | WIRE-02 | Requires Alpha Vantage/FRED API key + network | Load dashboard, check oil price panel for non-mock values |
| News panel shows real headlines | WIRE-03 | Requires NewsAPI key + network | Load dashboard, check news panel for real geopolitical headlines |
| Sanctions flag appears on AIS-ingested sanctioned vessel | WIRE-04 | Requires live AIS data + matching IMO | After ingester runs, verify sanctioned vessel shows red marker |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
