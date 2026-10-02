export type Coordinate = readonly [longitude: number, latitude: number];

export interface RouteWaypoint {
  name: string;
  coordinate: Coordinate;
}

export interface RouteDefinition {
  id: 'suez' | 'cape';
  name: string;
  waypoints: readonly RouteWaypoint[];
}

export interface ParallelSeasScenario {
  speedKnots: number;
  closureDelayDays: number;
}

export interface ParallelSeasResult {
  suezDistanceNm: number;
  capeDistanceNm: number;
  suezSailingDays: number;
  capeSailingDays: number;
  waitTotalDays: number;
  capeExtraNm: number;
  capeExtraSailingDays: number;
  capeTimeSavedVsWaitDays: number;
}

export const DEFAULT_SCENARIO: ParallelSeasScenario = {
  speedKnots: 12,
  closureDelayDays: 5,
};

/** Fixed, illustrative sea-route waypoints; these are not a navigational chart. */
export const PARALLEL_SEAS_ROUTES: readonly RouteDefinition[] = [
  {
    id: 'suez',
    name: 'Via Suez',
    waypoints: [
      { name: 'Mumbai', coordinate: [72.85, 18.93] },
      { name: 'Arabian Sea', coordinate: [62, 17] },
      { name: 'Oman approach', coordinate: [56, 14.5] },
      { name: 'Gulf of Aden', coordinate: [48, 12] },
      { name: 'Bab el-Mandeb', coordinate: [43.3, 12.6] },
      { name: 'Red Sea south', coordinate: [41.5, 16] },
      { name: 'Red Sea north', coordinate: [36.4, 25] },
      { name: 'Red Sea upper reach', coordinate: [34, 27.5] },
      { name: 'Gulf of Suez', coordinate: [32.9, 28.3] },
      { name: 'Suez Canal', coordinate: [32.55, 29.95] },
      { name: 'Port Said', coordinate: [32.3, 31.27] },
      { name: 'South of Crete', coordinate: [24.5, 34] },
      { name: 'South of Malta', coordinate: [14.4, 35.6] },
      { name: 'North Tunisia approach', coordinate: [11.5, 37.7] },
      { name: 'West of Sardinia', coordinate: [6, 38] },
      { name: 'Western Mediterranean', coordinate: [0, 37] },
      { name: 'Gibraltar', coordinate: [-5.6, 35.9] },
      { name: 'Off Portugal', coordinate: [-11.5, 39] },
      { name: 'Bay of Biscay', coordinate: [-10, 46] },
      { name: 'Western English Channel', coordinate: [-5, 49.5] },
      { name: 'Dover Strait', coordinate: [1, 51] },
      { name: 'Rotterdam', coordinate: [4.48, 51.92] },
    ],
  },
  {
    id: 'cape',
    name: 'Via Cape of Good Hope',
    waypoints: [
      { name: 'Mumbai', coordinate: [72.85, 18.93] },
      { name: 'Southwest Indian Ocean', coordinate: [56, 8] },
      { name: 'East of Madagascar', coordinate: [55, -13] },
      { name: 'Southeast of Madagascar', coordinate: [51, -25] },
      { name: 'South of Madagascar', coordinate: [44, -29] },
      { name: 'South of South Africa', coordinate: [32, -35.5] },
      { name: 'Southwest of South Africa', coordinate: [20, -35.5] },
      { name: 'Cape of Good Hope', coordinate: [18.4, -34.4] },
      { name: 'Off Namibia', coordinate: [8, -25] },
      { name: 'Off Angola', coordinate: [-3, -7] },
      { name: 'South Atlantic', coordinate: [-15, 0] },
      { name: 'Off Gulf of Guinea', coordinate: [-20, 8] },
      { name: 'Off West Africa', coordinate: [-18, 16] },
      { name: 'Canary approach', coordinate: [-19, 28] },
      { name: 'Off Portugal', coordinate: [-11.5, 39] },
      { name: 'Bay of Biscay', coordinate: [-10, 46] },
      { name: 'Western English Channel', coordinate: [-5, 49.5] },
      { name: 'Dover Strait', coordinate: [1, 51] },
      { name: 'Rotterdam', coordinate: [4.48, 51.92] },
    ],
  },
];

const EARTH_RADIUS_NM = 3440.065;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/** Great-circle distance between two points, in nautical miles. */
export function haversineDistanceNm(from: Coordinate, to: Coordinate): number {
  const [fromLon, fromLat] = from;
  const [toLon, toLat] = to;
  const latitudeDelta = toRadians(toLat - fromLat);
  const longitudeDelta = toRadians(toLon - fromLon);
  const fromLatitude = toRadians(fromLat);
  const toLatitude = toRadians(toLat);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function routeDistanceNm(route: RouteDefinition): number {
  return route.waypoints.slice(1).reduce((distance, waypoint, index) => {
    return distance + haversineDistanceNm(route.waypoints[index].coordinate, waypoint.coordinate);
  }, 0);
}

export function calculateParallelSeasScenario(
  scenario: ParallelSeasScenario,
): ParallelSeasResult {
  const { speedKnots, closureDelayDays } = scenario;
  if (!Number.isFinite(speedKnots) || speedKnots < 1 || speedKnots > 30) {
    throw new RangeError('Speed must be between 1 and 30 knots.');
  }
  if (!Number.isFinite(closureDelayDays) || closureDelayDays < 0 || closureDelayDays > 90) {
    throw new RangeError('Closure delay must be between 0 and 90 days.');
  }

  const suezDistanceNm = routeDistanceNm(PARALLEL_SEAS_ROUTES[0]);
  const capeDistanceNm = routeDistanceNm(PARALLEL_SEAS_ROUTES[1]);
  const hoursAtSea = (distanceNm: number) => distanceNm / speedKnots;
  const suezSailingDays = hoursAtSea(suezDistanceNm) / 24;
  const capeSailingDays = hoursAtSea(capeDistanceNm) / 24;
  const capeExtraNm = capeDistanceNm - suezDistanceNm;
  const capeExtraSailingDays = hoursAtSea(capeExtraNm) / 24;
  const waitTotalDays = suezSailingDays + closureDelayDays;

  return {
    suezDistanceNm,
    capeDistanceNm,
    suezSailingDays,
    capeSailingDays,
    waitTotalDays,
    capeExtraNm,
    capeExtraSailingDays,
    capeTimeSavedVsWaitDays: waitTotalDays - capeSailingDays,
  };
}

export function parseScenarioValue(
  value: string | string[] | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
