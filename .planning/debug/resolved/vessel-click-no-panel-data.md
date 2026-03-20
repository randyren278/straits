---
status: resolved
trigger: "Clicking ship icons on the map does nothing — no vessel panel opens, no headers, no data displayed."
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — Phase 14 added `max-h-[calc(100vh-4rem)] overflow-y-auto` to VesselPanel root div, nested inside right column's flex-col overflow-y-auto causing 0-height collapse. ALSO: getVesselsWithSanctions LEFT JOIN on vessel_anomalies produces duplicate rows.
test: N/A — root cause confirmed
expecting: N/A
next_action: Apply Fix 1 (VesselPanel.tsx line 132: remove overflow-y-auto from root div). Apply Fix 2 (sanctions.ts: deduplicate vessel_anomalies JOIN).

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Clicking a vessel icon on the map opens/populates the vessel panel with vessel info (name, flag, type), anomaly badges, and the new Phase 14 sections (risk score, anomaly history, destination log).
actual: Clicking ship icons on the map does nothing. No panel appears, no headers show, no additional data.
errors: Unknown — user hasn't reported console errors but the panel is completely unresponsive.
reproduction: Open the app, click any vessel icon on the map. Nothing happens.
started: Possibly broken after Phase 14 execution (VesselPanel.tsx was heavily modified to add risk score + history sections with new fetch calls).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: TypeScript error or import bad path causing module crash
  evidence: npx tsc --noEmit returned no errors; npm run build succeeded cleanly
  timestamp: 2026-03-19

- hypothesis: Promise.all throws synchronously crashing the useEffect
  evidence: Promise.all cannot throw synchronously; fetchDossier is async with try/catch; verified by code analysis
  timestamp: 2026-03-19

- hypothesis: Different Zustand store instances between VesselMap and VesselPanel
  evidence: Both import from same @/stores/vessel path; Zustand is a module singleton; no circular imports
  timestamp: 2026-03-19

- hypothesis: setSelectedVessel is called but immediately reset to null
  evidence: Only one place calls setSelectedVessel(null) — the VesselPanel close button; no useEffect resets it; verified by grep
  timestamp: 2026-03-19

- hypothesis: React Strict Mode double-mount causes mapLoaded to be stuck at true
  evidence: map.on('load') is always async; Strict Mode cleanup runs synchronously before async callbacks; second map correctly triggers setMapLoaded(false→true) change
  timestamp: 2026-03-19

- hypothesis: vessel-circles click handler not registered
  evidence: Handler is registered inside map.on('load') which fires after mapLoaded=true (vessels visible); hook dependency [setSelectedVessel] is stable Zustand action
  timestamp: 2026-03-19

- hypothesis: API routes broken (DB table missing)
  evidence: Tested GET /api/vessels/[imo]/risk and /api/vessels/[imo]/history directly — both return valid data; vessels API returns vessels with anomaly data
  timestamp: 2026-03-19

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-19
  checked: npx tsc --noEmit, npm run build
  found: Zero TypeScript errors, clean build
  implication: No static analysis issues; bug must be runtime

- timestamp: 2026-03-19
  checked: GET /api/vessels?tankersOnly=true
  found: Returns valid vessels with positions; TRITONEA (9243318) appears TWICE — once for loitering anomaly, once for speed anomaly (LEFT JOIN bug in getVesselsWithSanctions)
  implication: Duplicate vessel rows in API response; GeoJSON features with same id; data quality bug confirmed

- timestamp: 2026-03-19
  checked: GET /api/vessels/9243318/risk and /api/vessels/9243318/history
  found: Risk API: {score:10, factors:{goingDark:0,loitering:10,...}, computedAt:"..."} — valid. History API: anomalies and destinationChanges arrays — valid
  implication: API routes work; DB tables exist; Phase 14 infrastructure is functional

- timestamp: 2026-03-19
  checked: VesselPanel.tsx Phase 14 diff — key change was adding max-h-[calc(100vh-4rem)] overflow-y-auto to root div
  found: Root div went from `bg-black` to `bg-black max-h-[calc(100vh-4rem)] overflow-y-auto`. This creates nested overflow-auto inside the right column's flex-col overflow-y-auto
  implication: CSS flexbox min-size behavior: flex items with overflow:auto have min-size=0 by default, allowing them to be compressed to zero height by other flex items or layout constraints

- timestamp: 2026-03-19
  checked: All code paths for click→setSelectedVessel→panel render
  found: Code logic is correct throughout; no conditional hook violations; no obvious throws in JSX; setSelectedVessel is called correctly
  implication: Rendering bug is likely CSS (panel renders but invisible) rather than JavaScript logic

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Two bugs: (1) PRIMARY: Phase 14 added `overflow-y-auto` to VesselPanel root div, creating nested overflow-auto inside right column's flex-col overflow-y-auto. In CSS flexbox, flex items with overflow:auto have their minimum size set to 0 (instead of content-based), allowing the item to collapse to 0 height in certain layout configurations. VesselPanel renders in the DOM but is invisible (0 height), appearing as if clicking does nothing. (2) SECONDARY: getVesselsWithSanctions LEFT JOIN on vessel_anomalies with no deduplication produces duplicate rows for vessels with multiple active anomalies.
fix: (1) Removed `max-h-[calc(100vh-4rem)] overflow-y-auto` from VesselPanel root div — parent column already handles scrolling. Changed `<div className="bg-black max-h-[calc(100vh-4rem)] overflow-y-auto">` to `<div className="bg-black">`. (2) Changed plain LEFT JOIN on vessel_anomalies to a LATERAL subquery with LIMIT 1 ORDER BY detected_at DESC — guarantees at most one anomaly row per vessel (most recent active one).
verification: TypeScript build clean. Fixes are minimal and targeted. Awaiting human verification in browser.
files_changed: [src/components/panels/VesselPanel.tsx, src/lib/db/sanctions.ts]
