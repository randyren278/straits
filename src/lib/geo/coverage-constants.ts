/**
 * AIS monitored coverage — the bounding boxes the harvester subscribes to.
 *
 * Client-safe. Shared by the harvester subscription and the map's coverage
 * overlay so "no contacts here" can be read as either "outside coverage" or
 * "inside coverage, genuinely empty" — two very different statements.
 */
export interface CoverageBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export const AIS_COVERAGE: readonly CoverageBox[] = [
  { minLat: 23.0, minLon: 47.0, maxLat: 30.0, maxLon: 57.5 }, // Persian Gulf
  { minLat: 15.0, minLon: 55.0, maxLat: 26.0, maxLon: 66.0 }, // Gulf of Oman / Arabian Sea approaches
  { minLat: 8.0, minLon: 60.0, maxLat: 25.0, maxLon: 78.0 },  // Arabian Sea / India west coast
  { minLat: 12.0, minLon: 32.0, maxLat: 30.0, maxLon: 45.0 }, // Red Sea
  { minLat: 11.0, minLon: 42.0, maxLat: 14.0, maxLon: 52.0 }, // Bab el-Mandeb / Gulf of Aden
  { minLat: 29.5, minLon: 31.5, maxLat: 37.0, maxLon: 37.0 }, // Suez / Eastern Med
] as const;

/** True when a coordinate falls inside at least one monitored box. */
export function isInCoverage(lat: number, lon: number): boolean {
  return AIS_COVERAGE.some(
    (b) => lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon,
  );
}
