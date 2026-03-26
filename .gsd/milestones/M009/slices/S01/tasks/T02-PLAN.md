---
estimated_steps: 7
estimated_files: 2
skills_used: []
---

# T02: End-to-end browser verification

Verify end-to-end in the browser that all views are consistent.

Steps:
1. Load dashboard — count visible vessels on map
2. Check browser console for zero Mapbox GL warnings
3. Check chokepoint widget shows non-zero counts where vessels exist
4. Load fleet tab — verify anomaly vessels are a subset of map vessels
5. Verify /api/vessels count >= /api/anomalies unique IMO count

## Inputs

- `/api/vessels`
- `/api/anomalies`
- `/api/chokepoints`

## Expected Output

- `Browser verification screenshots`
- `API response counts`

## Verification

browser_assert checks pass; API count comparison confirms fleet ⊆ map
