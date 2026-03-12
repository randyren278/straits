/**
 * Vessel and position type definitions for the tanker tracker.
 * IMO is used as primary key per DATA-03 decision - MMSI can be reused/spoofed.
 */

/**
 * Vessel metadata stored in the vessels table.
 * IMO number is the primary key for vessel identity.
 */
export interface Vessel {
  /** IMO number - unique vessel identifier (primary key) */
  imo: string;
  /** MMSI - Maritime Mobile Service Identity (can change) */
  mmsi: string;
  /** Vessel name */
  name: string;
  /** Flag state (2-letter ISO code) */
  flag: string;
  /** AIS ship type code (80-89 for tankers) */
  shipType: number;
  /** Current destination from AIS */
  destination: string | null;
  /** Last time we received data for this vessel */
  lastSeen: Date;
}

/**
 * Position data stored in the vessel_positions hypertable.
 * Represents a single AIS position report.
 */
export interface VesselPosition {
  /** Timestamp of the position report */
  time: Date;
  /** MMSI of the reporting vessel */
  mmsi: string;
  /** IMO number (may be null if not yet resolved) */
  imo: string | null;
  /** Latitude in decimal degrees */
  latitude: number;
  /** Longitude in decimal degrees */
  longitude: number;
  /** Speed over ground in knots */
  speed: number | null;
  /** Course over ground in degrees (0-360) */
  course: number | null;
  /** True heading in degrees (0-360) */
  heading: number | null;
  /** AIS navigational status code */
  navStatus: number | null;
  /** Flag indicating position may be in GPS jamming zone */
  lowConfidence: boolean;
}

/**
 * Combined vessel with current position for API responses.
 */
export interface VesselWithPosition extends Vessel {
  /** Most recent position */
  position: VesselPosition | null;
}
