---
phase: 7
slug: documentation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (confirm no regressions from file edits)
- **After every plan wave:** Run `npm test` full suite
- **Before `/gsd:verify-work`:** Full suite green + manual README walkthrough

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-T1 | 01 | 1 | DOCS-04 | manual | `git check-ignore -v .env .next tsconfig.tsbuildinfo` | ✅ .gitignore exists | ⬜ pending |
| 7-01-T2 | 01 | 1 | DOCS-02 | manual | `npm test` (regression check) | ✅ existing | ⬜ pending |
| 7-02-T1 | 02 | 2 | DOCS-01, DOCS-03 | manual | `npm test` (regression check) | n/a — creates README | ⬜ pending |
| 7-02-checkpoint | 02 | 2 | DOCS-01–04 | human | Follow README walkthrough | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — Phase 7 is documentation only. No new test files needed.

*Existing test suite run after each task to confirm no regressions.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README local setup steps work end-to-end | DOCS-01 | Requires running Docker, psql, npm | Follow README from fresh clone; confirm app loads |
| All 8 env vars documented with descriptions | DOCS-02 | Content review | Read README env section; count and verify all vars |
| Production deployment section complete | DOCS-03 | Content review | Read README deploy section; confirm Railway/Render guidance |
| .gitignore excludes secrets/artifacts | DOCS-04 | Git behavior | Run `git check-ignore` on .env, .next/, tsconfig.tsbuildinfo |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
