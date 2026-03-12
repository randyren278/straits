/**
 * Known Anchorage Areas
 *
 * Defines major anchorage zones in the Middle East.
 * Vessels in these areas should NOT be flagged for loitering
 * as waiting at anchorage is normal maritime behavior.
 */

export interface Anchorage {
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
 * Major anchorage areas for Middle East oil terminals.
 * Coordinates define bounding boxes around known anchorage zones.
 */
export const ANCHORAGES: Anchorage[] = [
  {
    id: 'fujairah',
    name: 'Fujairah Anchorage',
    bounds: { minLat: 25.0, maxLat: 25.4, minLon: 56.2, maxLon: 56.7 },
  },
  {
    id: 'kharg_island',
    name: 'Kharg Island Anchorage',
    bounds: { minLat: 29.1, maxLat: 29.4, minLon: 50.1, maxLon: 50.5 },
  },
  {
    id: 'ras_tanura',
    name: 'Ras Tanura Anchorage',
    bounds: { minLat: 26.5, maxLat: 27.0, minLon: 49.8, maxLon: 50.3 },
  },
  {
    id: 'jebel_ali',
    name: 'Jebel Ali Anchorage',
    bounds: { minLat: 24.9, maxLat: 25.1, minLon: 54.8, maxLon: 55.2 },
  },
  {
    id: 'mina_al_ahmadi',
    name: 'Mina Al Ahmadi Anchorage',
    bounds: { minLat: 28.9, maxLat: 29.2, minLon: 48.0, maxLon: 48.4 },
  },
  {
    id: 'yanbu',
    name: 'Yanbu Anchorage',
    bounds: { minLat: 23.8, maxLat: 24.2, minLon: 37.8, maxLon: 38.3 },
  },
  {
    id: 'jeddah',
    name: 'Jeddah Anchorage',
    bounds: { minLat: 21.3, maxLat: 21.7, minLon: 38.9, maxLon: 39.3 },
  },
  {
    id: 'suez_waiting',
    name: 'Suez Canal Waiting Area',
    bounds: { minLat: 29.8, maxLat: 30.2, minLon: 32.3, maxLon: 32.7 },
  },
];

/**
 * Check if a coordinate is within any known anchorage zone.
 * Uses inclusive bounds check (edge points are inside).
 *
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @returns True if coordinate is within an anchorage zone
 */
export function isInAnchorage(lat: number, lon: number): boolean {
  return ANCHORAGES.some(anch =>
    lat >= anch.bounds.minLat && lat <= anch.bounds.maxLat &&
    lon >= anch.bounds.minLon && lon <= anch.bounds.maxLon
  );
}

/**
 * Get the anchorage zone containing a coordinate, if any.
 *
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @returns The anchorage object, or null if not in any anchorage
 */
export function getAnchorage(lat: number, lon: number): Anchorage | null {
  return ANCHORAGES.find(anch =>
    lat >= anch.bounds.minLat && lat <= anch.bounds.maxLat &&
    lon >= anch.bounds.minLon && lon <= anch.bounds.maxLon
  ) || null;
}
