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
