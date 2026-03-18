/**
 * Anomaly Detection Type Definitions
 *
 * Provides type-safe definitions for the anomaly detection system.
 * Uses discriminated unions for type narrowing on anomaly details.
 */

export type AnomalyType = 'going_dark' | 'loitering' | 'deviation' | 'speed' | 'repeat_going_dark' | 'sts_transfer';
export type Confidence = 'confirmed' | 'suspected' | 'unknown';

/**
 * Going Dark Anomaly Details
 * When a vessel stops transmitting AIS in a coverage zone
 */
export interface GoingDarkDetails {
  lastPosition: { lat: number; lon: number };
  gapMinutes: number;
  coverageZone: string;
}

/**
 * Loitering Anomaly Details
 * When a vessel stays in a small radius for extended time outside anchorage
 */
export interface LoiteringDetails {
  centroid: { lat: number; lon: number };
  radiusKm: number;
  durationHours: number;
}

/**
 * Deviation Anomaly Details
 * When a vessel heading differs significantly from expected route
 */
export interface DeviationDetails {
  expectedHeading: number;
  actualHeading: number;
  deviationDegrees: number;
  destination: string;
}

/**
 * Speed Anomaly Details
 * When a tanker is moving too slowly outside port/anchorage (drifting/disabled)
 */
export interface SpeedDetails {
  speedKnots: number;
  lastPosition: { lat: number; lon: number };
}

/**
 * Repeat Going Dark Anomaly Details
 * When a vessel has gone dark multiple times within a time window — pattern indicates evasion
 */
export interface RepeatGoingDarkDetails {
  goingDarkCount: number;
  windowDays: number;
  recentEvents: Array<{ detectedAt: string; resolvedAt: string | null }>;
}

/**
 * Ship-to-Ship Transfer Anomaly Details
 * When two vessels are detected in close proximity at sea, suggesting cargo transfer
 */
export interface StsTransferDetails {
  otherImo: string;
  otherName: string;
  distanceKm: number;
  lat: number;
  lon: number;
}

/**
 * Anomaly record from database
 * Details field is a discriminated union based on anomaly type
 */
export interface Anomaly {
  id: number;
  imo: string;
  anomalyType: AnomalyType;
  confidence: Confidence;
  detectedAt: Date;
  resolvedAt: Date | null;
  details: GoingDarkDetails | LoiteringDetails | DeviationDetails | SpeedDetails | RepeatGoingDarkDetails | StsTransferDetails;
}

/**
 * Input for creating/updating anomalies
 * Excludes id and resolvedAt which are managed by the system
 */
export interface UpsertAnomalyInput {
  imo: string;
  anomalyType: AnomalyType;
  confidence: Confidence;
  detectedAt: Date;
  details: GoingDarkDetails | LoiteringDetails | DeviationDetails | SpeedDetails | RepeatGoingDarkDetails | StsTransferDetails;
}

/**
 * Watchlist entry for user's tracked vessels
 * Session-based user identification via localStorage UUID
 */
export interface WatchlistEntry {
  userId: string;
  imo: string;
  addedAt: Date;
  notes: string | null;
}

/**
 * Alert notification for watched vessels
 * Generated when anomaly detected on watched vessel
 */
export interface Alert {
  id: number;
  userId: string;
  imo: string;
  alertType: string;
  triggeredAt: Date;
  readAt: Date | null;
  details: object;
}
