/**
 * Anomaly Detection Type Definitions
 *
 * Provides type-safe definitions for the anomaly detection system.
 * Uses discriminated unions for type narrowing on anomaly details.
 */

export type AnomalyType = 'going_dark' | 'loitering' | 'deviation' | 'speed' | 'repeat_going_dark' | 'sts_transfer' | 'spoofed_position' | 'composite_diversion' | 'sts_predicted';
export type Confidence = 'confirmed' | 'suspected' | 'unknown';
export type ShipCategory = 'tanker' | 'cargo' | 'other';

/** Human-readable labels for each anomaly type, shared across components */
export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  going_dark: 'Going Dark',
  loitering: 'Loitering',
  deviation: 'Route Deviation',
  speed: 'Speed Anomaly',
  repeat_going_dark: 'Repeat Going Dark',
  sts_transfer: 'STS Transfer',
  spoofed_position: 'Spoofed Position',
  composite_diversion: 'Composite Diversion',
  sts_predicted: 'Predicted STS',
};

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
 * Spoofed Position Anomaly Details
 * When consecutive positions imply a physically impossible speed (>50 knots),
 * indicating AIS position spoofing / teleportation rather than real movement.
 */
export interface SpoofedPositionDetails {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  distanceKm: number;
  elapsedMinutes: number;
  impliedSpeedKnots: number;
}

/**
 * Composite Diversion Anomaly Details
 * When a mid-voyage destination change is followed shortly by an evasion
 * anomaly (going dark / route deviation / STS transfer) for the same vessel —
 * the combination is a stronger dark-fleet signal than either event alone.
 */
export interface CompositeDiversionDetails {
  previousDestination: string;
  newDestination: string;
  changedAt: string;
  /** The evasion anomaly type that followed the destination flip */
  followedBy: 'going_dark' | 'deviation' | 'sts_transfer';
  followedAt: string;
  /** Hours between the destination flip and the subsequent evasion event */
  gapHours: number;
  /** Whether the new destination looks like a junk/obfuscated field */
  junkDestination: boolean;
}

/**
 * Predicted Ship-to-Ship Transfer Anomaly Details
 * When dead-reckoning two vessel tracks projects a closest-point-of-approach
 * inside the STS proximity threshold within a short horizon, both parties are
 * decelerating into the transfer speed band, and at least one is high-risk —
 * a forward-looking rendezvous prediction (not yet a confirmed transfer).
 */
export interface StsPredictedDetails {
  otherImo: string;
  otherName: string;
  /** Projected closest-point-of-approach distance in km. */
  cpaDistanceKm: number;
  /** Minutes until the projected CPA. */
  timeToCpaMinutes: number;
  /** Closing speed of the two vessels in knots at prediction time. */
  closingSpeedKnots: number;
  /** Whether at least one party is sanctioned / high-risk. */
  sanctionedParty: boolean;
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
  details: GoingDarkDetails | LoiteringDetails | DeviationDetails | SpeedDetails | RepeatGoingDarkDetails | StsTransferDetails | SpoofedPositionDetails | CompositeDiversionDetails | StsPredictedDetails;
  /** Whether the vessel is on a sanctions list (M005-S03) */
  isSanctioned?: boolean;
  /** Risk category from sanctions data (M005-S03) */
  sanctionRiskCategory?: string | null;
  /** Vessel name from joined vessel data (M006-S01) */
  vesselName?: string;
  /** Vessel flag state from joined vessel data (M006-S01) */
  flag?: string;
  /** Risk score from vessel_risk_scores table (M006-S01) */
  riskScore?: number;
  /** Ship category derived from vessel ship_type code (M007-S02) */
  shipCategory?: ShipCategory;
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
  details: GoingDarkDetails | LoiteringDetails | DeviationDetails | SpeedDetails | RepeatGoingDarkDetails | StsTransferDetails | SpoofedPositionDetails | CompositeDiversionDetails | StsPredictedDetails;
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
  /** Vessel name from joined vessel data (display field, optional) */
  vesselName?: string | null;
  /** Vessel flag state from joined vessel data (display field, optional) */
  flag?: string | null;
}
