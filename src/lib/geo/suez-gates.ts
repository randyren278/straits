/**
 * Suez corridor geometry for the crossing model. Constants only.
 *
 * A transit is gate-in at one end followed by gate-out at the other; the
 * canal itself (between the gates) is the corridor. Anchorages are where
 * contacts wait for a convoy slot. Boxes are deliberately generous — AIS
 * sampling here is one fix per ~10 minutes at best.
 */
export interface GateBox { minLat: number; maxLat: number; minLon: number; maxLon: number }

export type SuezGateId = 'port_said' | 'suez';

export const SUEZ_GATES: Record<SuezGateId, GateBox> = {
  /** Mediterranean entrance — Port Said harbour and its approach channel. */
  port_said: { minLat: 31.20, maxLat: 31.45, minLon: 32.20, maxLon: 32.45 },
  /** Red Sea entrance — Port Tawfiq / Suez roads. */
  suez: { minLat: 29.85, maxLat: 30.05, minLon: 32.45, maxLon: 32.65 },
};

/** The canal between the gates, including the Bitter Lakes. */
export const SUEZ_CORRIDOR: GateBox = { minLat: 30.05, maxLat: 31.20, minLon: 32.20, maxLon: 32.65 };

export const SUEZ_WAITING_ZONES: Record<'port_said_anchorage' | 'suez_anchorage', GateBox> = {
  port_said_anchorage: { minLat: 31.30, maxLat: 31.70, minLon: 32.05, maxLon: 32.60 },
  suez_anchorage: { minLat: 29.60, maxLat: 29.90, minLon: 32.45, maxLon: 32.75 },
};

export const inGateBox = (lat: number, lon: number, b: GateBox) =>
  lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
