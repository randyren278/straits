---
phase: quick
plan: 260319-vkp
subsystem: ui/documentation
tags: [navigation, about-page, anomaly-definitions, risk-score, readme]
dependency_graph:
  requires: []
  provides: [about-page, three-tab-nav, anomaly-documentation]
  affects: [Header.tsx, README.md]
tech_stack:
  added: []
  patterns: [terminal-panel-styling, active-tab-detection]
key_files:
  created:
    - src/app/(protected)/about/page.tsx
  modified:
    - src/components/ui/Header.tsx
    - README.md
decisions:
  - activeTab derived from pathname with three-way ternary (dashboard/analytics/about)
  - chokepoint widgets gated on activeTab === 'dashboard' so About tab also hides them
  - About page uses max-w-4xl (narrower than analytics max-w-7xl) for readable doc layout
metrics:
  duration: ~5 min
  completed: 2026-03-19
---

# Quick Task 260319-vkp: Add About Tab with Anomaly Definitions

**One-liner:** Three-tab navigation with About page documenting all 6 anomaly types, dark fleet risk score formula with 5 weighted factors, and data sources — plus README v1.3 update.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create About page and add nav tab | 1ed40ca | src/app/(protected)/about/page.tsx, src/components/ui/Header.tsx |
| 2 | Update README with v1.3 features | 297b55f | README.md |

## What Was Built

**Header.tsx** — Changed from `isAnalytics` boolean to `activeTab` string (`dashboard | analytics | about`). Added third Link for `/about` with same active/inactive styling pattern. Chokepoint widgets conditional changed from `!isAnalytics` to `activeTab === 'dashboard'` so they only appear on the Live Map tab.

**About page** — Three terminal-panel sections:
1. Anomaly Events: all 6 types (going_dark, loitering, speed, deviation, repeat_going_dark, sts_transfer) with description and detection thresholds
2. Dark Fleet Risk Score: 5-factor table with exact weights (going dark 8pts/event capped at 40, sanctions 25, flag state 15, loitering 10, STS 10 = 100 max)
3. Data Sources: aisstream.io, OpenSanctions, Alpha Vantage, FRED, NewsAPI, Nominatim

**README.md** — Added 5 feature bullets for v1.3 capabilities and new "Anomaly Detection" section with overview paragraph.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] src/app/(protected)/about/page.tsx exists (197 lines)
- [x] src/components/ui/Header.tsx updated with activeTab and About link
- [x] README.md contains "Anomaly Detection" section and v1.3 feature bullets
- [x] `npx next build` passes — /about appears in route list as static page
- [x] Commits 1ed40ca and 297b55f verified in git log

## Self-Check: PASSED
