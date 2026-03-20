# S02: The Anomaly Matrix Visualizer — UAT

**Milestone:** M007
**Written:** 2026-03-20

## UAT Type

- UAT mode: mixed (artifact-driven verification + human visual inspection)
- Why this mode is sufficient: Structural correctness is proven by 18 passing tests and `tsc --noEmit`. The amber luminescence scaling requires human eyes — no automated test can verify aesthetic brightness perception.

## Preconditions

- Next.js dev server running (`npm run dev`)
- AIS ingester running or database seeded with anomaly data including vessels with varied `ship_type` values (some 70-79 for cargo, some 80-89 for tanker, some outside those ranges)
- At least one sanctioned vessel in the dataset (for layout ordering verification)

## Smoke Test

Navigate to `/fleet`. Between the "Sanctioned Vessels" panel and the collapsed anomaly tables, a 3×6 grid labeled "ANOMALY MATRIX" should be visible with numeric counts in each cell.

## Test Cases

### 1. Matrix Grid Structure

1. Navigate to `/fleet`
2. Locate the "ANOMALY MATRIX" section
3. **Expected:** A table with 3 rows labeled TANKER, CARGO, OTHER and 6 columns labeled DARK, LOITER, ROUTE, DRIFT, REPEAT, STS. Every cell contains a numeric count (including 0).

### 2. Layout Ordering

1. Navigate to `/fleet`
2. Scroll from top to bottom
3. **Expected:** Visual order is: (1) Sanctioned Vessels panel → (2) Anomaly Matrix grid → (3) Collapsed anomaly type tables. No other ordering.

### 3. Amber Brightness Scaling

1. Navigate to `/fleet` with a dataset that has varying anomaly counts per cell
2. Compare cells with count 0 to cells with count 1-2 to cells with count 10+
3. **Expected:** Cells with count 0 appear nearly transparent. Cells with 1-2 show faint amber. Cells with 10+ show vivid, bright amber. The brightness increases with count in visually distinct steps.

### 4. Count Accuracy

1. Navigate to `/fleet`
2. Open browser DevTools and run: `fetch('/api/anomalies').then(r => r.json()).then(d => console.log(d.anomalies.filter(a => a.shipCategory === 'tanker' && a.anomalyType === 'going_dark').length))`
3. Compare the console output to the TANKER/DARK cell in the matrix
4. **Expected:** The numbers match exactly.

### 5. shipCategory in API Response

1. Run: `curl localhost:3000/api/anomalies | jq '.anomalies[0].shipCategory'`
2. **Expected:** Returns `"tanker"`, `"cargo"`, or `"other"` — never `null` or `undefined`.

### 6. Anomaly Tables Still Collapsed

1. Navigate to `/fleet`
2. Observe the anomaly type group tables below the matrix
3. **Expected:** All tables are collapsed (showing only headers with expand buttons). None are expanded by default.

## Edge Cases

### Empty Anomalies (No Data)

1. Clear all anomaly data from the database (or test with a fresh empty DB)
2. Navigate to `/fleet`
3. **Expected:** The anomaly matrix does NOT render at all — no empty grid, no "ANOMALY MATRIX" label. The page shows the Sanctioned Vessels panel (possibly empty) and the anomaly tables section.

### Vessel with Missing ship_type

1. Insert an anomaly whose underlying vessel has `ship_type = NULL` in the database
2. Navigate to `/fleet`
3. **Expected:** That anomaly's count appears in the OTHER row, not in TANKER or CARGO. The matrix does not crash or show NaN.

### Single Anomaly in Dataset

1. Ensure only one anomaly exists in the database
2. Navigate to `/fleet`
3. **Expected:** The matrix renders with exactly one cell showing count 1 (faint amber) and all other cells showing 0 (near-transparent). The grid structure is still 3×6.

## Failure Signals

- Matrix does not appear between SanctionedVessels and anomaly tables → component not wired into FleetPage
- Cell counts show NaN or "undefined" → aggregation logic broken or `shipCategory` not in API response
- All cells appear the same brightness → brightness tier function not applying CSS classes correctly
- Browser console shows TypeScript or runtime errors on `/fleet` → type mismatch or import failure
- `curl /api/anomalies` returns 500 → SQL CASE expression or JOIN on `vessels` table failed
- API response missing `shipCategory` field → SQL query not updated or column alias mismatch

## Not Proven By This UAT

- Performance under high anomaly counts (10k+) — the client-side aggregation is untested at scale
- Click-through from matrix cells to filtered anomaly lists — not implemented
- Correct categorization for all 100 possible AIS ship type codes — only the 70-79/80-89 ranges are verified
- Mobile/responsive layout of the matrix — not tested at narrow viewports

## Notes for Tester

- The brightness tiers are: 0 = `bg-amber-500/5`, 1-2 = `bg-amber-500/15`, 3-5 = `bg-amber-500/30`, 6-9 = `bg-amber-500/50`, 10+ = `bg-amber-500/80`. On a dark background, the lowest tier should be barely visible.
- If your dataset has very few anomalies, most cells will be 0 or 1 — you won't see the full brightness range. Seed with diverse data to test the spectrum.
- The column header "DRIFT" corresponds to anomaly type `speed`, and "ROUTE" corresponds to `deviation` — these are intentional abbreviations, not bugs.
