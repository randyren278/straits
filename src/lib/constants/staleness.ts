/**
 * Vessel display staleness constants — single source of truth.
 *
 * These intervals control which vessels appear in current-state views
 * (map, fleet, chokepoints, anomalies). They are NOT detection intervals
 * (those live in src/lib/detection/) and NOT analytics windows
 * (those live in src/lib/db/analytics.ts and are user-selected).
 *
 * To audit usage: rg "VESSEL_STALENESS\|CHOKEPOINT_STALENESS" src/
 */

/** How far back to look for vessel positions in display queries (map, fleet, anomalies). */
export const VESSEL_STALENESS_INTERVAL = '7 days';

/** How far back to look for vessel positions in chokepoint queries. */
export const CHOKEPOINT_STALENESS_INTERVAL = '7 days';
