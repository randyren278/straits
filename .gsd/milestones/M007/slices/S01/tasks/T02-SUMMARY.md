---
id: T02
parent: S01
milestone: M007
provides:
  - SanctionedVessels component with red-accented Bloomberg terminal styling
  - FleetPage deduplicates sanctioned anomalies by IMO (highest risk score wins)
  - SanctionedVessels renders above anomaly groups on /fleet page
  - Component returns null when no sanctioned vessels exist
key_files:
  - src/components/fleet/SanctionedVessels.tsx
  - src/app/(protected)/fleet/page.tsx
  - src/components/fleet/__tests__/SanctionedVessels.test.tsx
key_decisions:
  - SanctionedVessels receives pre-filtered data from FleetPage rather than doing its own filtering — separation of concerns keeps the component pure
  - Used data-testid="sanctioned-vessels" for diagnostic inspection as specified in slice observability requirements
patterns_established:
  - Deduplication by IMO with highest-risk-score-wins in FleetPage using Map accumulator pattern
  - Conditional spacing with template literal className to avoid empty margin when sanctions section is absent
observability_surfaces:
  - data-testid="sanctioned-vessels" on the outer div when sanctioned vessels are present
  - Vessel count visible in header badge [N] without interaction
  - Risk score color-coded (red ≥70, amber ≥40, green otherwise) for at-a-glance severity
duration: 8m
verification_result: passed
completed_at: 2026-03-20
blocker_discovered: false
---

# T02: Create SanctionedVessels component and wire into FleetPage

**Created red-accented SanctionedVessels panel with IMO deduplication, wired above anomaly groups on /fleet, and added 7 component tests.**

## What Happened

1. Created `src/components/fleet/SanctionedVessels.tsx` — a Bloomberg terminal-style panel with red accent border (`border-red-500/30`), pulsing red dot indicator, monospaced uppercase headers, and 5-column table (Vessel Name, IMO, Flag, Risk Score, Sanction Category). Returns `null` for empty arrays. Risk scores are color-coded by severity threshold.

2. Modified `src/app/(protected)/fleet/page.tsx`:
   - Added `SanctionedVessels` import.
   - Added deduplication logic after `groupByType()` that filters `isSanctioned` anomalies, deduplicates by IMO keeping the highest `riskScore`, and produces a clean array.
   - Rendered `<SanctionedVessels>` above the anomaly groups inside a fragment, with conditional `mt-4` spacing when sanctioned vessels exist.

3. Created `src/components/fleet/__tests__/SanctionedVessels.test.tsx` with 7 tests:
   - Renders vessel data correctly (names, IMOs, flags, categories)
   - Returns null for empty array
   - Displays count badge `[2]`
   - Renders `data-testid` for diagnostic inspection
   - Colors risk scores by threshold (red ≥70, amber ≥40)
   - Renders header label
   - Shows single vessel correctly

## Verification

- `npx vitest run src/components/fleet/__tests__/SanctionedVessels.test.tsx` — 7/7 tests pass
- `npx vitest run src/components/fleet/__tests__/AnomalyTable.test.tsx` — 5/5 tests pass (no regression)
- `npx tsc --noEmit` — zero errors
- `grep -q 'SanctionedVessels' src/app/(protected)/fleet/page.tsx` — confirmed wired into page

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/components/fleet/__tests__/SanctionedVessels.test.tsx` | 0 | ✅ pass | 544ms |
| 2 | `npx vitest run src/components/fleet/__tests__/AnomalyTable.test.tsx` | 0 | ✅ pass | 725ms |
| 3 | `npx tsc --noEmit` | 0 | ✅ pass | ~2.5s |
| 4 | `grep -q 'SanctionedVessels' src/app/(protected)/fleet/page.tsx` | 0 | ✅ pass | <1s |

## Diagnostics

- Inspect `data-testid="sanctioned-vessels"` in browser DevTools to verify the section renders when sanctioned vessels exist in the anomaly feed.
- Check `[N]` count badge in the red header to verify deduplication produces expected vessel count.
- Run `npx vitest run src/components/fleet/__tests__/SanctionedVessels.test.tsx` to re-verify the behavior contract.
- If sanctions section doesn't appear, verify `/api/anomalies` returns records with `isSanctioned: true` — the component renders nothing when no sanctioned vessels exist (by design).

## Deviations

- Added 7 tests instead of the 4 specified in the plan — extra tests cover `data-testid` presence, header label, risk score coloring, and single-vessel edge case for more comprehensive coverage.

## Known Issues

None.

## Files Created/Modified

- `src/components/fleet/SanctionedVessels.tsx` — New: red-accented panel component displaying sanctioned vessels with risk-scored table
- `src/app/(protected)/fleet/page.tsx` — Modified: added SanctionedVessels import, IMO deduplication logic, and rendering above anomaly groups
- `src/components/fleet/__tests__/SanctionedVessels.test.tsx` — New: 7 component tests validating rendering, empty state, count badge, testid, risk coloring
