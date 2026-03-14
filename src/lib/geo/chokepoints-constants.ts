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
    bounds: { minLat: 23.5, maxLat: 27.0, minLon: 55.5, maxLon: 57.5 },
  },
  babel_mandeb: {
    id: 'babel_mandeb',
    name: 'Bab el-Mandeb',
    bounds: { minLat: 11.0, maxLat: 13.5, minLon: 42.5, maxLon: 45.0 },
  },
  suez: {
    id: 'suez',
    name: 'Suez Canal',
    bounds: { minLat: 29.5, maxLat: 32.5, minLon: 31.5, maxLon: 33.0 },
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
