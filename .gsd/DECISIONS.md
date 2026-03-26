# Architectural Decisions

## D001: Pending target pattern for cross-route vessel hydration
- **Status:** Accepted
- **Context:** The `/fleet` page and `SearchInput` components only possess partial vessel data. However, the dashboard map and `VesselPanel` require a full `VesselWithSanctions` object to render the dossier.
- **Decision:** Implement a pending selection pattern using `targetVesselImo` in the global Zustand store to hydrate the full vessel object upon map load.
- **Rationale:** Passing the IMO as a pending target allows the destination route (dashboard) to resolve the full object from its comprehensive `vessels` dataset once loaded, decoupling the origin route from heavy data fetching requirements.
- **Consequences:** The map component must now listen to changes on `targetVesselImo` and `vessels` to hydrate the `selectedVessel`. State synchronization must handle clearing the target once hydrated to prevent looping.

## D002: Vessel display staleness threshold — 7 days
- **When:** M008/S01
- **Scope:** convention
- **Status:** Accepted
- **Decision:** Use 7 days as the staleness threshold for all vessel display queries (map, fleet, anomalies).
- **Rationale:** User wants consistent data across all views. 48h was too short for map, no filter was wrong for anomalies/fleet.
- **Made by:** human
- **Revisable:** Yes — if coverage area or AIS reliability changes

## D003: Chokepoint transit window — 24 hours
- **When:** M008/S01
- **Scope:** convention
- **Status:** Accepted
- **Decision:** Use 24 hours for chokepoint vessel counts and lists.
- **Rationale:** User chose 24h as middle ground — 1h was too tight, 7d would inflate counts. Shows today's transits.
- **Made by:** human
- **Revisable:** Yes

## D004: Shared staleness constants module
- **When:** M008/S01
- **Scope:** arch
- **Status:** Accepted
- **Decision:** Extract staleness thresholds to `src/lib/constants/staleness.ts` with named constants and SQL interval helpers.
- **Rationale:** Prevents hardcoded intervals drifting across queries. Single source of truth for display staleness thresholds.
- **Made by:** agent
- **Revisable:** Yes

---

## Decisions Table

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 | M010/S01 | data | How to filter anomalies by vessel position recency | Anomalies route gets EXISTS subquery with VESSEL_STALENESS_INTERVAL, same pattern as the original M009 version that was lost | Fleet tab must only show anomalies for vessels visible on the map. EXISTS with IMO→MMSI bridge join avoids row multiplication. | No | collaborative |
| D002 | M010/S02 | arch | What to do with unwired auth scaffolding | Delete entirely — no middleware, no guard, no layout. Auth needs a design discussion before reimplementation. | Auth exists but is never enforced. Dead scaffolding misleads future agents into thinking auth works. Clean delete is safer than half-wired auth. | Yes — when auth is actually needed | collaborative |
| D003 | M010 | scope | Notification bell behavior — anomalies vs alerts | Keep showing anomalies as global activity feed. Alerts system stays intact but unused until users populate watchlists. | Watchlist has 0 entries so alerts table is empty. Anomalies feed is useful as a global "what's happening now" view. No change needed. | Yes — if watchlist gets usage | collaborative |
| D004 | M010/S04 | pattern | Responsive layout strategy | Mobile-first additive breakpoints — desktop layout must not change. Add responsive rules at sm/md breakpoints only. | Bloomberg aesthetic on desktop is established and intentional. Responsive changes must be additive — stacking panels below the map on smaller screens, not rearranging desktop. | No | collaborative |
| D005 |  | requirement | R007 | validated | All 14 orphaned files (930 lines) deleted: 3 dead components (VesselLayer, TrackLayer, AnomalyMatrix), 1 dead test (AnomalyMatrix.test), 5 dead lib modules (tracks.ts, tracks.test.ts, proxy.ts, matcher.ts, matcher.test.ts), 5 unwired auth files. 4 empty directories removed. TypeScript compiles clean. rg scan confirms zero dangling references. Protected directories retain all live files. | Yes | agent |
| D006 | M010/S03/T01 | architecture | ErrorBoundary fallback API pattern | Render prop (fallback as function receiving error + reset) rather than a static component prop | Render prop gives callers access to the caught error and reset callback, enabling context-specific fallback UIs. A static component prop would require separate wrapper components to achieve the same composability. | Yes | agent |
