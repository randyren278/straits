---
phase: 3
slug: anomaly-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (existing) |
| **Config file** | vitest.config.ts (exists) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 25 seconds

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| ANOM-01 | Going dark detection by coverage zone | unit | `npm run test -- src/lib/anomalies/going-dark.test.ts` | ❌ W0 | ⬜ pending |
| ANOM-02 | Loitering and route deviation detection | unit | `npm run test -- src/lib/anomalies/route.test.ts` | ❌ W0 | ⬜ pending |
| HIST-02 | Watchlist add/remove and alert generation | unit | `npm run test -- src/lib/watchlist/watchlist.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/anomalies/going-dark.test.ts` — Going dark detection tests
- [ ] `src/lib/anomalies/route.test.ts` — Route anomaly detection tests
- [ ] `src/lib/watchlist/watchlist.test.ts` — Watchlist and alert tests
- [ ] `src/lib/db/anomalies.test.ts` — Anomaly CRUD tests
- [ ] `src/lib/db/watchlist.test.ts` — Watchlist CRUD tests
- [ ] `src/lib/db/alerts.test.ts` — Alert CRUD tests
- [ ] Extend `src/lib/db/schema.sql` — vessel_anomalies, watchlist, alerts tables

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Anomaly badge on map | ANOM-01/02 | Visual marker styling | Trigger test anomaly, verify badge color on map |
| Notification bell dropdown | HIST-02 | UI interaction | Add vessel to watchlist, trigger anomaly, verify notification |
| Watchlist sidebar | HIST-02 | UI interaction | Add/remove vessels, verify sidebar updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 25s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
