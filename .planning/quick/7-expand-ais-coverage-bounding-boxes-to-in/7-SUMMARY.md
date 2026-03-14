---
phase: quick-7
plan: 7
subsystem: ais-ingester
tags: [ais, bounding-boxes, coverage, sanctions, vessel-freshness]
key-files:
  modified:
    - src/services/ais-ingester/index.ts
    - src/lib/db/sanctions.ts
decisions:
  - "6 regional boxes replace 4 narrow chokepoint-only boxes for full Persian Gulf and Arabian Sea coverage"
  - "24-hour vessel freshness window restored — 336h was an accidental edit that accumulated stale ghost vessels"
metrics:
  duration: 1 min
  completed: 2026-03-14
  tasks: 2
  files: 2
---

# Quick Task 7: Expand AIS Coverage Bounding Boxes to Include Full Regional Routes — Summary

**One-liner:** Replaced 4 narrow chokepoint boxes with 6 broad regional boxes covering full Persian Gulf, Arabian Sea, Red Sea corridor, and reverted accidental 336h vessel window back to 24h.

## What Was Changed

### Task 1: Expanded AIS ingester bounding boxes (commit `9b98183`)

**File:** `src/services/ais-ingester/index.ts`

Replaced the `BoundingBoxes` array in the subscription object with 6 expanded regional boxes:

| # | Region | Lat Range | Lon Range | Purpose |
|---|--------|-----------|-----------|---------|
| 1 | Full Persian Gulf | 23.0 – 30.0 | 47.0 – 57.5 | Loading terminals: Ras Tanura, Kharg Island, Kuwait, UAE ports |
| 2 | Gulf of Oman + Arabian Sea west | 15.0 – 26.0 | 55.0 – 66.0 | Tankers exiting Hormuz eastbound toward India/Asia |
| 3 | Arabian Sea transit corridor | 8.0 – 25.0 | 60.0 – 78.0 | Full eastbound tanker route to India/Asia |
| 4 | Full Red Sea | 12.0 – 30.0 | 32.0 – 45.0 | Entire Red Sea corridor from Bab-el-Mandeb to Suez |
| 5 | Gulf of Aden | 11.0 – 14.0 | 42.0 – 52.0 | Exits from Bab-el-Mandeb heading east |
| 6 | Suez Canal + Eastern Med | 29.5 – 37.0 | 31.5 – 37.0 | Unchanged from prior coverage |

**Before:** 4 boxes — only captured ships at strait entrances (Hormuz narrow entrance, Bab-el-Mandeb, two Suez boxes). Loading terminals, the full Persian Gulf, and the Asian transit corridor were invisible.

**After:** 6 boxes — covers all major tanker loading terminals and transit lanes. Loaded tankers departing Persian Gulf terminals and transiting toward Asia/India are now captured.

### Task 2: Reverted vessel query window to 24 hours

**File:** `src/lib/db/sanctions.ts`

The `getVesselsWithSanctions()` inner CTE had been accidentally changed to `INTERVAL '336 hours'` (14 days). Reverted to `INTERVAL '24 hours'` — the correct freshness policy.

Note: The git diff at conversation start showed `sanctions.ts` as modified (working tree had 336h), and the Edit was applied to restore 24h. The file is now clean and matches the HEAD commit `de9ccac` which had already set 24h as part of the previous quick task fix.

## Verification

```
grep -n "47.0" src/services/ais-ingester/index.ts    → line 87: [[23.0, 47.0], [30.0, 57.5]]
grep -c "[[" src/services/ais-ingester/index.ts       → 6 (all 6 boxes present)
grep -n "INTERVAL" src/lib/db/sanctions.ts            → line 143: INTERVAL '24 hours'
npx tsc --noEmit                                      → clean (no errors)
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `9b98183` | feat(quick-7): expand AIS bounding boxes to full regional coverage |
| 2 | (no new commit needed) | sanctions.ts 24h window was already correct in HEAD |

## Self-Check: PASSED

- `src/services/ais-ingester/index.ts` — FOUND, 6 bounding boxes, Persian Gulf at lon 47.0
- `src/lib/db/sanctions.ts` — FOUND, INTERVAL '24 hours' at line 143
- commit `9b98183` — FOUND in git log
- `npx tsc --noEmit` — clean
