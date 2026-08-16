/**
 * Free Middle East AIS fallback.
 *
 * VesselFinder's public map feed supplies live positions in the configured
 * Middle East regions. It is used only when AISStream is unavailable, with a
 * bounded once-per-harvest request rate. Unlike the previous generic fallback,
 * this source is rejected unless it yields live positions in our own coverage
 * area — unrelated regional traffic must never make the tracker look healthy.
 */

export interface FallbackBounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export interface FreeFallbackPosition {
  time: Date;
  mmsi: string;
  latitude: number;
  longitude: number;
  speed: null;
  course: null;
  heading: number | null;
  navStatus: null;
  name: string;
  shipType: number | null;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
const MAP_ENDPOINT = 'https://www.vesselfinder.com/api/pub/mp2';
const SCALE = 600_000;

interface DecodedShip {
  mmsi: number;
  latitude: number;
  longitude: number;
  heading: number | null;
  stale: boolean;
  name: string;
  shipType: number | null;
}

/** Map-feed categories translated to standard AIS broad type codes. */
const AIS_TYPE_BY_MAP_CATEGORY: Record<number, number> = {
  1: 30, // fishing
  2: 52, // tug
  3: 60, // passenger
  4: 70, // cargo
  5: 80, // tanker
  6: 37, // pleasure craft
  7: 40, // high-speed craft
  8: 50, // special-purpose craft
  9: 37, // yacht
};

function decodeMapPayload(buffer: ArrayBuffer): DecodedShip[] {
  const view = new DataView(buffer);
  if (view.byteLength < 12) return [];
  const headerLength = view.getUint16(1);
  let offset = 4 + headerLength;
  if (offset < 4 || offset > view.byteLength || offset < 4) return [];
  const referenceMmsi = offset >= 4 ? view.getInt32(offset - 4) : 0;
  const ships: DecodedShip[] = [];

  while (offset < view.byteLength) {
    if (offset + 14 > view.byteLength) break;
    const flags = view.getInt16(offset);
    offset += 2;
    const headingBits = (flags & 0x3f00) >> 8;
    const typeCategory = (flags & 0xf0) >> 4;
    const hasExtra = (flags & 2) !== 0;
    const stale = (flags & 4) !== 0;
    const mmsi = view.getInt32(offset);
    offset += 4;
    const latitude = view.getInt32(offset) / SCALE;
    offset += 4;
    const longitude = view.getInt32(offset) / SCALE;
    offset += 4;

    // The wire format contains optional fields before and after the ship name.
    // Consume them even though fallback ingestion only needs the live fix.
    if (mmsi === referenceMmsi) {
      if (offset + 6 > view.byteLength) break;
      offset += 6;
    }
    if (offset + 2 > view.byteLength) break;
    offset += 1;
    const nameLength = view.getInt8(offset);
    offset += 1;
    if (nameLength < 0 || offset + nameLength > view.byteLength) break;
    const name = new TextDecoder().decode(new Uint8Array(buffer, offset, nameLength)).trim();
    offset += nameLength;
    if (mmsi === referenceMmsi) {
      if (offset + 4 > view.byteLength) break;
      offset += 4;
    }
    if (hasExtra) {
      if (offset + 2 > view.byteLength) break;
      offset += 2;
    }

    if (mmsi > 0 && Number.isFinite(latitude) && Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      ships.push({
        mmsi, latitude, longitude,
        heading: headingBits < 32 ? Math.round(headingBits * 11.25) : null,
        stale, name,
        shipType: AIS_TYPE_BY_MAP_CATEGORY[typeCategory] ?? null,
      });
    }
  }
  return ships;
}

function bboxParam(bounds: FallbackBounds): string {
  return [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat]
    .map((coord) => Math.floor(coord * SCALE))
    .join(',');
}

function isWithinConfiguredBounds(ship: DecodedShip, bounds: readonly FallbackBounds[]): boolean {
  return bounds.some((bound) =>
    ship.latitude >= bound.minLat && ship.latitude <= bound.maxLat &&
    ship.longitude >= bound.minLon && ship.longitude <= bound.maxLon
  );
}

/** Fetch current, non-stale vessel positions from each Straits coverage zone. */
export async function fetchFreeAisFallback(
  bounds: readonly FallbackBounds[],
  fetcher: FetchLike = fetch,
  now = new Date(),
): Promise<FreeFallbackPosition[]> {
  const responses = await Promise.all(bounds.map(async (bound) => {
    const url = `${MAP_ENDPOINT}?bbox=${bboxParam(bound)}&zoom=9&mmsi=0&mcbe=1`;
    const response = await fetcher(url, {
      headers: {
        Accept: '*/*',
        Referer: 'https://www.vesselfinder.com/',
        'User-Agent': 'Mozilla/5.0 (compatible; Straits-AIS-harvester/1.0)',
      },
    });
    if (!response.ok) throw new Error(`VesselFinder fallback HTTP ${response.status}`);
    return decodeMapPayload(await response.arrayBuffer());
  }));

  const latest = new Map<string, FreeFallbackPosition>();
  for (const ship of responses.flat()) {
    // The map endpoint may include a tile-edge overscan. Keep only positions
    // that are actually inside one of our subscribed coverage regions.
    if (ship.stale || !isWithinConfiguredBounds(ship, bounds)) continue;
    latest.set(String(ship.mmsi), {
      time: now,
      mmsi: String(ship.mmsi),
      latitude: ship.latitude,
      longitude: ship.longitude,
      speed: null,
      course: null,
      heading: ship.heading,
      navStatus: null,
      name: ship.name || `MMSI ${ship.mmsi}`,
      shipType: ship.shipType,
    });
  }
  if (latest.size === 0) throw new Error('VesselFinder fallback returned no current Middle East positions');
  return [...latest.values()];
}
