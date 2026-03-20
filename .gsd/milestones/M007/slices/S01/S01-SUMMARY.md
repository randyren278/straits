---
id: S01
parent: M007
milestone: M007
provides:
  - AnomalyTable defaults to collapsed state on /fleet page
  - SanctionedVessels red-accented panel with IMO deduplication rendered above anomaly groups
  - 12 component tests locking collapsed-default and sanctions-list behavior
requires: []
affects:
  - S02
key_files:
  - src/components/fleet/AnomalyTable.tsx
  - src/components/fleet/SanctionedVessels.tsx
  - src/app/(protected)/fleet/page.tsx
  - src/components/fleet/__tests__/AnomalyTable.test.tsx
  - src/components/fleet/__tests__/SanctionedVessels.test.tsx
  - tests/setup.ts
key_decisions:
  - SanctionedVessels receives pre-filtered, deduplicated data from FleetPage rather than doing its own filtering — keeps the component pure and testable
  - Installed @testing-library/user-event and @testing-library/jest-dom as dev dependencies for component testing (neither existed prior)
patterns_established:
  - IMO deduplication with highest-risk-score-wins using Map accumulator in FleetPage
  - React component tests use afterEach(cleanup) with happy-dom and getByRole name filters for resilient queries
  - Mock heavy child components (FleetVesselDetail) via vi.mock to keep unit tests focused
observability_surfaces:
  - aria-expanded attribute on AnomalyTable toggle button reflects collapsed/expanded state
  - data-testid="sanctioned-vessels" on SanctionedVessels outer div when sanctioned vessels present
  - Vessel count badge [N] in sanctions header visible without interaction
  - Risk score color-coded (red ≥70, amber ≥40, green otherwise) for at-a-glance severity
drill_down_paths:
  - .gsd/milestones/M007/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M007/slices/S01/tasks/T02-SUMMARY.md
duration: 20m
verification_result: passed
completed_at: 2026-03-20
---

# S01: Default-Collapsed Tables & Sanctions Priority List

**Anomaly tables on `/fleet` now default to collapsed, and a red-accented "SANCTIONED VESSELS" panel with IMO deduplication renders above all anomaly groups.**

## What Happened

Two focused changes to the fleet page — one state flip and one new component:

**T01 — Collapsed by default.** Changed `useState<boolean>(true)` to `useState<boolean>(false)` in `AnomalyTable.tsx` — a single-line production change. Added 5 Vitest+RTL tests covering default collapsed state, toggle expansion, round-trip collapse, count display, and accessible labeling. This required installing `@testing-library/user-event` and `@testing-library/jest-dom` (first component tests in the project), and adding `@testing-library/jest-dom/vitest` to the global test setup.

**T02 — Sanctioned vessels panel.** Created `SanctionedVessels.tsx` — a Bloomberg terminal-style panel with `border-red-500/30`, pulsing red dot, monospaced uppercase headers, and a 5-column table (Vessel Name, IMO, Flag, Risk Score, Sanction Category). The component is a pure display component that returns `null` for empty arrays. In `FleetPage`, added deduplication logic that filters anomalies for `isSanctioned === true`, groups by IMO keeping the highest `riskScore` entry, and passes the result to `<SanctionedVessels>` rendered above the anomaly groups. Added 7 tests covering rendering, empty state, count badge, `data-testid`, risk score coloring, header label, and single-vessel edge case.

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run src/components/fleet/__tests__/AnomalyTable.test.tsx` | ✅ 5/5 pass |
| `npx vitest run src/components/fleet/__tests__/SanctionedVessels.test.tsx` | ✅ 7/7 pass |
| `npx tsc --noEmit` | ✅ zero errors |
| `aria-expanded` attribute present on toggle button | ✅ confirmed |
| `data-testid="sanctioned-vessels"` present on panel | ✅ confirmed |

## Deviations

- Installed `@testing-library/user-event` and `@testing-library/jest-dom` — not in the plan but required since no component tests existed previously.
- Added `@testing-library/jest-dom/vitest` import to `tests/setup.ts` for global DOM matchers.
- T02 produced 7 tests instead of the planned 4 — extra coverage for `data-testid`, header label, risk score coloring, and single-vessel edge case.

## Known Limitations

- The `SanctionedVessels` panel filters from the client-side anomalies array — it only shows sanctioned vessels that also have anomalies, not all sanctioned vessels globally. This is by design for this slice but may need revisiting if a comprehensive sanctions registry is wanted.
- No pagination on the sanctioned vessels list. Works fine for typical fleet sizes but could get long if many vessels are sanctioned simultaneously.

## Follow-ups

- S02 will add the Anomaly Matrix heatmap above the sanctions panel, requiring `ship_type` data from the API — the visual hierarchy between sanctions panel, heatmap, and collapsed tables needs attention.

## Files Created/Modified

- `src/components/fleet/AnomalyTable.tsx` — Changed initial `expanded` state from `true` to `false`
- `src/components/fleet/SanctionedVessels.tsx` — New: red-accented Bloomberg-style panel displaying deduplicated sanctioned vessels
- `src/app/(protected)/fleet/page.tsx` — Added SanctionedVessels import, IMO deduplication logic, rendering above anomaly groups
- `src/components/fleet/__tests__/AnomalyTable.test.tsx` — New: 5 tests for collapsed-default behavior and toggle
- `src/components/fleet/__tests__/SanctionedVessels.test.tsx` — New: 7 tests for rendering, empty state, deduplication, diagnostics
- `tests/setup.ts` — Added `@testing-library/jest-dom/vitest` import for global DOM matchers

## Forward Intelligence

### What the next slice should know
- The `/fleet` page now has three visual layers top-to-bottom: SanctionedVessels (red accent, conditional), then anomaly group tables (amber, all collapsed). S02's AnomalyMatrix heatmap needs to slot between the sanctions panel and the anomaly tables, or above everything — decide the visual ordering early.
- The anomalies array in FleetPage is already being filtered and deduplicated for sanctions. S02's matrix aggregation should work from the same `anomalies` state but will need the new `shipCategory` field added by the API change.

### What's fragile
- The `SanctionedVessels` component depends on `isSanctioned` being present in the `Anomaly` type — if the API stops returning this field or renames it, the sanctions panel silently disappears (returns `null` for empty array). There's no error state for "sanctions data unavailable."
- Client-side grouping in FleetPage now does both `groupByType` and sanctions deduplication on every render. With large anomaly datasets (10k+), this could cause jank.

### Authoritative diagnostics
- `npx vitest run src/components/fleet/__tests__/` — runs all 12 fleet component tests; if these pass, the collapsed-default and sanctions-list contracts hold.
- `data-testid="sanctioned-vessels"` in browser DevTools — quick check that the sanctions panel is rendering in production.

### What assumptions changed
- Original assumption: component testing infrastructure existed. Reality: no component tests existed; `@testing-library/user-event` and `@testing-library/jest-dom` had to be installed and wired into `tests/setup.ts`. This is now done and available for all future component tests.
