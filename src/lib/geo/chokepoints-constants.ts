/**
 * Chokepoint Constants (MAP-07)
 *
 * Defines bounding boxes for critical maritime chokepoints in the Middle East.
 * Client-safe constants for use in browser components.
 */

export interface ChokepointBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface Chokepoint {
  id: string;
  name: string;
  bounds: ChokepointBounds;
}

/**
 * Critical maritime chokepoints for Middle East oil transit.
 * Coordinates define bounding boxes for vessel detection.
 */
export const CHOKEPOINTS: Record<string, Chokepoint> = {
  hormuz: {
    id: 'hormuz',
    name: 'Strait of Hormuz',
    bounds: { minLat: 26.0, maxLat: 27.0, minLon: 55.5, maxLon: 57.0 },
  },
  babel_mandeb: {
    id: 'babel_mandeb',
    name: 'Bab el-Mandeb',
    bounds: { minLat: 12.4, maxLat: 13.0, minLon: 43.0, maxLon: 43.7 },
  },
  suez: {
    id: 'suez',
    name: 'Suez Canal',
    bounds: { minLat: 29.8, maxLat: 31.3, minLon: 32.2, maxLon: 32.6 },
  },
};

/**
 * Check if a coordinate is within a chokepoint's bounding box.
 * Uses inclusive bounds check (edge points are inside).
 *
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @param bounds - Chokepoint bounding box
 * @returns True if coordinate is within bounds
 */
export function isInChokepoint(lat: number, lon: number, bounds: ChokepointBounds): boolean {
  return lat >= bounds.minLat && lat <= bounds.maxLat &&
         lon >= bounds.minLon && lon <= bounds.maxLon;
}
