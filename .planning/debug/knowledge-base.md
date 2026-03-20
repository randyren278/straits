# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## risk-api-500-panel-blank — vessel_risk_scores table not migrated; risk section invisible in panel
- **Date:** 2026-03-18
- **Error patterns:** 500, risk, vessel_risk_scores, relation does not exist, blank panel, no information, missing section
- **Root cause:** vessel_risk_scores table was never applied to the running PostgreSQL database. Phase 13 schema SQL exists in schema.sql but migration was never run. GET /api/vessels/[imo]/risk throws "relation does not exist" → caught by route → 500. VesselPanel guards risk section with `vesselImo && riskScore`; riskScore stays null (riskRes.ok=false) → risk section never renders.
- **Fix:** Applied CREATE TABLE vessel_risk_scores migration directly via pg client. Added riskError state to VesselPanel to show degraded "RISK SCORE UNAVAILABLE" fallback when fetch fails instead of silently hiding the section.
- **Files changed:** src/components/panels/VesselPanel.tsx
---

## vessel-click-no-panel-data — VesselPanel collapsed to 0 height due to nested overflow-auto in flexbox; duplicate vessel rows from LEFT JOIN
- **Date:** 2026-03-19
- **Error patterns:** clicking ship, vessel panel, nothing happens, no panel, no data, duplicate rows, LEFT JOIN, vessel_anomalies
- **Root cause:** (1) Phase 14 added `max-h-[calc(100vh-4rem)] overflow-y-auto` to VesselPanel root div. CSS flexbox sets min-size=0 for flex items with overflow:auto, allowing the panel to collapse to 0 height inside the right column's flex-col overflow-y-auto — panel renders in DOM but is invisible. (2) getVesselsWithSanctions LEFT JOIN on vessel_anomalies without deduplication produces duplicate vessel rows for vessels with multiple active anomalies.
- **Fix:** (1) Removed `max-h-[calc(100vh-4rem)] overflow-y-auto` from VesselPanel root div — parent column already handles scrolling. (2) Changed LEFT JOIN on vessel_anomalies to a LATERAL subquery with LIMIT 1 ORDER BY detected_at DESC to guarantee at most one anomaly row per vessel.
- **Files changed:** src/components/panels/VesselPanel.tsx, src/lib/db/sanctions.ts
---

