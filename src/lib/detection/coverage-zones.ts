/**
 * AIS Coverage Zones
 *
 * Defines terrestrial AIS coverage zones in the Middle East.
 * Going dark detection only applies within these zones where
 * signal loss likely indicates intentional transponder disabling.
 *
 * Open ocean areas (Gulf of Aden, Arabian Sea) have satellite-only
 * coverage with normal gaps - not flagged as going dark.
 */

export interface CoverageZone {
  id: string;
  name: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

/**
 * Terrestrial AIS coverage zones.
 * Coordinates define bounding boxes where signal gaps are suspicious.
 */
export const COVERAGE_ZONES: CoverageZone[] = [
  {
    id: 'persian_gulf',
    name: 'Persian Gulf',
    bounds: { minLat: 23.5, maxLat: 30.5, minLon: 47.5, maxLon: 57.0 },
  },
  {
    id: 'red_sea_north',
    name: 'Red Sea (North)',
    bounds: { minLat: 20.0, maxLat: 30.0, minLon: 32.0, maxLon: 44.0 },
  },
  {
    id: 'red_sea_south',
    name: 'Red Sea (South) / Bab el-Mandeb',
    bounds: { minLat: 12.0, maxLat: 20.0, minLon: 38.0, maxLon: 45.0 },
  },
  {
    id: 'suez_approaches',
    name: 'Suez Approaches',
    bounds: { minLat: 29.0, maxLat: 32.5, minLon: 31.5, maxLon: 35.0 },
  },
  {
    id: 'oman_coast',
    name: 'Gulf of Oman Coast',
    bounds: { minLat: 22.0, maxLat: 26.5, minLon: 56.0, maxLon: 61.0 },
  },
];

/**
 * Check if a coordinate is within any AIS coverage zone.
 * Uses inclusive bounds check (edge points are inside).
 *
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @returns True if coordinate is within a coverage zone
 */
export function isInCoverageZone(lat: number, lon: number): boolean {
  return COVERAGE_ZONES.some(zone =>
    lat >= zone.bounds.minLat && lat <= zone.bounds.maxLat &&
    lon >= zone.bounds.minLon && lon <= zone.bounds.maxLon
  );
}

/**
 * Get the coverage zone containing a coordinate, if any.
 *
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @returns The coverage zone object, or null if not in any zone
 */
export function getCoverageZone(lat: number, lon: number): CoverageZone | null {
  return COVERAGE_ZONES.find(zone =>
    lat >= zone.bounds.minLat && lat <= zone.bounds.maxLat &&
    lon >= zone.bounds.minLon && lon <= zone.bounds.maxLon
  ) || null;
}
