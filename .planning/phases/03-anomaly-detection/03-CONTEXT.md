# Phase 3: Anomaly Detection - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Detect and surface suspicious vessel behavior: AIS gaps (going dark), loitering, route deviations. Users can create a personal watchlist and receive alerts when watched vessels trigger anomalies or enter chokepoints. This phase adds the "something's wrong" detection layer on top of the situational awareness built in Phases 1-2.

</domain>

<decisions>
## Implementation Decisions

### Going Dark Detection (ANOM-01)
- **Definition:** Vessel has no position update for >2 hours while in a terrestrial AIS coverage zone
- **Coverage zones:** Known AIS receiver coverage areas (most of Persian Gulf, Red Sea shipping lanes, Suez approaches)
- **Confidence levels:**
  - **Confirmed:** Last position in coverage zone, no update for >4 hours
  - **Suspected:** Last position in coverage zone, no update for 2-4 hours
  - **Unknown:** Last position outside known coverage zones (satellite gap possible)
- **Detection method:** Scheduled job checks `vessels.last_seen` against coverage zone polygons
- **Storage:** `vessel_anomalies` table — imo, anomaly_type, detected_at, confidence, resolved_at, details (JSONB)
- **Display:** Yellow (suspected) or red (confirmed) "DARK" badge on vessel marker and panel

### Route Anomaly Detection (ANOM-02)
- **Loitering:** Vessel stays within 5nm radius for >6 hours without being at a known port/anchorage
- **Deviation:** Vessel heading differs >45° from expected route to declared destination for >2 hours
- **Speed anomaly:** Tanker moving <3 knots outside port/anchorage (drifting or disabled)
- **Detection method:** Analyze position history patterns, compare to expected behavior
- **Known anchorages:** Predefined list of major anchorage polygons (Fujairah, Kharg Island, Ras Tanura, etc.)
- **Display:** Orange badge with anomaly type, details in vessel panel

### Watchlist & Alerts (HIST-02)
- **Storage:** `watchlist` table — user_id (session-based, not full auth), imo, added_at, notes
- **Alert triggers:**
  - Watched vessel triggers any anomaly (going dark, loitering, deviation)
  - Watched vessel enters or exits a monitored chokepoint
- **Alert delivery:** In-app notification panel (bell icon in header), no email/push for v1
- **Alert storage:** `alerts` table — id, imo, alert_type, triggered_at, read_at, details
- **UI:** "Add to watchlist" button in vessel panel, watchlist sidebar, notification bell with unread count

### Detection Scheduling
- **Going dark check:** Every 15 minutes (cron)
- **Route anomaly check:** Every 30 minutes (cron)
- **Alert generation:** On anomaly detection, check if vessel is in any watchlist

### UI Integration
- **Anomaly badges:** On vessel markers (color-coded by type/severity)
- **Anomaly section:** In vessel panel, showing active anomalies with timestamps
- **Watchlist panel:** Collapsible sidebar showing watched vessels with status
- **Notification bell:** In header, shows unread count, dropdown with recent alerts
- **Anomaly filter:** Toggle in header to show only vessels with active anomalies

### Carrying Forward from Prior Phases
- Dark theme (#1a1a2e background)
- Bloomberg-terminal information density
- Vessel panel pattern (right side, 320px)
- Badge pattern from sanctions (red dot on markers)
- Zustand store pattern for UI state
- API route pattern with pool.query

### Claude's Discretion
- Exact anomaly badge styling and icons
- Notification dropdown design
- Watchlist panel layout details
- Alert sound/animation (if any)
- Exact timing thresholds (can tune based on real data)

</decisions>

<specifics>
## Specific Ideas

- "Going dark" is the most important anomaly — Iran-linked tankers disable AIS to evade tracking
- Loitering near oil fields or in open water is suspicious (possible ship-to-ship transfer)
- Watchlist is for "I want to know when this specific vessel does something weird"
- Alerts should be non-intrusive but noticeable — bell icon with count is sufficient

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/geo/chokepoints.ts` — Bounding box polygon pattern for coverage zones
- `src/lib/db/vessels.ts` — Vessel queries to extend with anomaly joins
- `src/components/panels/VesselPanel.tsx` — Extend with anomaly section
- `src/components/map/VesselMap.tsx` — Badge pattern from sanctions
- `src/stores/vessel.ts` — Zustand store to extend for watchlist/alerts
- `src/components/ui/Header.tsx` — Add notification bell

### Established Patterns
- Scheduled jobs pattern (node-cron from Phase 2)
- Database tables with JSONB details column
- LEFT JOIN enrichment for vessel data
- Color-coded badges on markers
- Collapsible sidebar panels

### Integration Points
- Vessel markers: Add anomaly badge colors
- Vessel panel: Add anomaly section, watchlist button
- Header: Add notification bell, anomaly filter toggle
- Dashboard: Add watchlist sidebar

</code_context>

<deferred>
## Deferred Ideas

- Historical analytics charts — Phase 4
- Oil price correlation with traffic — Phase 4
- Ship-to-ship transfer detection (proximity analysis) — v2
- Dark fleet identification (flag-hopping patterns) — v2
- Email/push notifications — v2

</deferred>

---

*Phase: 03-anomaly-detection*
*Context gathered: 2026-03-12*
