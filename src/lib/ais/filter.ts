/**
 * GPS data quality filtering for AIS positions.
 * Rejects impossible positions and flags positions in known jamming zones.
 * Requirements: DATA-04
 */
import type { VesselPosition } from '@/types/vessel';

/**
 * Known GPS jamming/spoofing hotspots.
 * Positions in these zones are flagged as low_confidence but not discarded.
 */
const JAMMING_ZONES = [
  // Persian Gulf (heavy Iranian jamming)
  { minLat: 24, maxLat: 30, minLon: 48, maxLon: 57 },
  // Red Sea / Bab el-Mandeb (Houthi activity)
  { minLat: 12, maxLat: 20, minLon: 38, maxLon: 45 },
];

/**
 * Maximum valid speed in knots.
 * Tankers rarely exceed 20 knots; 50 is clearly invalid data.
 */
const MAX_SPEED_KNOTS = 50;

/**
 * Check if coordinates are in a known GPS jamming zone.
 * @param lat Latitude in decimal degrees
 * @param lon Longitude in decimal degrees
 * @returns true if position is in a jamming zone
 */
export function isInJammingZone(lat: number, lon: number): boolean {
  return JAMMING_ZONES.some(
    (zone) =>
      lat >= zone.minLat &&
      lat <= zone.maxLat &&
      lon >= zone.minLon &&
      lon <= zone.maxLon
  );
}

/**
 * Result of position filtering.
 */
export interface FilterResult {
  /** Whether the position passed validation */
  valid: boolean;
  /** The (possibly modified) position, or null if invalid */
  position: VesselPosition | null;
  /** Reason for rejection, if invalid */
  reason?: string;
}

/**
 * Filter a position for data quality.
 * - Rejects positions with impossible speeds (>50 knots)
 * - Flags positions in jamming zones as low_confidence
 *
 * Per CONTEXT.md: "Flag but don't discard positions in known GPS jamming zones"
 *
 * @param position The position to filter
 * @returns FilterResult with validity and optionally modified position
 */
export function filterPosition(position: VesselPosition): FilterResult {
  // Reject impossible speeds (DATA-04)
  if (position.speed !== null && position.speed > MAX_SPEED_KNOTS) {
    return {
      valid: false,
      position: null,
      reason: `Invalid speed: ${position.speed} knots exceeds ${MAX_SPEED_KNOTS} knot maximum`,
    };
  }

  // Flag positions in jamming zones as low confidence (don't discard)
  const inJammingZone = isInJammingZone(position.latitude, position.longitude);

  return {
    valid: true,
    position: {
      ...position,
      lowConfidence: inJammingZone,
    },
  };
}
