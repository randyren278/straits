---
phase: 5
slug: ui-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` (confirm no regressions from component edits)
- **After every plan wave:** Run `npx vitest run` full suite
- **Before `/gsd:verify-work`:** Full suite must be green + manual browser review of each page against success criteria

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-* | 01 | 1 | UI-01, UI-02 | manual+regression | `npx vitest run` | ✅ existing | ⬜ pending |
| 5-02-* | 02 | 2 | UI-03 | manual+regression | `npx vitest run` | ✅ existing | ⬜ pending |
| 5-03-* | 03 | 3 | UI-04, UI-05 | manual+regression | `npx vitest run` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — existing test infrastructure covers all non-visual requirements. No new test files needed for this phase.

*Visual correctness validated manually in browser after each plan.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Background is true black (#000000), amber (#f59e0b) only accent | UI-01 | CSS rendering requires browser | Open dashboard, inspect background color; confirm no blue/navy |
| Data values render in JetBrains Mono | UI-02 | Font rendering requires browser | Open DevTools > Computed > font-family on price/coordinate spans |
| Grid layout — panels beside map, no overlays | UI-03 | Layout requires browser | Inspect map container; no panel uses `position: absolute` over it |
| No rounded corners, tight line spacing | UI-04 | Visual requires browser | Inspect panels for border-radius: 0; check line-height on data rows |
| Header amber active state, no blue | UI-05 | Visual requires browser | Click each nav link; confirm amber highlight, no blue anywhere |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
