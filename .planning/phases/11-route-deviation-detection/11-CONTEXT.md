# Phase 11: Route Deviation Detection - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement route deviation detection by completing the existing stub in `deviation.ts`. Detect when a vessel's heading (sustained 2+ hours) contradicts its declared AIS destination by geocoding the destination text via Nominatim, computing the expected bearing, comparing to actual heading, and flagging differences >45°. Surface through the existing anomaly pipeline (upsertAnomaly → vessel_anomalies table → /api/anomalies → NotificationBell + map badge + VesselPanel).

</domain>

<decisions>
## Implementation Decisions

### Port Resolution
- Use Nominatim external geocoding (free, no API key required) to convert destination text → coordinates
- Cache results in an in-memory Map per process restart to avoid repeated API calls
- Skip vessels silently when destination is NULL, empty, or cannot be geocoded
- Normalize destination text: uppercase + trim whitespace before geocoding query

### Detection Thresholds
- Flag deviation when heading diverges >45° from bearing-to-destination
- Only flag when heading has been wrong for 2+ hours (check across recent positions in the window)
- Always use `suspected` confidence — geocoding introduces uncertainty, don't overstate

### Cron & Lifecycle
- Run detection every 30 minutes (matches loitering/speed detector cadence)
- Auto-resolve anomaly when vessel heading is back within 45° threshold on next check
- Geocoding cache lives in-memory (per process restart) — no DB persistence needed for cache

### Claude's Discretion
- Bearing calculation approach (haversine-based initial bearing formula)
- How many recent positions to sample for the 2-hour sustained check
- Error handling for Nominatim API failures (fail silently, skip vessel)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/detection/deviation.ts` — existing stub with `detectDeviation()` and `isSpeedAnomaly()` — replace the stub
- `src/lib/db/anomalies.ts` — `upsertAnomaly()` and `resolveAnomaly()` ready to use
- `src/lib/detection/going-dark.ts` — reference pattern for querying recent positions window
- `src/lib/detection/loitering.ts` — reference pattern for multi-position time window queries
- `src/types/anomaly.ts` — `DeviationDetails` interface already defined: `{ expectedHeading, actualHeading, deviationDegrees, destination }`
- `src/lib/geo/anchorages.ts` — geo utility pattern to follow

### Established Patterns
- All detectors query `vessel_positions` with a time window (INTERVAL '2 hours' / '4 hours')
- Detection job calls `upsertAnomaly()` with typed details matching the interface
- `resolveAnomaly(imo, anomalyType)` used when condition clears
- Detectors return count of anomalies found
- Cron registered in `detection-jobs.ts`

### Integration Points
- `src/services/ais-ingester/detection-jobs.ts` — add `detectDeviation()` to the 30-minute cron
- Anomaly type `'deviation'` already exists in `AnomalyType` union and DB
- No UI changes needed — existing anomaly pipeline handles display automatically

</code_context>

<specifics>
## Specific Ideas

- Nominatim query: `https://nominatim.openstreetmap.org/search?q={destination}&format=json&limit=1` — take first result lat/lon
- Rate limit Nominatim calls: cache first, then single lookup per unknown destination per process lifetime
- Add User-Agent header to Nominatim requests (required by their ToS): `TankerTracker/1.0`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
