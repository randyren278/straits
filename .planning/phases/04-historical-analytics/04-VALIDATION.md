---
phase: 4
slug: historical-analytics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (existing) |
| **Config file** | vitest.config.ts (exists) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| HIST-01 | Traffic aggregation by chokepoint/route | unit | `npm run test -- src/lib/db/analytics.test.ts` | ❌ W0 | ⬜ pending |
| HIST-01 | Route classification from destination | unit | `npm run test -- src/lib/analytics/routes.test.ts` | ❌ W0 | ⬜ pending |
| HIST-01 | Oil price correlation data retrieval | unit | `npm run test -- src/lib/db/analytics.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/db/analytics.test.ts` — Traffic aggregation query tests
- [ ] `src/lib/analytics/routes.test.ts` — Route classification tests
- [ ] No new dependencies needed (Recharts, date-fns already installed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Traffic chart renders with data | HIST-01 | Recharts visual output | View analytics page, verify chart displays |
| Oil price overlay alignment | HIST-01 | Visual correlation check | Compare traffic peaks to price movements |
| Time range selector works | HIST-01 | UI interaction | Switch between 7d/30d/90d, verify chart updates |
| Analytics navigation works | HIST-01 | UI interaction | Click Analytics tab, verify route change |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
