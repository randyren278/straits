# S01: Default All-Vessels & Fleet Page with Anomaly Tables

**Goal:** Dashboard defaults to all vessels on first load; a new Fleet page at `/fleet` shows ships grouped by anomaly type in tables.
**Demo:** Open dashboard → all vessels visible (not tankers-only). Click Fleet tab → `/fleet` loads showing collapsible tables grouped by anomaly type, each row showing vessel name, IMO, flag, risk score, and detection time.

## Must-Haves

- `tankersOnly` default changed from `true` to `false` in Zustand vessel store
- `/api/anomalies` returns `vesselName`, `flag`, and `riskScore` for each anomaly
- Header nav includes a "Fleet" tab linking to `/fleet` with active state
- `/fleet` page fetches from `/api/anomalies` and groups results by `anomalyType`
- Each anomaly group renders as a collapsible table with columns: vessel name, IMO, flag, risk score, detection time
- `AnomalyTable` component exposes row data (imo, vesselName, flag, detectedAt, confidence, details) for S02 click-to-expand

## Proof Level

- This slice proves: integration
- Real runtime required: yes (API must query real DB schema)
- Human/UAT required: yes (visual check of Fleet tab, tables, grouping)

## Verification

- `npm run build` succeeds with zero TypeScript errors
- `npx vitest run` — all existing tests pass
- `grep -q 'tankersOnly: false' src/stores/vessel.ts` — default changed
- `grep -q 'vesselName' src/app/api/anomalies/route.ts` — API enhanced
- `test -f src/app/\(protected\)/fleet/page.tsx` — Fleet page exists
- `test -f src/components/fleet/AnomalyTable.tsx` — table component exists
- `grep -q "'/fleet'" src/components/ui/Header.tsx` — nav tab wired
- Fleet page error state: when `/api/anomalies` returns 500, the page shows an error message (not a blank screen or crash)

## Observability / Diagnostics

- Runtime signals: `/api/anomalies` logs errors to `console.error` on SQL failure; Fleet page renders error state string on fetch failure
- Inspection surfaces: `curl http://localhost:3000/api/anomalies` — verify `vesselName`, `flag`, `riskScore` fields present in response JSON
- Failure visibility: Fleet page shows user-visible error message when API fails; API returns `{ error: "..." }` with 500 status
- Redaction constraints: none (anomaly data is not PII)

## Integration Closure

- Upstream surfaces consumed: `GET /api/anomalies` (existing, enhanced), Zustand vessel store (`src/stores/vessel.ts`), `AnomalyBadge` component, `Header` component
- New wiring introduced in this slice: `/fleet` route + page, `AnomalyTable` component, Fleet nav tab in Header, `AnomalyWithVessel` type
- What remains before the milestone is truly usable end-to-end: S02 — click-to-expand vessel detail + "Show on Map" navigation

## Tasks

- [x] **T01: Enhance anomaly API with vessel metadata and change default filter** `est:30m`
  - Why: The Fleet page needs vessel names, flags, and risk scores from the anomalies endpoint, and the dashboard must default to all vessels. This is the data foundation for T02.
  - Files: `src/stores/vessel.ts`, `src/app/api/anomalies/route.ts`, `src/types/anomaly.ts`
  - Do: Change `tankersOnly: true` → `false` in vessel store. Add `v.name as "vesselName"`, `v.flag`, and LEFT JOIN to `vessel_risk_scores` for `riskScore` in the anomalies SQL SELECT. Add `vesselName`, `flag`, and `riskScore` fields to the `Anomaly` type (or create `AnomalyWithVessel` extended type).
  - Verify: `npm run build` succeeds; `grep -q 'tankersOnly: false' src/stores/vessel.ts`; `grep -q 'vesselName' src/app/api/anomalies/route.ts`
  - Done when: Build passes, anomaly API response includes vesselName/flag/riskScore fields, default filter is "all vessels"

- [x] **T02: Build Fleet page with anomaly-grouped tables and header nav tab** `est:1h`
  - Why: This is the core UI deliverable — the Fleet page that groups anomalies by type in collapsible tables, plus the nav tab to reach it. Skills: `frontend-design` for terminal aesthetic, `react-best-practices` for component patterns.
  - Files: `src/components/ui/Header.tsx`, `src/app/(protected)/fleet/page.tsx`, `src/components/fleet/AnomalyTable.tsx`
  - Do: Add "Fleet" tab to Header nav with `activeTab` case for `pathname === '/fleet'`. Create Fleet page following dashboard/analytics pattern ('use client', renders own Header, fetches `/api/anomalies` on mount). Group anomalies by `anomalyType` client-side. Create `AnomalyTable` component with collapsible sections per anomaly type, each showing columns: vessel name, IMO, flag, risk score, detection time. Use `AnomalyBadge` for type badges. Follow terminal aesthetic (bg-black, amber accents, font-mono, uppercase tracking-widest labels, no border-radius). Include loading and error states. Each row must expose all data S02 needs for click-to-expand (imo, vesselName, flag, etc.).
  - Verify: `npm run build` succeeds; `test -f src/app/\(protected\)/fleet/page.tsx`; `test -f src/components/fleet/AnomalyTable.tsx`; `grep -q "'/fleet'" src/components/ui/Header.tsx`
  - Done when: Build passes, Fleet tab appears in header nav, Fleet page renders grouped anomaly tables with all required columns, loading and error states work

## Files Likely Touched

- `src/stores/vessel.ts`
- `src/app/api/anomalies/route.ts`
- `src/types/anomaly.ts`
- `src/components/ui/Header.tsx`
- `src/app/(protected)/fleet/page.tsx` (new)
- `src/components/fleet/AnomalyTable.tsx` (new)
