# Phase 12: Behavioral Pattern Detection - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement three behavioral pattern detectors that run as cron jobs and surface through the existing anomaly pipeline:
1. **Repeat going-dark** — vessels with 3+ going_dark events (including resolved) in 30 days → `repeat_going_dark` anomaly type
2. **Destination changes** — new `vessel_destination_changes` table; detect changes in AIS ingester upsert path and log them
3. **Ship-to-ship transfers** — SQL haversine spatial query for vessel pairs within 0.5nm for 30+ minutes → `sts_transfer` anomaly type for BOTH vessels

All three require DB schema additions. No new UI needed — existing anomaly pipeline (upsertAnomaly → vessel_anomalies → /api/anomalies → NotificationBell + map badges + VesselPanel) handles display automatically.

</domain>

<decisions>
## Implementation Decisions

### Repeat Going-Dark
- New anomaly type `repeat_going_dark` — reuses existing pipeline automatically (no UI changes)
- Threshold: 3+ going_dark events (including resolved ones) in past 30 days
- Auto-resolve: when vessel's going_dark count in last 30 days drops below 3 on next check
- Query `vessel_anomalies` counting ALL going_dark rows (WHERE resolved_at IS NOT NULL OR resolved_at IS NULL) in last 30 days grouped by imo

### Destination Change Tracking
- New table `vessel_destination_changes`: `(id SERIAL PRIMARY KEY, imo TEXT NOT NULL, previous_destination TEXT NOT NULL, new_destination TEXT NOT NULL, changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`
- Detect in ingester `upsertVessel()` path: SELECT current destination before upsert, compare after
- Only log when BOTH previous and new destination are non-null AND differ (case-insensitive) — ignore NULL→value transitions
- Add index on (imo, changed_at DESC) for panel queries

### Ship-to-Ship Transfer Detection
- New anomaly type `sts_transfer` logged for BOTH vessels simultaneously
- SQL haversine approximation (no PostGIS): use `2 * 6371 * asin(sqrt(sin(radians((lat2-lat1)/2))^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians((lon2-lon1)/2))^2))` — threshold 0.926km (0.5nm)
- Both vessels must have positions within the last 30 minutes
- Run every 30 minutes (same cron as loitering/speed)
- Details stored: `{ otherImo: string, otherName: string, distanceKm: number, lat: number, lon: number }`
- Confidence: always `suspected`

### AnomalyType extension
- Add `'repeat_going_dark'` and `'sts_transfer'` to `AnomalyType` union in `src/types/anomaly.ts`
- Add corresponding detail interfaces: `RepeatGoingDarkDetails` and `StsTransferDetails`

### Claude's Discretion
- Whether to add the DB migration inline in schema.sql or as a separate migration file
- Exact SQL for the STS pair-finding query (performance optimization choices)
- Whether to deduplicate STS pairs (avoid logging A→B and B→A simultaneously as two separate records)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/detection/going-dark.ts` — reference pattern for querying anomalies by type and time window
- `src/lib/db/anomalies.ts` — `upsertAnomaly()`, `resolveAnomaly()` ready to use
- `src/lib/db/vessels.ts` — `upsertVessel()` is where destination change detection should hook in
- `src/services/ais-ingester/detection-jobs.ts` — register new detectors in `*/30` cron
- `src/types/anomaly.ts` — extend `AnomalyType` union and add new detail interfaces
- `src/lib/db/schema.sql` — add new table DDL here

### Established Patterns
- All detectors: async function returning `Promise<number>` (count of anomalies detected)
- Anomaly details are typed interfaces stored as JSONB
- Coverage: all detectors have test files in `src/lib/detection/`
- `upsertAnomaly()` handles ON CONFLICT to avoid duplicates for active anomalies

### Integration Points
- `src/services/ais-ingester/index.ts` — calls `upsertVessel()` on each AIS message; destination change detection hooks here
- `src/services/ais-ingester/detection-jobs.ts` — register `detectRepeatGoingDark()` and `detectStsTransfers()` in `*/30` cron
- `src/lib/db/schema.sql` — add `vessel_destination_changes` table DDL

</code_context>

<specifics>
## Specific Ideas

- For STS deduplication: only create anomaly for vessel with lexicographically smaller IMO in the pair-finding query to avoid logging both directions; then create the second vessel's anomaly from the first's data
- For repeat going-dark query: `COUNT(*) FILTER (WHERE anomaly_type = 'going_dark' AND detected_at > NOW() - INTERVAL '30 days') >= 3`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
