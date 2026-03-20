# S01: Default-Collapsed Tables & Sanctions Priority List — UAT

**Milestone:** M007
**Written:** 2026-03-20

## UAT Type

- UAT mode: mixed (artifact-driven for test contracts + live-runtime for visual verification)
- Why this mode is sufficient: The behavioral contracts (collapsed default, toggle, deduplication, empty-state hiding) are locked by 12 component tests. Visual styling (red accents, Bloomberg aesthetic, risk score colors) requires human inspection on a running page.

## Preconditions

1. Database is running (`docker compose up -d`)
2. Next.js dev server is running (`npm run dev`)
3. AIS ingester has run at least once so `/api/anomalies` returns data (`npm run ingester:dev`)
4. At least one vessel in the anomaly feed has `isSanctioned: true` (check via `curl http://localhost:3000/api/anomalies | jq '[.[] | select(.isSanctioned == true)] | length'`)

## Smoke Test

Navigate to `http://localhost:3000/fleet`. All anomaly group tables should be collapsed (chevron-right icons, no row data visible). If sanctioned vessels exist in the feed, a red-bordered "SANCTIONED VESSELS" panel should appear above the anomaly tables.

## Test Cases

### 1. Anomaly tables default to collapsed

1. Navigate to `/fleet` in a fresh browser tab (clear any cached state).
2. Observe all anomaly group sections (Going Dark, Loitering, Speed, etc.).
3. **Expected:** Every anomaly group shows only its header with a count badge `[N]` and a right-pointing chevron. No vessel rows are visible. The `aria-expanded` attribute on each toggle button reads `"false"`.

### 2. Anomaly table expands on click

1. Click any anomaly group header (e.g. "Going Dark [3]").
2. **Expected:** The table expands to show vessel rows. The chevron rotates downward. `aria-expanded` changes to `"true"`.
3. Click the same header again.
4. **Expected:** The table collapses back. Chevron returns to right-pointing. `aria-expanded` returns to `"false"`.

### 3. Sanctioned vessels panel renders with correct styling

1. With sanctioned vessels present in the feed, navigate to `/fleet`.
2. **Expected:** A panel appears above all anomaly groups with:
   - A red border (`border-red-500/30`)
   - A pulsing red dot indicator
   - Header text "SANCTIONED VESSELS" in red with a count badge `[N]`
   - Monospaced, uppercase headers: VESSEL, IMO, FLAG, RISK, CATEGORY
   - `data-testid="sanctioned-vessels"` attribute on the outer div (verify in DevTools)

### 4. Sanctioned vessels are deduplicated by IMO

1. Verify that a vessel with multiple anomaly types (e.g. both going_dark and loitering) appears in the API response multiple times with the same IMO.
2. Navigate to `/fleet`.
3. **Expected:** That vessel appears only once in the SANCTIONED VESSELS panel, with the highest risk score among its anomalies displayed.

### 5. Risk score color coding

1. Inspect the risk score column in the SANCTIONED VESSELS panel.
2. **Expected:**
   - Scores ≥ 70: red text
   - Scores ≥ 40 and < 70: amber/yellow text
   - Scores < 40: green text

### 6. Sanctions panel hides when no sanctioned vessels exist

1. If possible, test with a dataset where no vessels have `isSanctioned: true` (or temporarily modify the API response).
2. Navigate to `/fleet`.
3. **Expected:** No "SANCTIONED VESSELS" panel appears. No empty red box or placeholder. The page starts directly with the collapsed anomaly group tables. Inspecting the DOM confirms no element with `data-testid="sanctioned-vessels"` exists.

## Edge Cases

### Single sanctioned vessel

1. Ensure exactly one vessel has `isSanctioned: true` in the feed.
2. Navigate to `/fleet`.
3. **Expected:** The panel renders with `[1]` count badge and a single row. No visual artifacts from single-row table rendering.

### All anomaly types present

1. Ensure the feed contains anomalies across multiple types (going_dark, loitering, speed, sts_transfer, deviation).
2. Navigate to `/fleet`.
3. **Expected:** Each anomaly type has its own collapsed group section. All are collapsed by default. The page is not excessively tall — the collapsed view provides a dense overview.

## Failure Signals

- Anomaly tables render expanded on initial page load — the `useState(false)` change was reverted or overridden.
- No red-bordered panel visible when sanctioned vessels exist in `/api/anomalies` — the component isn't wired into FleetPage or the filter logic is wrong.
- Duplicate vessels in the sanctions panel (same IMO appears twice) — the deduplication Map logic is broken.
- `data-testid="sanctioned-vessels"` missing from the DOM — the component renders but the test attribute was removed.
- TypeScript compilation errors on build — type changes broke downstream consumers.

## Not Proven By This UAT

- Performance under large anomaly datasets (10k+ entries) — client-side filtering and deduplication is not stress-tested.
- Whether the sanctions panel looks correct alongside the S02 Anomaly Matrix heatmap (not yet built).
- That all sanctioned vessels globally are shown — only sanctioned vessels with active anomalies appear (by design, filtering from anomalies array).
- Server-side rendering behavior — tests run in happy-dom, not a real SSR environment.

## Notes for Tester

- If no sanctioned vessels appear in your local dataset, you can temporarily add `isSanctioned: true` to a test record in the database, or mock the API response to include one. The component test suite validates empty-state behavior independently.
- The risk score thresholds (70/40) are hardcoded in `SanctionedVessels.tsx` — verify they align with the project's risk categorization if those thresholds have been defined elsewhere.
- The Bloomberg aesthetic (true black background, monospaced fonts, sharp corners) should be consistent with the rest of the `/fleet` page styling. Flag any visual inconsistencies.
