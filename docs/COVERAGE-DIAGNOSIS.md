# Coverage diagnosis — why the Gulf is dark

Measured 2026-09-15 02:42–02:46 UTC from the harvester Mac, using the production
AISStream key and the production database (read-only). Reproduce with:

```
npx tsx --env-file=.env.harvester scripts/diagnose-coverage.ts
```

Output: `.diagnostics/coverage-report.json` (gitignored).

## Method

1. Open AISStream with all six `AIS_COVERAGE` boxes for 60 s; bin every
   `PositionReport` by coverage box and by chokepoint box.
2. Open AISStream with **only** the Hormuz chokepoint box for 60 s.
3. Open AISStream with a worldwide box and stop at the first message (key control).
4. Call the existing VesselFinder fallback (`fetchMiddleEastAisFallback`) once
   per coverage box and once per chokepoint box; count non-stale vessels.
5. Query `vessel_positions` for distinct MMSIs per chokepoint (24 h / 7 d).

## Findings

### AISStream, all six boxes, 60 s — 95 messages, 94 position reports, first message at 926 ms

| Region | messages | unique MMSI |
|---|---|---|
| coverage:0 Persian Gulf | 0 | 0 |
| coverage:1 Gulf of Oman / Arabian Sea | 0 | 0 |
| coverage:2 Arabian Sea / India W | 0 | 0 |
| coverage:3 Red Sea | 1 | 1 |
| coverage:4 Bab el-Mandeb / Gulf of Aden | 0 | 0 |
| coverage:5 Suez / Eastern Med | 94 | 88 |
| **hormuz** | **0** | **0** |
| babel_mandeb | 0 | 0 |
| suez | 35 | 32 |
| gulf_of_aden | 0 | 0 |

### AISStream, Hormuz box only, 60 s — 1 message, 0 position reports
Subscription accepted (no error object), socket stayed open, nothing arrived.

### AISStream, worldwide control — first message in 1,188 ms
The key is live. Silence in the Gulf is not a key or connection problem.

### VesselFinder fallback, single snapshot per box

| Region | non-stale vessels |
|---|---|
| coverage:0 Persian Gulf | 2,746 |
| coverage:1 Gulf of Oman / Arabian Sea | 416 |
| coverage:2 Arabian Sea / India W | 280 |
| coverage:3 Red Sea | 324 |
| coverage:4 Bab el-Mandeb / Gulf of Aden | 33 |
| coverage:5 Suez / Eastern Med | 611 |
| **hormuz** | **221** |
| babel_mandeb | 33 |
| suez | 250 |
| gulf_of_aden | 33 |

### Database (production, read-only)

| Chokepoint | distinct MMSI 24 h | distinct MMSI 7 d |
|---|---|---|
| hormuz | 0 | 0 |
| babel_mandeb | 0 | 0 |
| suez | 342 | 668 |
| gulf_of_aden | 0 | 0 |

`vessel_positions`: 35,988 rows, 2026-09-08 02:38 → 2026-09-15 02:36 (the 7-day
retention window). Every row is inside the Suez / Eastern Med box.

## Verdict

**`fallback-suppressed-by-partial-primary`**, on top of **`aisstream-no-gulf-receivers`**.

- AISStream delivers nothing east of the Red Sea. A Hormuz-only subscription is
  accepted and silent while a worldwide one answers in ~1 s, so this is the
  provider's receiver footprint, not a subscription-format bug (`subscription-bug`
  ruled out). It is not a key problem (control passed).
- The VesselFinder fallback sees 221 vessels in the Hormuz box *right now* —
  but `harvest-once.ts` only calls it when AISStream returns **zero positions
  overall**. AISStream's Suez trickle (~90 vessels a window) keeps the primary
  path "successful", so the fallback never runs and the Gulf stays dark every
  cycle. The product then reports `hormuz: 0` with no provenance.

The empty Hormuz panel is therefore a collection-policy artifact, not an
observation of empty water.

## Implication for Phase 3

Take **Branch A** (region-aware fallback): run the fallback for a region when
the primary delivered zero positions in that region during the window, tag each
position with its `source`, and keep writing zero-count `collection_buckets`
rows with the source attempted.

One constraint the plan did not anticipate: the full coverage boxes are far
larger than the chokepoints (2,746 vessels in the Persian Gulf box alone;
~4,400 across all six). At one row per vessel per 10-minute harvest that is
~630k `vessel_positions` rows/day, which would exhaust Supabase's free tier
inside the 7-day retention window (today's total is 36k rows). Phase 3 must
therefore scope the per-region fallback to the **four chokepoint boxes**
(Hormuz 221 + Bab el-Mandeb 33 + Gulf of Aden 33 + Suez only if the primary is
silent there), not the six coverage boxes. That bounds the added load to roughly
+300 rows per harvest (~+43k/day) and still gives every chokepoint a real
observation. Widening to the full boxes is a separate storage decision.

**Revised 2026-09-15 (densify).** On request, the fallback now runs for all
four chokepoint boxes every harvest, Suez included, so the crossing model sees
one fix per vessel per harvest instead of AISStream's ~35–90-contact trickle.
Measured cost: ~560 rows per harvest (~80k/day, ~560k rows over the 7-day
retention). At the measured ~100 B heap per row plus three btree indexes that
is on the order of 150 MB against the 500 MB Supabase cap. The 83 MB of index
bloat found at rollout was reclaimed with a one-time `REINDEX` (→ 3.5 MB); if
the table's indexes creep past ~100 MB again, reindex, and if row growth
exceeds this estimate, drop Suez from the per-harvest fallback first.
