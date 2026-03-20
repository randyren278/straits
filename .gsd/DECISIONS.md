# Architectural Decisions

## D001: Pending target pattern for cross-route vessel hydration
- **Status:** Accepted
- **Context:** The `/fleet` page and `SearchInput` components only possess partial vessel data. However, the dashboard map and `VesselPanel` require a full `VesselWithSanctions` object to render the dossier.
- **Decision:** Implement a pending selection pattern using `targetVesselImo` in the global Zustand store to hydrate the full vessel object upon map load.
- **Rationale:** Passing the IMO as a pending target allows the destination route (dashboard) to resolve the full object from its comprehensive `vessels` dataset once loaded, decoupling the origin route from heavy data fetching requirements.
- **Consequences:** The map component must now listen to changes on `targetVesselImo` and `vessels` to hydrate the `selectedVessel`. State synchronization must handle clearing the target once hydrated to prevent looping.
