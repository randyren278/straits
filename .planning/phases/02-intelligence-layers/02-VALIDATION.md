---
phase: 2
slug: intelligence-layers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (existing from Phase 1) |
| **Config file** | vitest.config.ts (exists) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| INTL-01 | Sanctions matched by IMO | unit | `npm run test -- src/lib/sanctions/matcher.test.ts` | ❌ W0 | ⬜ pending |
| INTL-02 | Oil prices fetched and stored | unit | `npm run test -- src/lib/prices/fetcher.test.ts` | ❌ W0 | ⬜ pending |
| INTL-03 | News headlines filtered by keywords | unit | `npm run test -- src/lib/news/fetcher.test.ts` | ❌ W0 | ⬜ pending |
| MAP-06 | Vessel search returns matches | unit | `npm run test -- src/lib/db/vessels.test.ts` | ✅ (extend) | ⬜ pending |
| MAP-07 | Chokepoint count is correct | unit | `npm run test -- src/lib/chokepoints/counter.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/sanctions/matcher.test.ts` — sanctions matching tests
- [ ] `src/lib/prices/fetcher.test.ts` — oil price fetcher tests
- [ ] `src/lib/news/fetcher.test.ts` — news fetcher tests
- [ ] `src/lib/chokepoints/counter.test.ts` — chokepoint counting tests
- [ ] Extend `src/lib/db/vessels.test.ts` — add search tests
- [ ] Framework install: `npm install recharts node-cron papaparse && npm install -D @types/papaparse`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sanctions badge visible on map | INTL-01 | Visual marker styling | Load sanctioned vessel, verify red badge on marker |
| Oil price sparkline renders | INTL-02 | Recharts visual output | View oil panel, verify 30-day chart draws |
| News headlines scrollable | INTL-03 | UI interaction | Open news panel, scroll through headlines |
| Search autocomplete works | MAP-06 | UI interaction | Type vessel name, verify dropdown appears |
| Chokepoint click zooms map | MAP-07 | Map interaction | Click widget, verify map flies to chokepoint |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
