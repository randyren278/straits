---
id: M007
provides:
  - Sanctioned Vessels priority panel at top of /fleet page with IMO deduplication and risk-score coloring
  - Default-collapsed AnomalyTable components reducing cognitive load on page load
  - AnomalyMatrix 3×6 heatmap grid (Ship Type × Anomaly Type) with amber brightness scaling
  - shipCategory field on Anomaly TypeScript interface and /api/anomalies SQL response
  - ANOMALY_TYPE_LABELS shared constant extracted to src/types/anomaly.ts
  - Component testing infrastructure (RTL + user-event + jest-dom) available project-wide
key_decisions:
  - SanctionedVessels receives pre-filtered, deduplicated data from FleetPage — pure display component
  - Brightness tiers use 5 pre-defined static Tailwind classes — no dynamic interpolation, required for Tailwind v4 scanner
  - Ship type code ranges hardcoded in SQL CASE: 80-89 = tanker, 70-79 = cargo, everything else = other
  - ANOMALY_TYPE_LABELS extracted to shared types module as single source of truth for AnomalyTable and AnomalyMatrix
patterns_established:
  - IMO deduplication with highest-risk-score-wins using Map accumulator
  - getBrightnessTier() maps count → static CSS class via threshold array — reusable for count-based intensity visualization
  - React component tests use afterEach(cleanup) with happy-dom and getByRole name filters
  - Mock heavy child components via vi.mock to keep unit tests focused
observability_surfaces:
  - data-testid="sanctioned-vessels" — confirms sanctions panel rendered
  - data-testid="anomaly-matrix" — confirms heatmap grid rendered
  - aria-expanded attribute on AnomalyTable toggle button reflects collapsed/expanded state
  - "curl localhost:3000/api/anomalies | jq '.anomalies[0].shipCategory'" — confirms API enrichment
  - 18 component tests in src/components/fleet/__tests__/ — full regression baseline
requirement_outcomes: []
duration: 31m
verification_result: passed
completed_at: 2026-03-20
---

# M007: Fleet Status Matrix & Sanctions Priority

**High-density fleet overview with sanctioned vessel priority panel, default-collapsed anomaly tables, and a terminal-style 3×6 heatmap grid providing instant cross-sectional anomaly visibility by ship type.**

## What Happened

Two slices reshaped the `/fleet` page from a wall of expanded anomaly tables into a layered intelligence dashboard with three distinct visual tiers.

**S01** made two surgical changes. First, a single-line state flip in `AnomalyTable.tsx` (`useState(true)` → `useState(false)`) collapsed all anomaly tables by default, immediately reducing visual noise on page load. Second, a new `SanctionedVessels` component was built — a Bloomberg terminal-style panel with red accent border, pulsing status dot, and a 5-column table showing vessel name, IMO, flag, risk score, and sanction category. The component is pure: `FleetPage` filters the anomalies array for `isSanctioned === true`, deduplicates by IMO keeping the highest risk score, and passes the clean array down. This slice also bootstrapped the project's first component testing infrastructure — installing `@testing-library/user-event` and `@testing-library/jest-dom`, wiring them into `tests/setup.ts`, and producing 12 tests across both components.

**S02** enriched the data pipeline and built the matrix visualization. The `/api/anomalies` SQL query gained a CASE expression mapping AIS ship type codes to `'tanker'` (80-89), `'cargo'` (70-79), or `'other'` (everything else including NULL). The `Anomaly` TypeScript interface and `ShipCategory` type were added to `src/types/anomaly.ts`, and `ANOMALY_TYPE_LABELS` was extracted from `AnomalyTable` into this shared module. The `AnomalyMatrix` component renders a dense `<table>` with 3 rows × 6 columns, aggregating anomaly counts into a Map and applying one of 5 static Tailwind opacity tiers based on count thresholds — cells glow brighter amber as anomaly density increases. Six additional tests brought the total to 18.

The `/fleet` page now renders top-to-bottom: SanctionedVessels (red accent, conditional) → AnomalyMatrix (amber heatmap) → collapsed AnomalyTable groups (expandable on click).

## Cross-Slice Verification

| Success Criterion | Evidence | Status |
|---|---|---|
| `/fleet` renders "Sanctioned Vessels" section at the very top | `SanctionedVessels` rendered first in FleetPage JSX (line 138), `data-testid="sanctioned-vessels"` confirmed in DOM, 7 tests pass | ✅ Met |
| All anomaly tables start in collapsed state by default | `useState<boolean>(false)` on line 33 of `AnomalyTable.tsx`, 5 tests including default-collapsed assertion pass | ✅ Met |
| "Anomaly Matrix" heatmap renders at top of page with Ship Type × Anomaly Type grid | `AnomalyMatrix` component renders 3×6 table (TANKER/CARGO/OTHER × 6 anomaly types), `data-testid="anomaly-matrix"` confirmed, 6 tests pass | ✅ Met |
| Heatmap cells glow brighter amber based on density/count | `getBrightnessTier()` maps counts through 5 static tiers from `bg-amber-500/5` to `bg-amber-500/80`, test "applies correct brightness tier classes based on count" passes | ✅ Met |
| Backend API provides vessel category data | SQL CASE expression returns `shipCategory` as `tanker`/`cargo`/`other`, `Anomaly` interface includes `shipCategory?: ShipCategory`, verifiable via `jq '.anomalies[0].shipCategory'` | ✅ Met |

**Definition of Done:**
- ✅ `AnomalyTable` initializes collapsed — `useState<boolean>(false)` confirmed
- ✅ "Sanctioned Vessels" list prominently displayed at top — first component in render order
- ✅ `AnomalyMatrix` renders Ship Type × Anomaly Type grid with brightness mapping — 3×6 table with 5 opacity tiers
- ✅ Backend API provides vessel category data — SQL CASE + TypeScript type added
- ✅ All slices complete: S01 [x], S02 [x]
- ✅ Both slice summaries exist and are consistent
- ✅ TypeScript: `npx tsc --noEmit` — zero errors
- ✅ Tests: 18/18 pass across 3 test files

## Requirement Changes

No requirements tracked in REQUIREMENTS.md — this project uses legacy mode without formal requirement IDs.

## Forward Intelligence

### What the next milestone should know
- The `/fleet` page now has three visual layers: SanctionedVessels (red) → AnomalyMatrix (amber) → collapsed AnomalyTable groups. Any new section needs to consider placement in this hierarchy.
- `ANOMALY_TYPE_LABELS` in `src/types/anomaly.ts` is the canonical source for anomaly type display names — always import from there, never redeclare.
- `ShipCategory` type (`'tanker' | 'cargo' | 'other'`) is available in `src/types/anomaly.ts` for any feature needing vessel categorization.
- Component testing infrastructure is now fully set up: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` with Vitest happy-dom. Use `afterEach(cleanup)` in every test file.

### What's fragile
- `getBrightnessTier()` uses absolute count thresholds (0/1-2/3-5/6-9/10+). If the fleet grows significantly, most cells will saturate at the highest tier and the matrix loses diagnostic value. Monitor cell distribution.
- `SanctionedVessels` only shows sanctioned vessels that also have anomalies (filters from the anomalies array). Vessels that are sanctioned but have no active anomalies are invisible — this may need a separate data source if comprehensive sanctions visibility is required.
- Client-side grouping in FleetPage runs both `groupByType` and sanctions deduplication on every render. Beyond ~10k anomalies, this will cause jank — move to server-side aggregation if that threshold is reached.
- The SQL CASE expression in `/api/anomalies` hardcodes ship type ranges. AIS classification changes or new categories require a manual edit.

### Authoritative diagnostics
- `npx vitest run src/components/fleet/__tests__/` — 18 tests covering all three fleet components; if these pass, the contracts hold.
- `curl localhost:3000/api/anomalies | jq '.anomalies[0].shipCategory'` — confirms API enrichment is live.
- `data-testid="sanctioned-vessels"` and `data-testid="anomaly-matrix"` in browser DevTools — quick visual confirmation.

### What assumptions changed
- Original assumption: component testing infrastructure existed. Reality: no component tests existed; RTL + jest-dom had to be installed and wired. This is now done and available for all future work.
- No other assumptions changed — the API had `vessels.ship_type` as expected, and Tailwind v4 static class approach worked cleanly.

## Files Created/Modified

- `src/components/fleet/AnomalyTable.tsx` — Changed initial `expanded` state from `true` to `false`; replaced local `ANOMALY_TYPE_LABELS` with import from shared types
- `src/components/fleet/SanctionedVessels.tsx` — New: red-accented Bloomberg-style panel displaying deduplicated sanctioned vessels
- `src/components/fleet/AnomalyMatrix.tsx` — New: terminal-style 3×6 heatmap grid with amber brightness scaling
- `src/app/(protected)/fleet/page.tsx` — Wired SanctionedVessels and AnomalyMatrix; added IMO deduplication logic
- `src/types/anomaly.ts` — Added `ShipCategory` type, `shipCategory` field on `Anomaly`, exported `ANOMALY_TYPE_LABELS`
- `src/app/api/anomalies/route.ts` — Added CASE expression for `shipCategory` in SQL SELECT
- `src/components/fleet/__tests__/AnomalyTable.test.tsx` — New: 5 tests for collapsed-default behavior
- `src/components/fleet/__tests__/SanctionedVessels.test.tsx` — New: 7 tests for sanctions panel
- `src/components/fleet/__tests__/AnomalyMatrix.test.tsx` — New: 6 tests for heatmap matrix
- `tests/setup.ts` — Added `@testing-library/jest-dom/vitest` import for global DOM matchers
