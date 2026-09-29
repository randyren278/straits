/** Track engine constants — values are fixed by the design spec. */
export const JITTER_NM = 0.1;          // moves under ~185 m are anchor/GPS jitter
export const TELEPORT_KN = 35;         // implied speed above this is quarantined
export const CONFIRM_NM = 1.0;         // a quarantined fix confirmed by the next within 1 nm is real
export const DWELL_MIN = 25;           // a repeat this long means stopped, not a stale report
export const UNDERWAY_KN = 3;
export const MIN_EST_KN = 1;
export const MAX_KN = 28;
export const MAX_EST_MIN = 360;        // never carry a ship more than 6 h past its last real fix
export const KALMAN_Q = 60;            // nm²/h³
export const KALMAN_R = 0.02;          // nm²
export const REGION = { minLon: 30, minLat: 10, maxLon: 63, maxLat: 32 } as const;
export const LAND_RES = 100;           // land raster cells per degree (0.01°)
export const GRID_RES = 50;            // routing grid cells per degree (0.02°)
