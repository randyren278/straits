---
phase: quick-8
plan: "01"
subsystem: documentation
tags: [readme, ais, coverage, documentation]
dependency_graph:
  requires: []
  provides: [updated-ais-coverage-docs]
  affects: [README.md]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - README.md
decisions:
  - README uses region-first framing (Persian Gulf through Suez) instead of chokepoint-only framing
  - Coverage Areas table placed between ingester log block and "Vessel positions will start appearing" line for natural reading flow
metrics:
  duration: "< 2 min"
  completed: "2026-03-14"
  tasks_completed: 1
  files_modified: 1
---

# Phase quick-8 Plan 01: Update Documentation to Reflect Expanded AIS Coverage Summary

**One-liner:** README now documents all 6 AIS regional bounding boxes (Persian Gulf through Suez Canal) replacing the outdated 3-chokepoint framing.

## What Was Done

Two targeted edits to README.md:

1. **Intro paragraph (line 3):** Changed "across the Middle East and major export routes (Hormuz, Bab el-Mandeb, Suez)" to "across the Middle East and major export routes, from Persian Gulf loading terminals through the Strait of Hormuz, Arabian Sea, Red Sea, and Suez Canal" — accurately reflecting the 6-region scope added in quick task 7.

2. **AIS Ingester section:** Added a "Coverage Areas" subsection after the startup log block containing a table of all 6 bounding boxes with lat/lon ranges and purpose, plus a note on how to adjust coverage.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update README coverage documentation | ee8ba4d | README.md |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] README.md modified with both edits
- [x] `grep -c "Persian Gulf" README.md` returns 2 (intro + table)
- [x] `grep -c "Coverage Areas" README.md` returns 1
- [x] Commit ee8ba4d exists
- [x] No unrelated README sections altered
